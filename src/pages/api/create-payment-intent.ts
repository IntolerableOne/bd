import type { APIRoute } from 'astro';
import Stripe from 'stripe';
import { prisma } from '../../lib/prisma';
import { createHold } from '../../lib/holds';

const stripe = new Stripe(import.meta.env.STRIPE_SECRET_KEY);

export const POST: APIRoute = async ({ request }) => {
  try {
    console.log('Starting payment intent creation...');
    
    // Log environment variables (remove sensitive parts)
    console.log('Environment check:', {
      hasStripeKey: !!import.meta.env.STRIPE_SECRET_KEY,
      hasDbUrl: !!import.meta.env.DATABASE_URL,
      nodeEnv: process.env.NODE_ENV
    });

    const { slotId, name, email, phone } = await request.json();
    console.log('Received data:', { slotId, name, email, phone });

    // Validate input
    if (!slotId || !name || !email || !phone) {
      console.log('Missing required fields:', { slotId, name, email, phone });
      return new Response(
        JSON.stringify({ error: 'Missing required fields' }),
        { 
          status: 400,
          headers: { 'Content-Type': 'application/json' }
        }
      );
    }

    console.log('Checking availability...');
    // Check if slot exists and is available
    const availability = await prisma.availability.findUnique({
      where: { id: slotId },
      include: { booking: true }
    });

    if (!availability) {
      console.log('Slot not found:', slotId);
      return new Response(
        JSON.stringify({ error: 'Time slot not found' }),
        { 
          status: 404,
          headers: { 'Content-Type': 'application/json' }
        }
      );
    }

    if (availability.booking) {
      console.log('Slot already booked:', slotId);
      return new Response(
        JSON.stringify({ error: 'Time slot already booked' }),
        { 
          status: 400,
          headers: { 'Content-Type': 'application/json' }
        }
      );
    }

    console.log('Creating hold...');
    // Create hold
    await createHold(slotId);

    console.log('Creating booking record...');
    // Create booking record
    const booking = await prisma.booking.create({
      data: {
        name,
        email,
        phone,
        availabilityId: slotId,
        amount: 10000,
        paid: false
      }
    });

    console.log('Creating Stripe payment intent...');
    // Create payment intent
    const paymentIntent = await stripe.paymentIntents.create({
      amount: 10000,
      currency: 'gbp',
      metadata: {
        bookingId: booking.id,
        availabilityId: slotId,
        customerName: name,
        customerEmail: email
      }
    });

    console.log('Payment intent created successfully');
    return new Response(
      JSON.stringify({ 
        clientSecret: paymentIntent.client_secret,
        bookingId: booking.id 
      }),
      { 
        status: 200,
        headers: { 'Content-Type': 'application/json' }
      }
    );
  } catch (error) {
    console.error('Payment intent error:', error);
    // Log full error details in development
    if (process.env.NODE_ENV === 'development') {
      console.error('Full error:', error);
    }
    
    // If it's a Stripe error, get more details
    if (error instanceof Stripe.errors.StripeError) {
      console.error('Stripe error details:', {
        type: error.type,
        code: error.code,
        decline_code: error.decline_code,
        message: error.message
      });
    }

    return new Response(
      JSON.stringify({ 
        error: 'Failed to create payment intent',
        details: error instanceof Error ? error.message : 'Unknown error'
      }),
      { 
        status: 500,
        headers: { 'Content-Type': 'application/json' }
      }
    );
  }
};
