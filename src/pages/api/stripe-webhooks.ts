import type { APIRoute } from 'astro';
import Stripe from 'stripe';
import { prisma } from '../../lib/prisma';
import { type Prisma } from '@prisma/client';
import { sendUserBookingConfirmationEmail, sendAdminBookingNotificationEmail } from '../../lib/email';
import { releaseHold, HoldError } from '../../lib/holds';

const stripeSecretKey = process.env.STRIPE_SECRET_KEY;
const webhookSecret = process.env.STRIPE_WEBHOOK_SECRET;

// Validate required environment variables
if (!stripeSecretKey) {
  console.error('CRITICAL: STRIPE_SECRET_KEY is not set in environment variables');
}
if (!webhookSecret) {
  console.error('CRITICAL: STRIPE_WEBHOOK_SECRET is not set in environment variables');
  console.log('To get webhook secret:');
  console.log('1. Go to Stripe Dashboard > Webhooks');
  console.log('2. Click on your webhook endpoint');
  console.log('3. Copy the signing secret (starts with whsec_)');
  console.log('4. Add it to your Netlify environment as STRIPE_WEBHOOK_SECRET');
}

const stripe = stripeSecretKey ? new Stripe(stripeSecretKey) : null;

export const POST: APIRoute = async ({ request }) => {
  console.log('🎯 Webhook received at:', new Date().toISOString());
  
  if (!stripe || !webhookSecret) {
    console.error('❌ Stripe webhook: Missing configuration');
    console.error('- STRIPE_SECRET_KEY configured:', !!stripeSecretKey);
    console.error('- STRIPE_WEBHOOK_SECRET configured:', !!webhookSecret);
    return new Response('Webhook Error: Server configuration error.', { status: 500 });
  }

  const signature = request.headers.get('stripe-signature');
  if (!signature) {
    console.error('❌ Webhook Error: Missing Stripe signature header');
    return new Response('Webhook Error: Missing Stripe signature.', { status: 400 });
  }

  let event: Stripe.Event;
  let rawBody: string;
  
  try {
    rawBody = await request.text();
    console.log('📦 Webhook body length:', rawBody.length);
    
    event = stripe.webhooks.constructEvent(rawBody, signature, webhookSecret);
    console.log('✅ Webhook signature verified successfully');
    console.log('📋 Event type:', event.type, 'ID:', event.id);
  } catch (err: any) {
    console.error('❌ Webhook signature verification failed:', err.message);
    console.error('- Signature received:', signature?.substring(0, 20) + '...');
    console.error('- Webhook secret configured:', webhookSecret ? 'Yes (length: ' + webhookSecret.length + ')' : 'No');
    return new Response(`Webhook Error: ${err.message}`, { status: 400 });
  }

  if (event.type === 'payment_intent.succeeded') {
    const paymentIntent = event.data.object as Stripe.PaymentIntent;
    const bookingId = paymentIntent.metadata?.bookingId;
    const availabilityId = paymentIntent.metadata?.availabilityId;
    const customerEmail = paymentIntent.metadata?.customerEmail;
    const customerName = paymentIntent.metadata?.customerName;

    console.log('💳 Processing payment_intent.succeeded:');
    console.log('- Payment Intent ID:', paymentIntent.id);
    console.log('- Booking ID:', bookingId);
    console.log('- Availability ID:', availabilityId);
    console.log('- Customer Email:', customerEmail);
    console.log('- Amount:', paymentIntent.amount, 'Currency:', paymentIntent.currency);

    if (!bookingId || !availabilityId) {
      console.error('❌ Webhook Error: Missing critical metadata');
      console.error('- bookingId present:', !!bookingId);
      console.error('- availabilityId present:', !!availabilityId);
      console.error('- Full metadata:', paymentIntent.metadata);
      return new Response('Webhook Error: Crucial metadata missing.', { status: 200 }); // Ack to Stripe
    }

    try {
      console.log('🔄 Starting database transaction...');
      
      const updatedBookingWithDetails = await prisma.$transaction(async (tx: Prisma.TransactionClient) => {
        console.log('📝 Updating booking record to paid...');
        
        const bookingRecord = await tx.booking.update({
          where: { id: bookingId },
          data: { paid: true },
          include: { availability: true },
        });

        if (!bookingRecord) {
          throw new Error(`Booking record ${bookingId} not found during update`);
        }
        if (!bookingRecord.availability) {
          throw new Error(`Availability details missing for booking ${bookingId}`);
        }

        console.log('✅ Booking updated successfully');
        console.log('🔗 Linking availability to booking...');

        // Update Availability to link it to the Booking
        await tx.availability.update({
          where: { id: availabilityId },
          data: { booking: { connect: { id: bookingId } } },
        });

        console.log('✅ Availability linked successfully');
        console.log('🔓 Releasing hold...');

        // Release the hold from the Hold table now that payment is confirmed
        try {
          const holdReleased = await releaseHold(availabilityId);
          if (holdReleased) {
            console.log('✅ Hold released successfully');
          } else {
            console.warn('⚠️ No hold found to release (may have been cleaned up already)');
          }
        } catch (holdError) {
          console.error('❌ Error releasing hold (non-critical):', holdError);
          // Don't throw - this is not critical enough to fail the entire transaction
        }
        
        return bookingRecord;
      });

      console.log('✅ Database transaction completed successfully');
      console.log('📧 Sending confirmation emails...');

      // Send emails after successful database transaction
      const bookingDetails = updatedBookingWithDetails;
      const availabilityDetails = bookingDetails.availability;

      // Send user confirmation email
      if (customerEmail && availabilityDetails) {
        console.log('📨 Sending user confirmation email to:', customerEmail);
        
        sendUserBookingConfirmationEmail({
          to: customerEmail,
          name: customerName || bookingDetails.name,
          bookingDate: availabilityDetails.date,
          bookingTime: availabilityDetails.startTime,
          midwifeName: availabilityDetails.midwife,
          bookingId: bookingDetails.id,
        }).then(() => {
          console.log('✅ User confirmation email sent successfully');
        }).catch(emailError => {
          console.error('❌ User confirmation email failed:', emailError.message);
        });
      } else {
        console.warn('⚠️ Skipping user confirmation email - missing email or availability details');
      }

      // Send admin notification email
      const teamEmail = process.env.TEAM_EMAIL_ADDRESS;
      if (teamEmail && availabilityDetails) {
        console.log('📨 Sending admin notification email to:', teamEmail);
        
        sendAdminBookingNotificationEmail({
          to: teamEmail,
          userName: bookingDetails.name,
          userEmail: bookingDetails.email,
          userPhone: bookingDetails.phone,
          bookingDate: availabilityDetails.date,
          bookingTime: availabilityDetails.startTime,
          midwifeName: availabilityDetails.midwife,
          bookingId: bookingDetails.id,
          bookingAmount: bookingDetails.amount,
        }).then(() => {
          console.log('✅ Admin notification email sent successfully');
        }).catch(emailError => {
          console.error('❌ Admin notification email failed:', emailError.message);
        });
      } else {
        console.warn('⚠️ Skipping admin notification email');
        console.warn('- TEAM_EMAIL_ADDRESS configured:', !!teamEmail);
        console.warn('- Availability details present:', !!availabilityDetails);
      }

      console.log('🎉 Payment confirmation completed successfully');

    } catch (dbError: any) {
      console.error('❌ Database transaction failed for booking:', bookingId);
      console.error('Error details:', dbError.message);
      console.error('Stack trace:', dbError.stack);
      
      if (dbError instanceof HoldError) {
        console.error('Hold-specific error:', dbError.code);
      }
      
      // Return error to Stripe so it will retry
      return new Response(`Webhook Database Error: ${dbError.message}`, { status: 500 });
    }
    
  } else if (event.type === 'payment_intent.payment_failed') {
    const paymentIntent = event.data.object as Stripe.PaymentIntent;
    const bookingId = paymentIntent.metadata?.bookingId;
    
    console.log('💥 Payment failed for booking:', bookingId);
    console.log('Failure reason:', paymentIntent.last_payment_error?.message);
    
    // Could implement cleanup logic here if needed
    
  } else {
    console.log('ℹ️ Received unhandled event type:', event.type);
  }

  return new Response(JSON.stringify({ received: true }), {
    status: 200, 
    headers: { 'Content-Type': 'application/json' },
  });
};