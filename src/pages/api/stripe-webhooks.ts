// File: src/pages/api/stripe-webhooks.ts
// Changes:
// - Imports and uses releaseHold from lib/holds.ts after successful payment.

import type { APIRoute } from 'astro';
import Stripe from 'stripe';
import { prisma } from '../../lib/prisma';
import { type Prisma } from '@prisma/client';
import { sendUserBookingConfirmationEmail, sendAdminBookingNotificationEmail } from '../../lib/email';
import { releaseHold, HoldError } from '../../lib/holds'; // Import releaseHold

const stripeSecretKey = process.env.STRIPE_SECRET_KEY;
const webhookSecret = process.env.STRIPE_WEBHOOK_SECRET;

if (!stripeSecretKey) console.error('Stripe webhook error: STRIPE_SECRET_KEY is not set.');
if (!webhookSecret) console.error('Stripe webhook error: STRIPE_WEBHOOK_SECRET is not set.');

const stripe = stripeSecretKey ? new Stripe(stripeSecretKey) : null;

export const POST: APIRoute = async ({ request }) => {
  if (!stripe || !webhookSecret) {
    console.error('Stripe webhook: Stripe or webhookSecret not initialized.');
    return new Response('Webhook Error: Server configuration error.', { status: 500 });
  }

  const signature = request.headers.get('stripe-signature');
  if (!signature) {
    console.error('Webhook Error: Missing Stripe signature.');
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

  if (event.type === 'payment_intent.succeeded') {
    const paymentIntent = event.data.object as Stripe.PaymentIntent;
    const bookingId = paymentIntent.metadata?.bookingId;
    const availabilityId = paymentIntent.metadata?.availabilityId; // Crucial for releasing the correct hold
    const customerEmail = paymentIntent.metadata?.customerEmail;
    const customerName = paymentIntent.metadata?.customerName;

    console.log(`Webhook: Processing PI succeeded for Booking ID: ${bookingId}, Availability ID: ${availabilityId}`);

    if (!bookingId || !availabilityId) {
      console.error(`Webhook Error: Missing bookingId or availabilityId in PI metadata. PI_ID: ${paymentIntent.id}`);
      return new Response('Webhook Error: Crucial metadata missing.', { status: 200 }); // Ack to Stripe
    }

    try {
      const updatedBookingWithDetails = await prisma.$transaction(async (tx: Prisma.TransactionClient) => {
        const bookingRecord = await tx.booking.update({
          where: { id: bookingId },
          data: { paid: true },
          include: { availability: true }, // For email content
        });

        if (!bookingRecord) {
             console.error(`Webhook DB Error: Booking record with ID ${bookingId} not found during transaction.`);
             throw new Error(`Booking record ${bookingId} not found.`);
        }
        if (!bookingRecord.availability) {
            console.error(`Webhook DB Error: Availability details not found for booking ${bookingId}.`);
            throw new Error(`Availability details missing for booking ${bookingId}.`);
        }

        // Update Availability to link it to the Booking
        await tx.availability.update({
          where: { id: availabilityId },
          data: { booking: { connect: { id: bookingId } } },
        });

        // Release the hold from the Hold table now that payment is confirmed
        const holdReleased = await releaseHold(availabilityId); // Calling releaseHold from lib/holds.ts
        if (holdReleased) {
          console.log(`Webhook: Hold for availabilityId ${availabilityId} released successfully after payment.`);
        } else {
          // This is not necessarily an error if the hold was already cleaned up or never existed for some reason
          console.warn(`Webhook: No hold found to release for availabilityId ${availabilityId} after payment, or it was already released.`);
        }
        
        return bookingRecord;
      });

      console.log(`Webhook: Booking ${bookingId} updated to paid, linked to availability ${availabilityId}.`);

      // Send emails after successful database transaction
      const bookingDetails = updatedBookingWithDetails;
      const availabilityDetails = bookingDetails.availability; // Already checked this exists in transaction

      if (customerEmail && availabilityDetails) {
        sendUserBookingConfirmationEmail({ // Intentionally not awaited to avoid blocking webhook response
          to: customerEmail,
          name: customerName || bookingDetails.name,
          bookingDate: availabilityDetails.date,
          bookingTime: availabilityDetails.startTime,
          midwifeName: availabilityDetails.midwife,
          bookingId: bookingDetails.id,
        }).catch(e => console.error(`Webhook Email Error (User Confirmation) for ${bookingId}: ${e.message}`));
      } else {
          console.warn(`Webhook: Could not send user confirmation for ${bookingId}: missing customerEmail or availabilityDetails.`);
      }

      const teamEmail = process.env.TEAM_EMAIL_ADDRESS;
      if (teamEmail && availabilityDetails) {
        sendAdminBookingNotificationEmail({ // Intentionally not awaited
          to: teamEmail,
          userName: bookingDetails.name,
          userEmail: bookingDetails.email,
          userPhone: bookingDetails.phone,
          bookingDate: availabilityDetails.date,
          bookingTime: availabilityDetails.startTime,
          midwifeName: availabilityDetails.midwife,
          bookingId: bookingDetails.id,
          bookingAmount: bookingDetails.amount,
        }).catch(e => console.error(`Webhook Email Error (Admin Notification) for ${bookingId}: ${e.message}`));
      } else {
          console.warn(`Webhook: Could not send admin notification for ${bookingId}: TEAM_EMAIL_ADDRESS not set or availabilityDetails missing.`);
      }

    } catch (dbError: any) {
      console.error(`Webhook DB Error for Booking ID ${bookingId}: ${dbError.message}`, dbError);
      if (dbError instanceof HoldError) { // Catch specific HoldError if it propagates
          console.error(`Webhook: HoldError during transaction for booking ${bookingId}: ${dbError.message}`);
      }
      return new Response(`Webhook Database Error: ${dbError.message}`, { status: 500 }); // Signal error to Stripe
    }
  } else {
    console.log(`Webhook: Received unhandled event type: ${event.type}`);
  }

  return new Response(JSON.stringify({ received: true }), {
    status: 200, headers: { 'Content-Type': 'application/json' },
  });
};
