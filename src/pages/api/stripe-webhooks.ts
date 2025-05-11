// File: src/pages/api/stripe-webhooks.ts
// Changes:
// - Integrated calls to sendUserBookingConfirmationEmail and sendAdminBookingNotificationEmail.
// - Retrieves necessary data from paymentIntent metadata and database for emails.

import type { APIRoute } from 'astro';
import Stripe from 'stripe';
import { prisma } from '../../lib/prisma';
import { type Prisma } from '@prisma/client';
import { sendUserBookingConfirmationEmail, sendAdminBookingNotificationEmail } from '../../lib/email'; // Import both functions

const stripeSecretKey = process.env.STRIPE_SECRET_KEY;
const webhookSecret = process.env.STRIPE_WEBHOOK_SECRET;

// Ensure Stripe is initialized only if the key is available
if (!stripeSecretKey) {
  console.error('Stripe webhook error: STRIPE_SECRET_KEY is not set in environment variables.');
}
if (!webhookSecret) {
  console.error('Stripe webhook error: STRIPE_WEBHOOK_SECRET is not set in environment variables.');
}
const stripe = stripeSecretKey ? new Stripe(stripeSecretKey) : null;

export const POST: APIRoute = async ({ request }) => {
  if (!stripe || !webhookSecret) {
    console.error('Stripe webhook endpoint called but Stripe or webhookSecret is not initialized. Check server configuration.');
    return new Response('Webhook Error: Server configuration error. Payment processing unavailable.', { status: 500 });
  }

  const signature = request.headers.get('stripe-signature');
  if (!signature) {
    console.error('Webhook Error: Missing Stripe signature in request headers.');
    return new Response('Webhook Error: Missing Stripe signature.', { status: 400 });
  }

  let event: Stripe.Event;
  try {
    const body = await request.text();
    event = stripe.webhooks.constructEvent(body, signature, webhookSecret);
  } catch (err: any) {
    console.error(`Webhook signature verification failed: ${err.message}`, err);
    return new Response(`Webhook Error: ${err.message}`, { status: 400 });
  }

  // Handle the payment_intent.succeeded event
  if (event.type === 'payment_intent.succeeded') {
    const paymentIntent = event.data.object as Stripe.PaymentIntent;
    
    // Extract data from Payment Intent metadata
    const bookingId = paymentIntent.metadata?.bookingId;
    const availabilityId = paymentIntent.metadata?.availabilityId;
    const customerEmail = paymentIntent.metadata?.customerEmail; // Email for user confirmation
    const customerName = paymentIntent.metadata?.customerName;   // Name for user confirmation

    console.log(`Webhook: Processing successful payment for Booking ID: ${bookingId}, Availability ID: ${availabilityId}`);

    if (!bookingId || !availabilityId) {
      console.error(`Webhook Error: Missing bookingId or availabilityId in Payment Intent metadata. PI_ID: ${paymentIntent.id}`);
      return new Response('Webhook Error: Crucial metadata (bookingId or availabilityId) missing from Payment Intent.', { status: 200 }); // Acknowledge to Stripe
    }

    try {
      // Use Prisma transaction to ensure atomicity
      const updatedBookingWithDetails = await prisma.$transaction(async (tx: Prisma.TransactionClient) => {
        // Step 1: Update the Booking to mark it as paid
        const bookingRecord = await tx.booking.update({
          where: { id: bookingId },
          data: { paid: true },
          include: {
            availability: true, // Include availability to get date, time, midwife for emails
          },
        });

        if (!bookingRecord) {
            console.error(`Webhook DB Error: Booking record with ID ${bookingId} not found for update.`);
            throw new Error(`Booking record ${bookingId} not found.`);
        }
        if (!bookingRecord.availability) {
            console.error(`Webhook DB Error: Availability details not found for booking ${bookingId}. Cannot proceed with linking or email notifications.`);
            throw new Error(`Availability details missing for booking ${bookingId}.`);
        }

        // Step 2: Update the Availability to link it to the now-paid Booking
        await tx.availability.update({
          where: { id: availabilityId },
          data: {
            booking: {
              connect: { id: bookingId },
            },
          },
        });

        // Step 3: Delete any hold records associated with this availability slot
        await tx.hold.deleteMany({
          where: { availabilityId: availabilityId },
        });

        return bookingRecord; // Return the booking with its included availability
      });

      console.log(`Webhook: Booking ${bookingId} successfully updated to paid and linked to availability ${availabilityId}. Associated hold released.`);

      // Step 4: Send Emails (after successful DB transaction)
      const bookingDetails = updatedBookingWithDetails; // Renaming for clarity
      const availabilityDetails = bookingDetails.availability; // Already checked this exists

      // Send User Confirmation Email
      if (customerEmail && availabilityDetails) {
        try {
          await sendUserBookingConfirmationEmail({
            to: customerEmail,
            name: customerName || bookingDetails.name, // Use metadata name or fallback to booking name
            bookingDate: availabilityDetails.date,
            bookingTime: availabilityDetails.startTime,
            midwifeName: availabilityDetails.midwife,
            bookingId: bookingDetails.id,
          });
          console.log(`Webhook: User booking confirmation email successfully queued for ${customerEmail} (Booking ID: ${bookingId}).`);
        } catch (emailError: any) {
          console.error(`Webhook Email Error: Failed to send user confirmation for Booking ID ${bookingId}: ${emailError.message}`, emailError);
          // Log error, but don't fail the webhook for this.
        }
      } else {
        console.warn(`Webhook Email Warning: Could not send user confirmation for Booking ID ${bookingId} due to missing customer email or availability details.`);
      }

      // Send Admin/Team Notification Email
      const teamEmail = process.env.TEAM_EMAIL_ADDRESS;
      if (teamEmail && availabilityDetails) {
        try {
          await sendAdminBookingNotificationEmail({
            to: teamEmail,
            userName: bookingDetails.name,
            userEmail: bookingDetails.email, // Email from booking record
            userPhone: bookingDetails.phone, // Phone from booking record
            bookingDate: availabilityDetails.date,
            bookingTime: availabilityDetails.startTime,
            midwifeName: availabilityDetails.midwife,
            bookingId: bookingDetails.id,
            bookingAmount: bookingDetails.amount, // Amount in pence from booking record
          });
          console.log(`Webhook: Admin new booking notification successfully queued for ${teamEmail} (Booking ID: ${bookingId}).`);
        } catch (emailError: any) {
          console.error(`Webhook Email Error: Failed to send admin notification for Booking ID ${bookingId}: ${emailError.message}`, emailError);
        }
      } else {
        console.warn(`Webhook Email Warning: Could not send admin notification for Booking ID ${bookingId}. TEAM_EMAIL_ADDRESS not set or availability details missing.`);
      }

    } catch (dbError: any) {
      console.error(`Webhook Database Error: Failed to update database for Booking ID ${bookingId}: ${dbError.message}`, dbError);
      return new Response(`Webhook Database Error: ${dbError.message}`, { status: 500 }); // Signal server error to Stripe
    }
  } else {
    // Handle other event types if necessary
    console.log(`Webhook: Received unhandled event type: ${event.type}`);
  }

  // Acknowledge receipt of the event to Stripe
  return new Response(JSON.stringify({ received: true }), {
    status: 200,
    headers: { 'Content-Type': 'application/json' },
  });
};
