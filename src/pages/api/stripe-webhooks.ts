import type { APIRoute } from 'astro';
import Stripe from 'stripe';
import { prisma } from '../../lib/prisma';
import { type Prisma } from '@prisma/client';
import { sendUserBookingConfirmationEmail, sendAdminBookingNotificationToTeam } from '../../lib/email';
import { releaseHold, HoldError } from '../../lib/holds';

const stripeSecretKey = process.env.STRIPE_SECRET_KEY;
const webhookSecret = process.env.STRIPE_WEBHOOK_SECRET;

if (!stripeSecretKey) console.error('CRITICAL: STRIPE_SECRET_KEY is not set.');
if (!webhookSecret) console.error('CRITICAL: STRIPE_WEBHOOK_SECRET is not set.');

const stripe = stripeSecretKey ? new Stripe(stripeSecretKey) : null;

export const POST: APIRoute = async ({ request }) => {
  console.log('🎯 Webhook received at:', new Date().toISOString());
  
  if (!stripe || !webhookSecret) {
    console.error('❌ Stripe webhook: Missing configuration');
    return new Response('Webhook Error: Server configuration error.', { status: 500 });
  }

  const signature = request.headers.get('stripe-signature');
  if (!signature) {
    console.error('❌ Webhook Error: Missing Stripe signature header');
    return new Response('Webhook Error: Missing Stripe signature.', { status: 400 });
  }

  let event: Stripe.Event;
  
  try {
    const rawBody = await request.text();
    event = stripe.webhooks.constructEvent(rawBody, signature, webhookSecret);
    console.log('✅ Webhook signature verified successfully');
    console.log('📋 Event type:', event.type, 'ID:', event.id);
  } catch (err: any) {
    console.error('❌ Webhook signature verification failed:', err.message);
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
    console.log('- Amount:', paymentIntent.amount, paymentIntent.currency);

    if (!bookingId || !availabilityId) {
      console.error('❌ Webhook Error: Missing critical metadata');
      return new Response('Webhook Error: Crucial metadata missing.', { status: 200 });
    }

    try {
      console.log('🔄 Starting database transaction...');
      
      const updatedBookingWithDetails = await prisma.$transaction(async (tx: Prisma.TransactionClient) => {
        console.log('📝 Updating booking record...');
        
        const bookingRecord = await tx.booking.update({
          where: { id: bookingId },
          data: { 
            paid: true,
            status: 'CONFIRMED',
            stripePaymentId: paymentIntent.id
          },
          include: { availability: true },
        });

        if (!bookingRecord || !bookingRecord.availability) {
          throw new Error(`Booking record ${bookingId} not found or missing availability`);
        }

        console.log('✅ Booking updated to CONFIRMED status');
        console.log('🔗 Linking availability to booking...');

        await tx.availability.update({
          where: { id: availabilityId },
          data: { booking: { connect: { id: bookingId } } },
        });

        console.log('🔓 Releasing hold...');
        try {
          const holdReleased = await releaseHold(availabilityId);
          if (holdReleased) {
            console.log('✅ Hold released successfully');
          } else {
            console.warn('⚠️ No hold found to release');
          }
        } catch (holdError) {
          console.error('❌ Error releasing hold (non-critical):', holdError);
        }
        
        return bookingRecord;
      });

      console.log('✅ Database transaction completed successfully');
      console.log('📧 Sending confirmation emails...');

      // Send emails
      const bookingDetails = updatedBookingWithDetails;
      const availabilityDetails = bookingDetails.availability;

      // Send user confirmation email
      if (customerEmail && availabilityDetails) {
        sendUserBookingConfirmationEmail({
          to: customerEmail,
          name: customerName || bookingDetails.name,
          bookingDate: availabilityDetails.date,
          bookingTime: availabilityDetails.startTime,
          midwifeName: availabilityDetails.midwife,
          bookingId: bookingDetails.id,
        }).then(() => {
          console.log('✅ User confirmation email sent');
        }).catch(emailError => {
          console.error('❌ User confirmation email failed:', emailError.message);
        });
      }

      // Send admin notification to entire team
      if (availabilityDetails) {
        sendAdminBookingNotificationToTeam({
          userName: bookingDetails.name,
          userEmail: bookingDetails.email,
          userPhone: bookingDetails.phone,
          bookingDate: availabilityDetails.date,
          bookingTime: availabilityDetails.startTime,
          midwifeName: availabilityDetails.midwife,
          bookingId: bookingDetails.id,
          bookingAmount: bookingDetails.amount,
        }).then(() => {
          console.log('✅ Team notification emails sent');
        }).catch(emailError => {
          console.error('❌ Team notification emails failed:', emailError.message);
        });
      }

      console.log('🎉 Payment confirmation completed successfully');

    } catch (dbError: any) {
      console.error('❌ Database transaction failed:', dbError.message);
      return new Response(`Webhook Database Error: ${dbError.message}`, { status: 500 });
    }
    
  } else if (event.type === 'payment_intent.payment_failed') {
    const paymentIntent = event.data.object as Stripe.PaymentIntent;
    const bookingId = paymentIntent.metadata?.bookingId;
    
    console.log('💥 Payment failed for booking:', bookingId);
    
    if (bookingId) {
      try {
        // Update booking status to CANCELLED (don't delete - keep for follow-up)
        await prisma.booking.update({
          where: { id: bookingId },
          data: { 
            status: 'CANCELLED',
            stripePaymentId: paymentIntent.id
          }
        });
        console.log('📝 Booking status updated to CANCELLED');
      } catch (error) {
        console.error('❌ Failed to update booking status:', error);
      }
    }
    
  } else {
    console.log('ℹ️ Received unhandled event type:', event.type);
  }

  return new Response(JSON.stringify({ received: true }), {
    status: 200, 
    headers: { 'Content-Type': 'application/json' },
  });
};