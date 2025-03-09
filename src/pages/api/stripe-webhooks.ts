// src/pages/api/stripe-webhooks.ts
import type { APIRoute } from 'astro';
import Stripe from 'stripe';
import { prisma } from '../../lib/prisma';
import { releaseHold } from '../../lib/holds';
import nodemailer from 'nodemailer';

const stripe = new Stripe(import.meta.env.STRIPE_SECRET_KEY);
const endpointSecret = import.meta.env.STRIPE_WEBHOOK_SECRET;

// Configure email transporter
const transporter = nodemailer.createTransport({
  host: import.meta.env.EMAIL_HOST,
  port: parseInt(import.meta.env.EMAIL_PORT || '587'),
  secure: import.meta.env.EMAIL_SECURE === 'true',
  auth: {
    user: import.meta.env.EMAIL_USER,
    pass: import.meta.env.EMAIL_PASS,
  },
});

async function sendConfirmationEmail(booking) {
  try {
    const bookingDate = new Date(booking.availability.date);
    const formattedDate = bookingDate.toLocaleDateString('en-GB', {
      weekday: 'long',
      day: 'numeric',
      month: 'long',
      year: 'numeric'
    });

    // Convert time from 24h to 12h format
    const [hours, minutes] = booking.availability.startTime.split(':');
    const hour = parseInt(hours);
    const ampm = hour >= 12 ? 'PM' : 'AM';
    const formattedHour = hour % 12 || 12;
    const formattedTime = `${formattedHour}:${minutes} ${ampm}`;

    await transporter.sendMail({
      from: `"Birth Debrief" <${import.meta.env.EMAIL_FROM}>`,
      to: booking.email,
      subject: "Your Birth Debrief Appointment Confirmation",
      html: `
        <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
          <div style="background-color: #15803d; color: white; padding: 20px; text-align: center;">
            <h1 style="margin: 0;">Appointment Confirmed</h1>
          </div>
          
          <div style="padding: 20px; border: 1px solid #e5e7eb; border-top: none;">
            <p>Hello ${booking.name},</p>
            
            <p>Your appointment with Birth Debrief has been confirmed.</p>
            
            <div style="background-color: #f3f4f6; padding: 15px; border-radius: 5px; margin: 20px 0;">
              <p style="margin: 0;"><strong>Date:</strong> ${formattedDate}</p>
              <p style="margin: 10px 0;"><strong>Time:</strong> ${formattedTime}</p>
              <p style="margin: 0;"><strong>Midwife:</strong> ${booking.availability.midwife}</p>
            </div>
            
            <p>You will receive video conferencing details separately before your appointment.</p>
            
            <p>If you need to reschedule or have any questions, please contact us as soon as possible.</p>
            
            <p>Thank you for choosing Birth Debrief.</p>
            
            <p style="margin-top: 30px;">
              Best regards,<br>
              The Birth Debrief Team
            </p>
          </div>
          
          <div style="background-color: #f3f4f6; padding: 15px; text-align: center; font-size: 12px; color: #6b7280;">
            <p>© ${new Date().getFullYear()} Birth Debrief. All rights reserved.</p>
          </div>
        </div>
      `
    });

    console.log(`Confirmation email sent to ${booking.email}`);
  } catch (error) {
    console.error('Error sending confirmation email:', error);
  }
}

export const POST: APIRoute = async ({ request }) => {
  try {
    const signature = request.headers.get('stripe-signature');
    if (!signature || !endpointSecret) {
      return new Response('Webhook Error: Missing configuration', { status: 400 });
    }

    const body = await request.text();
    let event: Stripe.Event;

    try {
      event = stripe.webhooks.constructEvent(body, signature, endpointSecret);
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

      // Get the booking with availability
      const booking = await prisma.booking.findUnique({
        where: { id: bookingId },
        include: { availability: true }
      });

      if (!booking) {
        throw new Error('Booking not found');
      }

      // Update booking status and link to availability
      await prisma.$transaction([
        prisma.booking.update({
          where: { id: bookingId },
          data: { 
            paid: true,
            status: 'CONFIRMED',
            stripePaymentId: paymentIntent.id
          }
        })
      ]);

      // Release any hold
      await releaseHold(booking.availabilityId);

      // Send confirmation email
      if (booking) {
        await sendConfirmationEmail(booking);
      }
    } else if (event.type === 'payment_intent.payment_failed') {
      const paymentIntent = event.data.object as Stripe.PaymentIntent;
      const bookingId = paymentIntent.metadata.bookingId;
      
      if (bookingId) {
        const booking = await prisma.booking.findUnique({
          where: { id: bookingId }
        });
        
        if (booking) {
          // Update booking status to cancelled
          await prisma.booking.update({
            where: { id: bookingId },
            data: { status: 'CANCELLED' }
          });
          
          // Release the hold
          await releaseHold(booking.availabilityId);
        }
      }
    }

    return new Response(JSON.stringify({ received: true }), {
      status: 200,
      headers: { 'Content-Type': 'application/json' }
    });
  } catch (error) {
    console.error('Webhook Error:', error);
    return new Response(
      JSON.stringify({ 
        error: 'Webhook handler failed',
        message: error instanceof Error ? error.message : 'Unknown error'
      }), 
      { status: 500 }
    );
  }
};