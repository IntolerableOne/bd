// File: src/pages/api/contact.ts
// Internal contact form API endpoint

import type { APIRoute } from 'astro';
import { sendContactFormEmail } from '../../lib/email';
import { z } from 'zod';

// Input validation schema
const contactFormSchema = z.object({
  name: z.string().min(1, 'Name is required').max(100, 'Name too long'),
  email: z.string().email('Invalid email address').max(100, 'Email too long'),
  message: z.string().min(10, 'Message must be at least 10 characters').max(2000, 'Message too long')
});

export const POST: APIRoute = async ({ request }) => {
  try {
    console.log('📧 Contact form submission received');

    // Parse and validate input
    const rawData = await request.json().catch(() => null);
    if (!rawData) {
      return new Response(JSON.stringify({ error: 'Invalid JSON in request body' }), {
        status: 400, headers: { 'Content-Type': 'application/json' }
      });
    }

    const validationResult = contactFormSchema.safeParse(rawData);
    if (!validationResult.success) {
      console.error('❌ Contact form validation failed:', validationResult.error.flatten().fieldErrors);
      return new Response(JSON.stringify({ 
        error: 'Invalid form data',
        details: validationResult.error.flatten().fieldErrors
      }), {
        status: 400, headers: { 'Content-Type': 'application/json' }
      });
    }

    const { name, email, message } = validationResult.data;

    console.log('📝 Processing contact form from:', name, '(' + email + ')');

    // Send email to team
    await sendContactFormEmail({
      name: name.trim(),
      email: email.toLowerCase().trim(),
      message: message.trim()
    });

    console.log('✅ Contact form email sent successfully');

    return new Response(JSON.stringify({
      success: true,
      message: 'Your message has been sent successfully. We\'ll get back to you soon!'
    }), {
      status: 200,
      headers: { 'Content-Type': 'application/json' }
    });

  } catch (error: any) {
    console.error('❌ Contact form error:', error);

    // Check if it's an email configuration error
    if (error.message.includes('Email not configured') || error.message.includes('transporter')) {
      return new Response(JSON.stringify({
        error: 'Email service temporarily unavailable. Please try again later or contact us directly.',
        code: 'EMAIL_SERVICE_ERROR'
      }), {
        status: 503, // Service Unavailable
        headers: { 'Content-Type': 'application/json' }
      });
    }

    return new Response(JSON.stringify({
      error: 'Failed to send message. Please try again.',
      details: process.env.NODE_ENV === 'development' ? error.message : undefined
    }), {
      status: 500,
      headers: { 'Content-Type': 'application/json' }
    });
  }
};