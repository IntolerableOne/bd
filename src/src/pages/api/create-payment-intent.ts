// File: src/pages/api/create-payment-intent.ts
// Changes: Switched to process.env for STRIPE_SECRET_KEY. Added more logging.

import type { APIRoute } from 'astro';
import Stripe from 'stripe';
import { prisma } from '../../lib/prisma';
// createHold is not explicitly called here anymore as holds are more complex
// and their creation might be better tied to the booking record itself if not using a separate Hold table.
// For now, we assume a slot is "held" by virtue of a `Booking` record with `paid: false`.
// If you have a separate `Hold` table and logic, you'd re-integrate `createHold` from `../../lib/holds`.

const stripeSecretKey = process.env.STRIPE_SECRET_KEY;
if (!stripeSecretKey) {
  console.error('Payment intent error: STRIPE_SECRET_KEY is not set.');
}
const stripe = stripeSecretKey ? new Stripe(stripeSecretKey) : null;

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
      console.log('API: Missing required fields:', { slotId, name, email, phone });
      return new Response(JSON.stringify({ error: 'Missing required fields (slotId, name, email, phone).' }), {
        status: 400, headers: { 'Content-Type': 'application/json' }
      });
    }

    console.log('API: Checking availability for slotId:', slotId);
    const availability = await prisma.availability.findUnique({
      where: { id: slotId },
      include: { booking: true } // Check if already booked
    });

    if (!availability) {
      console.log('API: Slot not found:', slotId);
      return new Response(JSON.stringify({ error: 'Selected time slot not found.' }), {
        status: 404, headers: { 'Content-Type': 'application/json' }
      });
    }

    if (availability.booking) {
      // This means another booking (paid or unpaid) is already linked to this slot.
      console.log('API: Slot already booked or pending payment:', slotId, 'Existing booking ID:', availability.booking.id);
      return new Response(JSON.stringify({ error: 'This time slot is already booked or pending payment.' }), {
        status: 409, // Conflict
        headers: { 'Content-Type': 'application/json' }
      });
    }
    
    // Check if slot is in the past (more robust check)
    const slotDateTime = new Date(availability.date);
    const [hours, minutes] = availability.startTime.split(':');
    slotDateTime.setHours(parseInt(hours), parseInt(minutes), 0, 0);

    const minBookingTime = new Date(Date.now() + 1 * 60 * 60 * 1000); // e.g., 1 hour in advance minimum

    if (slotDateTime < minBookingTime) {
        console.log('API: Slot is in the past or too soon to book:', slotId);
        return new Response(JSON.stringify({ error: 'This time slot is no longer available or is too soon to book.' }), {
            status: 400, headers: { 'Content-Type': 'application/json' }
        });
    }


    // Create a preliminary booking record (marked as unpaid)
    // This record "holds" the slot. If payment fails or is abandoned, this needs cleanup.
    console.log('API: Creating preliminary booking record...');
    const booking = await prisma.booking.create({
      data: {
        name,
        email,
        phone,
        availabilityId: slotId,
        amount: 10000, // Amount in pence (£100.00)
        paid: false, // Mark as unpaid initially
        // You might want to add an expiry time to this unpaid booking
        // expiresAt: new Date(Date.now() + 15 * 60 * 1000), // e.g., 15 minutes
      }
    });
    console.log('API: Preliminary booking record created with ID:', booking.id);

    // Create Stripe payment intent
    console.log('API: Creating Stripe payment intent for booking ID:', booking.id);
    const paymentIntent = await stripe.paymentIntents.create({
      amount: booking.amount, // Use amount from booking record
      currency: 'gbp',
      metadata: {
        bookingId: booking.id,
        availabilityId: slotId,
        customerName: name,
        customerEmail: email,
        // Add any other relevant metadata
      },
      // You can add payment_method_types or let Stripe decide
      // payment_method_types: ['card', 'link'],
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
    if (error instanceof Stripe.errors.StripeError) {
      console.error('API: Stripe error details:', { type: error.type, code: error.code, message: error.message });
      errorMessage = error.message || 'A Stripe error occurred.';
    } else if (error.code === 'P2002' && error.meta?.target?.includes('availabilityId')) {
      // Prisma unique constraint error on Booking.availabilityId
      errorMessage = 'This time slot was just booked. Please select another.';
      return new Response(JSON.stringify({ error: errorMessage }), {
        status: 409, headers: { 'Content-Type': 'application/json' }
      });
    } else if (error.message) {
        errorMessage = error.message;
    }

    return new Response(JSON.stringify({
      error: 'Failed to initiate payment.',
      details: errorMessage
    }), {
      status: 500, headers: { 'Content-Type': 'application/json' }
    });
  }
};
