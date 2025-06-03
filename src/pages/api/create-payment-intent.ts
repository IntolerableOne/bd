import type { APIRoute } from 'astro';
import Stripe from 'stripe';
import { prisma } from '../../lib/prisma';
import { createOrUpdateHold, releaseHold, HoldError } from '../../lib/holds';
import { z } from 'zod';

const stripeSecretKey = process.env.STRIPE_SECRET_KEY;
if (!stripeSecretKey) {
  console.error('CRITICAL: STRIPE_SECRET_KEY is not set.');
}
const stripe = stripeSecretKey ? new Stripe(stripeSecretKey) : null;

const HOLD_DURATION_MINUTES = 15;

// Input validation schema
const createPaymentIntentSchema = z.object({
  slotId: z.string().min(1, 'Slot ID is required'),
  name: z.string().min(1, 'Name is required').max(100, 'Name too long'),
  email: z.string().email('Invalid email address').max(100, 'Email too long'),
  phone: z.string().min(1, 'Phone number is required').max(20, 'Phone number too long')
});

export const POST: APIRoute = async ({ request }) => {
  if (!stripe) {
    console.error('Create payment intent called but Stripe is not initialized. Check STRIPE_SECRET_KEY.');
    return new Response(JSON.stringify({ error: 'Payment processing is not configured on the server.' }), {
      status: 503, headers: { 'Content-Type': 'application/json' }
    });
  }

  let slotIdForHoldRelease: string | null = null;

  try {
    // Parse and validate input
    const rawData = await request.json().catch(() => null);
    if (!rawData) {
      return new Response(JSON.stringify({ error: 'Invalid JSON in request body.' }), {
        status: 400, headers: { 'Content-Type': 'application/json' }
      });
    }

    const validationResult = createPaymentIntentSchema.safeParse(rawData);
    if (!validationResult.success) {
      console.error('❌ Validation failed:', validationResult.error.flatten().fieldErrors);
      return new Response(JSON.stringify({ 
        error: 'Invalid input data.',
        details: validationResult.error.flatten().fieldErrors
      }), {
        status: 400, headers: { 'Content-Type': 'application/json' }
      });
    }

    const { slotId, name, email, phone } = validationResult.data;
    slotIdForHoldRelease = slotId;
    
    console.log('API: [/api/create-payment-intent] Processing validated data:', { slotId, name, email, phone });

    // Step 1: Check slot availability and create hold
    try {
      await createOrUpdateHold(slotId, HOLD_DURATION_MINUTES);
      console.log(`✅ Hold placed successfully for slotId: ${slotId}`);
    } catch (holdError: any) {
      if (holdError instanceof HoldError) {
        console.warn(`❌ Failed to place hold for slotId ${slotId}: ${holdError.message} (Code: ${holdError.code})`);
        let statusCode = 400;
        if (holdError.code === 'SLOT_NOT_FOUND') statusCode = 404;
        if (holdError.code === 'SLOT_BOOKED' || holdError.code === 'ALREADY_HELD') statusCode = 409;
        return new Response(JSON.stringify({ error: holdError.message, code: holdError.code }), {
          status: statusCode, headers: { 'Content-Type': 'application/json' }
        });
      }
      console.error(`❌ Unexpected error placing hold for slotId ${slotId}:`, holdError);
      return new Response(JSON.stringify({ error: 'Failed to reserve time slot due to an internal error.', details: holdError.message }), {
        status: 500, headers: { 'Content-Type': 'application/json' }
      });
    }

    // Step 2: Create booking record
    console.log('📝 Creating preliminary booking record for slotId:', slotId);
    const booking = await prisma.booking.create({
      data: {
        name: name.trim(),
        email: email.toLowerCase().trim(),
        phone: phone.trim(),
        availabilityId: slotId,
        amount: 10000, // Amount in pence (£100.00)
        paid: false,
      }
    });
    console.log('✅ Preliminary booking record created with ID:', booking.id);

    // Step 3: Create Stripe payment intent
    console.log('💳 Creating Stripe payment intent for booking ID:', booking.id);
    const paymentIntent = await stripe.paymentIntents.create({
      amount: booking.amount,
      currency: 'gbp',
      automatic_payment_methods: {
        enabled: true,
      },
      metadata: {
        bookingId: booking.id,
        availabilityId: slotId,
        customerName: name,
        customerEmail: email,
      },
      description: `Birth Debrief Consultation - Booking ID: ${booking.id}`,
    });

    console.log('✅ Stripe payment intent created successfully:', paymentIntent.id);
    return new Response(JSON.stringify({
      clientSecret: paymentIntent.client_secret,
      bookingId: booking.id
    }), {
      status: 200, headers: { 'Content-Type': 'application/json' }
    });

  } catch (error: any) {
    console.error('❌ [/api/create-payment-intent] General Error:', error);
    let errorMessage = 'Failed to create payment intent.';
    let statusCode = 500;

    // Release hold on error
    if (slotIdForHoldRelease) {
      console.log(`🔄 Attempting to release hold for ${slotIdForHoldRelease} due to error.`);
      try {
        await releaseHold(slotIdForHoldRelease);
        console.log(`✅ Hold for ${slotIdForHoldRelease} released after error.`);
      } catch (releaseError: any) {
        console.error(`❌ Failed to auto-release hold for ${slotIdForHoldRelease}:`, releaseError);
      }
    }

    if (error instanceof Stripe.errors.StripeError) {
      errorMessage = error.message || 'A Stripe error occurred.';
      statusCode = error.statusCode || 500;
    } else if (error.code === 'P2002' && error.meta?.target?.includes('availabilityId')) {
      errorMessage = 'This time slot was just booked. Please select another.';
      statusCode = 409;
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