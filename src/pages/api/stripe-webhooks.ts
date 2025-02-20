import type { APIRoute } from 'astro';
import Stripe from 'stripe';
import { prisma } from '../../lib/prisma';

const stripe = new Stripe(import.meta.env.STRIPE_SECRET_KEY);
const endpointSecret = import.meta.env.STRIPE_WEBHOOK_SECRET;

export const POST: APIRoute = async ({ request }) => {
  try {
    const signature = request.headers.get('stripe-signature');
    if (!signature || !endpointSecret) {
      return new Response('Webhook Error: No signature', { status: 400 });
    }

    const body = await request.text();
    let event: Stripe.Event;

    try {
      event = stripe.webhooks.constructEvent(
        body,
        signature,
        endpointSecret
      );
    } catch (err) {
      console.error('Webhook signature verification failed:', err);
      return new Response('Webhook Error: Invalid signature', { status: 400 });
    }

    if (event.type === 'payment_intent.succeeded') {
      const paymentIntent = event.data.object as Stripe.PaymentIntent;
      const bookingId = paymentIntent.metadata.bookingId;

      if (!bookingId) {
        throw new Error('No booking ID found in payment intent metadata');
      }

      // Update booking status
      try {
        await prisma.booking.update({
          where: { id: bookingId },
          data: { paid: true }
        });
      } catch (err) {
        console.error('Database update failed:', err);
        return new Response('Webhook Error: Failed to update booking', { status: 500 });
      }
      

      // Send confirmation emails, etc.
      // TODO: Implement email sending logic
    }

    return new Response(JSON.stringify({ received: true }), {
      status: 200,
      headers: { 'Content-Type': 'application/json' }
    });
  } catch (error) {
    console.error('Webhook Error:', error);
    return new Response(
      JSON.stringify({ error: 'Webhook handler failed' }), 
      { status: 500 }
    );
  }
};