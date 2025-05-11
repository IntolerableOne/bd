// File: src/pages/api/create-payment-intent.ts
// Changes:
// - Imports and uses createOrUpdateHold from lib/holds.ts.
// - Creates a Hold record before creating the Booking record.

import type { APIRoute } from 'astro';
import Stripe from 'stripe';
import { prisma } from '../../lib/prisma';
import { createOrUpdateHold, HoldError } from '../../lib/holds'; // Import hold functions

const stripeSecretKey = process.env.STRIPE_SECRET_KEY;
if (!stripeSecretKey) {
  console.error('Payment intent error: STRIPE_SECRET_KEY is not set.');
}
const stripe = stripeSecretKey ? new Stripe(stripeSecretKey) : null;

const HOLD_DURATION_MINUTES = 15; // Define hold duration, e.g., 15 minutes

export const POST: APIRoute = async ({ request }) => {
  if (!stripe) {
    console.error('Create payment intent called but Stripe is not initialized.');
    return new Response(JSON.stringify({ error: 'Payment processing is not configured on the server.' }), {
      status: 500, headers: { 'Content-Type': 'application/json' }
    });
  }

  try {
    const { slotId, name, email, phone } = await request.json();
    console.log('API: [/api/create-payment-intent] Received data:', { slotId, name, email, phone });

    if (!slotId || !name || !email || !phone) {
      return new Response(JSON.stringify({ error: 'Missing required fields (slotId, name, email, phone).' }), {
        status: 400, headers: { 'Content-Type': 'application/json' }
      });
    }

    // Step 1: Attempt to create or update a hold on the slot
    try {
      await createOrUpdateHold(slotId, HOLD_DURATION_MINUTES);
      console.log(`API: Hold placed successfully for slotId: ${slotId}`);
    } catch (holdError: any) {
      if (holdError instanceof HoldError) {
        console.warn(`API: Failed to place hold for slotId ${slotId}: ${holdError.message} (Code: ${holdError.code})`);
        // Map HoldError codes to appropriate HTTP status codes
        let statusCode = 400;
        if (holdError.code === 'SLOT_NOT_FOUND') statusCode = 404;
        if (holdError.code === 'SLOT_BOOKED' || holdError.code === 'ALREADY_HELD') statusCode = 409; // Conflict
        return new Response(JSON.stringify({ error: holdError.message, code: holdError.code }), {
          status: statusCode, headers: { 'Content-Type': 'application/json' }
        });
      }
      // For other unexpected errors during hold creation
      console.error(`API: Unexpected error placing hold for slotId ${slotId}:`, holdError);
      return new Response(JSON.stringify({ error: 'Failed to reserve time slot.', details: holdError.message }), {
        status: 500, headers: { 'Content-Type': 'application/json' }
      });
    }

    // Step 2: Create a preliminary booking record (marked as unpaid)
    // This record is created *after* a hold is successfully placed.
    console.log('API: Creating preliminary booking record for slotId:', slotId);
    const booking = await prisma.booking.create({
      data: {
        name,
        email,
        phone,
        availabilityId: slotId,
        amount: 10000, // Amount in pence (£100.00)
        paid: false,
      }
    });
    console.log('API: Preliminary booking record created with ID:', booking.id);

    // Step 3: Create Stripe payment intent
    console.log('API: Creating Stripe payment intent for booking ID:', booking.id);
    const paymentIntent = await stripe.paymentIntents.create({
      amount: booking.amount,
      currency: 'gbp',
      metadata: {
        bookingId: booking.id,
        availabilityId: slotId, // Keep availabilityId for easy access in webhook
        customerName: name,
        customerEmail: email,
      },
      description: `Birth Debrief Consultation - Booking ID: ${booking.id}`,
    });

    console.log('API: Stripe payment intent created successfully:', paymentIntent.id);
    return new Response(JSON.stringify({
      clientSecret: paymentIntent.client_secret,
      bookingId: booking.id
    }), {
      status: 200, headers: { 'Content-Type': 'application/json' }
    });

  } catch (error: any) {
    console.error('API: [/api/create-payment-intent] Error:', error);
    let errorMessage = 'Failed to create payment intent.';
    let statusCode = 500;

    if (error instanceof Stripe.errors.StripeError) {
      errorMessage = error.message || 'A Stripe error occurred.';
      statusCode = error.statusCode || 500;
    } else if (error.code === 'P2002' && error.meta?.target?.includes('availabilityId')) {
      // Prisma unique constraint error on Booking.availabilityId (should be caught by hold check ideally)
      errorMessage = 'This time slot was just booked. Please select another.';
      statusCode = 409; // Conflict
    } else if (error.message) {
        errorMessage = error.message;
    }

    // If an error occurs after hold placement but before payment intent creation,
    // the hold will eventually expire and be cleaned up by the cron job.
    // Or, if the user cancels, the cancellation endpoint should try to release it.

    return new Response(JSON.stringify({
      error: 'Failed to initiate payment.',
      details: errorMessage
    }), {
      status: statusCode, headers: { 'Content-Type': 'application/json' }
    });
  }
};
