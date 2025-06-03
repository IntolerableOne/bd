// File: src/pages/api/contact.ts
// Fixed contact form API with better validation and error messages

import type { APIRoute } from 'astro';
import { sendContactFormEmail } from '../../lib/email';
import { z } from 'zod';

// Simplified input validation schema
const contactFormSchema = z.object({
  name: z.string()
    .min(1, 'Name is required')
    .max(100, 'Name must be less than 100 characters')
    .transform(s => s.trim()),
  email: z.string()
    .email('Please enter a valid email address')
    .max(100, 'Email must be less than 100 characters')
    .transform(s => s.toLowerCase().trim()),
  subject: z.string()
    .max(200, 'Subject must be less than 200 characters')
    .optional()
    .transform(s => s ? s.trim() : undefined),
  message: z.string()
    .min(5, 'Message must be at least 5 characters')
    .max(2000, 'Message must be less than 2000 characters')
    .transform(s => s.trim()),
  // Honeypot field
  website: z.string().optional()
});

// Simple in-memory rate limiting
const submissionTracker = new Map<string, { count: number, lastSubmission: number }>();

function isRateLimited(clientIP: string): boolean {
  const now = Date.now();
  const tracker = submissionTracker.get(clientIP);
  
  if (!tracker) {
    submissionTracker.set(clientIP, { count: 1, lastSubmission: now });
    return false;
  }
  
  // Reset counter if more than 1 hour has passed
  if (now - tracker.lastSubmission > 3600000) {
    submissionTracker.set(clientIP, { count: 1, lastSubmission: now });
    return false;
  }
  
  // Allow max 5 submissions per hour per IP (increased from 3)
  if (tracker.count >= 5) {
    return true;
  }
  
  tracker.count++;
  tracker.lastSubmission = now;
  submissionTracker.set(clientIP, tracker);
  return false;
}

function formatValidationErrors(errors: any): string {
  const errorMessages = [];
  
  for (const [field, messages] of Object.entries(errors)) {
    if (Array.isArray(messages)) {
      errorMessages.push(`${field}: ${messages.join(', ')}`);
    }
  }
  
  return errorMessages.join('; ');
}

export const POST: APIRoute = async ({ request, clientAddress }) => {
  const startTime = Date.now();
  const clientIP = clientAddress || 'unknown';
  
  console.log('📧 Contact form submission received from:', clientIP);

  try {
    // Rate limiting check
    if (isRateLimited(clientIP)) {
      console.warn('⚠️ Rate limit exceeded for IP:', clientIP);
      return new Response(JSON.stringify({ 
        error: 'Too many submissions. Please wait before sending another message.',
        success: false
      }), {
        status: 429, 
        headers: { 'Content-Type': 'application/json' }
      });
    }

    // Parse request body
    let rawData;
    try {
      rawData = await request.json();
      console.log('📝 Raw form data received:', Object.keys(rawData));
    } catch (parseError) {
      console.error('❌ Failed to parse JSON:', parseError);
      return new Response(JSON.stringify({ 
        error: 'Invalid request format. Please try again.',
        success: false
      }), {
        status: 400, 
        headers: { 'Content-Type': 'application/json' }
      });
    }

    // Validate input
    const validationResult = contactFormSchema.safeParse(rawData);
    if (!validationResult.success) {
      const errorDetails = validationResult.error.flatten().fieldErrors;
      console.error('❌ Contact form validation failed:', errorDetails);
      
      const readableError = formatValidationErrors(errorDetails);
      
      return new Response(JSON.stringify({ 
        error: `Please fix the following: ${readableError}`,
        details: errorDetails,
        success: false
      }), {
        status: 400, 
        headers: { 'Content-Type': 'application/json' }
      });
    }

    const { name, email, subject, message, website } = validationResult.data;

    // Honeypot check
    if (website && website.trim() !== '') {
      console.warn('🍯 Honeypot triggered for IP:', clientIP);
      return new Response(JSON.stringify({ 
        error: 'Please try again later.',
        success: false
      }), {
        status: 400, 
        headers: { 'Content-Type': 'application/json' }
      });
    }

    console.log('📝 Processing valid contact form from:', name, '(' + email + ')');
    console.log('📝 Message preview:', message.substring(0, 50) + '...');

    // Prepare email content
    const emailMessage = subject 
      ? `Subject: ${subject}\n\n${message}`
      : message;

    // Send email to team
    await sendContactFormEmail({
      name,
      email,
      message: `${emailMessage}\n\n---\nSubmitted from: ${clientIP}\nTimestamp: ${new Date().toISOString()}`
    });

    const processingTime = Date.now() - startTime;
    console.log('✅ Contact form email sent successfully in', processingTime + 'ms');

    return new Response(JSON.stringify({
      success: true,
      message: 'Your message has been sent successfully. We\'ll get back to you within 24 hours!'
    }), {
      status: 200,
      headers: { 'Content-Type': 'application/json' }
    });

  } catch (error: any) {
    const processingTime = Date.now() - startTime;
    console.error('❌ Contact form error after', processingTime + 'ms:', error);

    // Check if it's an email configuration error
    if (error.message && (error.message.includes('Email not configured') || error.message.includes('transporter'))) {
      return new Response(JSON.stringify({
        error: 'Email service temporarily unavailable. Please try again later or contact us directly at clare@birthdebrief.com',
        success: false,
        code: 'EMAIL_SERVICE_ERROR'
      }), {
        status: 503,
        headers: { 'Content-Type': 'application/json' }
      });
    }

    return new Response(JSON.stringify({
      error: 'Unable to send your message right now. Please try again or contact us directly at clare@birthdebrief.com',
      success: false,
      details: process.env.NODE_ENV === 'development' ? error.message : undefined
    }), {
      status: 500,
      headers: { 'Content-Type': 'application/json' }
    });
  }
};

// Clean up old tracking data periodically
setInterval(() => {
  const oneHourAgo = Date.now() - 3600000;
  for (const [ip, data] of submissionTracker.entries()) {
    if (data.lastSubmission < oneHourAgo) {
      submissionTracker.delete(ip);
    }
  }
}, 600000); // Clean up every 10 minutes