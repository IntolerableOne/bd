// File: src/pages/api/create-payment-intent.ts
// Changes:
// - Added 'releaseHold' to the import from lib/holds.ts.
// - Imports and uses createOrUpdateHold from lib/holds.ts.
// - Creates a Hold record before creating the Booking record.

import type { APIRoute } from 'astro';
import Stripe from 'stripe';
import { prisma } from '../../lib/prisma';
import { createOrUpdateHold, releaseHold, HoldError } from '../../lib/holds'; // Import releaseHold

const stripeSecretKey = process.env.STRIPE_SECRET_KEY;
if (!stripeSecretKey) {
  console.error('Payment intent error: STRIPE_SECRET_KEY is not set.');
  // Consider how to handle this globally if Stripe is essential
}
const stripe = stripeSecretKey ? new Stripe(stripeSecretKey) : null;

const HOLD_DURATION_MINUTES = 15; // Define hold duration, e.g., 15 minutes

export const POST: APIRoute = async ({ request }) => {
  if (!stripe) {
    console.error('Create payment intent called but Stripe is not initialized. Check STRIPE_SECRET_KEY.');
    return new Response(JSON.stringify({ error: 'Payment processing is not configured on the server.' }), {
      status: 503, headers: { 'Content-Type': 'application/json' } // Service Unavailable
    });
  }

  let slotIdForHoldRelease: string | null = null; // To attempt hold release on failure

  try {
    const { slotId, name, email, phone } = await request.json();
    slotIdForHoldRelease = slotId; // Assign early for potential cleanup
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
      // This catch block is specifically for errors from createOrUpdateHold
      if (holdError instanceof HoldError) {
        console.warn(`API: Failed to place hold for slotId ${slotId}: ${holdError.message} (Code: ${holdError.code})`);
        let statusCode = 400; // Default to Bad Request
        if (holdError.code === 'SLOT_NOT_FOUND') statusCode = 404;
        if (holdError.code === 'SLOT_BOOKED' || holdError.code === 'ALREADY_HELD') statusCode = 409; // Conflict
        return new Response(JSON.stringify({ error: holdError.message, code: holdError.code }), {
          status: statusCode, headers: { 'Content-Type': 'application/json' }
        });
      }
      // For other unexpected errors during hold creation
      console.error(`API: Unexpected error placing hold for slotId ${slotId}:`, holdError);
      return new Response(JSON.stringify({ error: 'Failed to reserve time slot due to an internal error.', details: holdError.message }), {
        status: 500, headers: { 'Content-Type': 'application/json' }
      });
    }

    // Step 2: Create a preliminary booking record (marked as unpaid)
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
        availabilityId: slotId,
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
    console.error('API: [/api/create-payment-intent] General Error:', error);
    let errorMessage = 'Failed to create payment intent.';
    let statusCode = 500;

    // Attempt to release the hold if one was placed and an error occurred afterwards
    // This is a best-effort cleanup. The cron job is the more reliable cleanup mechanism.
    if (slotIdForHoldRelease) {
        console.log(`API: Attempting to release hold for ${slotIdForHoldRelease} due to error in payment intent creation.`);
        try {
            // Ensure releaseHold is imported and available
            await releaseHold(slotIdForHoldRelease);
            console.log(`API: Hold for ${slotIdForHoldRelease} released after error.`);
        } catch (releaseError: any) {
            console.error(`API: Failed to auto-release hold for ${slotIdForHoldRelease} after error:`, releaseError);
        }
    }


    if (error instanceof Stripe.errors.StripeError) {
      errorMessage = error.message || 'A Stripe error occurred.';
      statusCode = error.statusCode || 500;
    } else if (error.code === 'P2002' && error.meta?.target?.includes('availabilityId')) {
      // This error means a booking with this availabilityId already exists.
      // The hold logic should ideally prevent this, but this is a safeguard.
      errorMessage = 'This time slot was just booked. Please select another.';
      statusCode = 409; // Conflict
    } else if (error.message) {
        errorMessage = error.message;
    }

    return new Response(JSON.stringify({
      error: 'Failed to initiate payment.',
      details: errorMessage
    }), {
      status: statusCode, headers: { 'Content-Type': 'application/json' }
    });
  }
};
