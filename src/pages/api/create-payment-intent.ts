import type { APIRoute } from 'astro';
import Stripe from 'stripe';
import { prisma } from '../../lib/prisma';

const stripe = new Stripe(import.meta.env.STRIPE_SECRET_KEY, {
  apiVersion: '2023-10-16'
});

export const POST: APIRoute = async ({ request }) => {
  try {
    const { slotId, name, email, phone } = await request.json();

    // Create a booking record
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

    // Create a payment intent
    const paymentIntent = await stripe.paymentIntents.create({
      amount: 10000, // £100 in pence
      currency: 'gbp',
      metadata: {
        bookingId: booking.id,
        availabilityId: slotId,
        midwifeEmail: booking.availability.midwife === 'clare' ? 
          'clare@birthdebrief.com' : 'natalie@birthdebrief.com'
      }
    });

    return new Response(
      JSON.stringify({
        clientSecret: paymentIntent.client_secret
      }),
      { status: 200 }
    );
  } catch (error) {
    console.error('Error creating payment intent:', error);
    return new Response(
      JSON.stringify({ error: 'Failed to create payment intent' }),
      { status: 500 }
    );
  }
};