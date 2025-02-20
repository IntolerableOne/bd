import type { APIRoute } from 'astro';
import Stripe from 'stripe';
import { prisma } from '../../lib/prisma';

const stripe = new Stripe(import.meta.env.STRIPE_SECRET_KEY);

export const POST: APIRoute = async ({ request }) => {
  try {
    const { slotId, name, email, phone } = await request.json();

    if (!slotId || !name || !email || !phone) {
      return new Response(
        JSON.stringify({ error: 'Missing required fields' }),
        { 
          status: 400,
          headers: { 'Content-Type': 'application/json' }
        }
      );
    }

    // Check if slot exists and is available
    const availability = await prisma.availability.findUnique({
      where: { id: slotId },
      include: { booking: true }
    });

    if (!availability) {
      return new Response(
        JSON.stringify({ error: 'Time slot not found' }),
        { 
          status: 404,
          headers: { 'Content-Type': 'application/json' }
        }
      );
    }

    if (availability.booking) {
      return new Response(
        JSON.stringify({ error: 'Time slot already booked' }),
        { 
          status: 400,
          headers: { 'Content-Type': 'application/json' }
        }
      );
    }

    // Create booking record first
    const booking = await prisma.booking.create({
      data: {
        name,
        email,
        phone,
        availabilityId: slotId,
        amount: 10000, // £100 in pence
        paid: false
      }
    });

    // Then create payment intent
    const paymentIntent = await stripe.paymentIntents.create({
      amount: 10000,
      currency: 'gbp',
      automatic_payment_methods: {
        enabled: true,
      },
      metadata: {
        bookingId: booking.id,
        availabilityId: slotId,
        customerName: name,
        customerEmail: email,
        midwifeEmail: availability.midwife === 'clare' ? 
          'clare@birthdebrief.com' : 'natalie@birthdebrief.com'
      }
    });

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