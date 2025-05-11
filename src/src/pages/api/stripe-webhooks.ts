// File: src/pages/api/stripe-webhooks.ts
// Changes:
// - Corrected the Prisma update for Availability to use the 'booking' relation field
//   with a 'connect' operation, instead of trying to set 'bookingId' directly in data.

import type { APIRoute } from 'astro';
import Stripe from 'stripe';
import { prisma } from '../../lib/prisma';
import { type Prisma } from '@prisma/client'; // Import Prisma namespace for types
import { sendBookingConfirmationEmail } from '../../lib/email';

const stripeSecretKey = process.env.STRIPE_SECRET_KEY;
const webhookSecret = process.env.STRIPE_WEBHOOK_SECRET;

if (!stripeSecretKey) {
  console.error('Stripe webhook error: STRIPE_SECRET_KEY is not set.');
}
if (!webhookSecret) {
  console.error('Stripe webhook error: STRIPE_WEBHOOK_SECRET is not set.');
}

const stripe = stripeSecretKey ? new Stripe(stripeSecretKey) : null;

export const POST: APIRoute = async ({ request }) => {
  if (!stripe || !webhookSecret) {
    console.error('Stripe webhook endpoint called but Stripe or webhookSecret is not initialized.');
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
    const availabilityId = paymentIntent.metadata?.availabilityId;
    const customerEmail = paymentIntent.metadata?.customerEmail;
    const customerName = paymentIntent.metadata?.customerName;

    console.log(`Processing successful payment for bookingId: ${bookingId}, availabilityId: ${availabilityId}`);

    if (!bookingId || !availabilityId) {
      console.error(`Webhook Error: Missing bookingId or availabilityId in paymentIntent metadata for PI_ID: ${paymentIntent.id}`);
      // Acknowledge receipt to Stripe to prevent retries for this specific issue.
      return new Response('Webhook Error: Missing bookingId or availabilityId in metadata.', { status: 200 });
    }

    try {
      // Use Prisma.TransactionClient for the type of 'tx'
      const updatedBooking = await prisma.$transaction(async (tx: Prisma.TransactionClient) => {
        // Step 1: Update the Booking to mark it as paid
        const booking = await tx.booking.update({
          where: { id: bookingId },
          data: { paid: true },
          include: { availability: true } // Include availability for the email confirmation
        });

        if (!booking.availability) {
            // This case implies that the booking's availabilityId was null or invalid,
            // which should ideally be caught before this stage.
            console.error(`Critical Error: Availability relation not found for booking ${bookingId} after update.`);
            throw new Error(`Availability data missing for booking ${bookingId}. Cannot link availability.`);
        }

        // Step 2: Update the Availability to link it to the now-paid Booking
        // This is the corrected part: using the relation field 'booking' and 'connect'.
        await tx.availability.update({
          where: { id: availabilityId },
          data: {
            booking: { // Use the relation field name (likely 'booking')
              connect: { id: bookingId } // Connect to the Booking record by its ID
            }
          },
        });

        // Step 3: Delete any hold records associated with this availability slot
        await tx.hold.deleteMany({
            where: { availabilityId: availabilityId }
        });

        return booking; // Return the updated booking with its included availability
      });

      console.log(`Booking ${bookingId} successfully updated to paid and linked to availability ${availabilityId}. Hold released.`);

      // Send confirmation email if customer email and booking details are available
      if (customerEmail && updatedBooking.availability) {
        try {
          await sendBookingConfirmationEmail({
            to: customerEmail,
            name: customerName || updatedBooking.name, // Use name from metadata or booking
            bookingDate: updatedBooking.availability.date,
            bookingTime: updatedBooking.availability.startTime,
            midwifeName: updatedBooking.availability.midwife, // Assuming midwife is on availability
            bookingId: updatedBooking.id,
          });
          console.log(`Booking confirmation email sent to ${customerEmail} for booking ${bookingId}.`);
        } catch (emailError: any) {
          // Log email sending failure but don't let it fail the webhook processing
          console.error(`Failed to send confirmation email for booking ${bookingId}: ${emailError.message}`, emailError);
        }
      } else {
        console.warn(`Could not send confirmation email for booking ${bookingId}: missing customer email or booking.availability details.`);
      }

    } catch (dbError: any) {
      console.error(`Database error updating booking ${bookingId}: ${dbError.message}`, dbError);
      // Return a 500 error to Stripe, indicating an internal server error.
      // Stripe will attempt to resend the webhook for server-side issues.
      return new Response(`Webhook Database Error: ${dbError.message}`, { status: 500 });
    }
  } else {
    // Log other event types if needed
    console.log(`Received unhandled event type: ${event.type}`);
  }

  // Acknowledge receipt of the event to Stripe
  return new Response(JSON.stringify({ received: true }), {
    status: 200,
    headers: { 'Content-Type': 'application/json' },
  });
};
