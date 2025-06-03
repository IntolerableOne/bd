// File: src/pages/api/test-email.ts
// Fixed version with corrected method name

import type { APIRoute } from 'astro';
import { sendUserBookingConfirmationEmail, sendAdminBookingNotificationEmail, getEmailConfigStatus } from '../../lib/email';
import { authenticateRequest, createAuthenticatedResponse } from '../../middleware/auth';

export const GET: APIRoute = async ({ request }) => {
  // Require admin authentication
  const adminUser = await authenticateRequest(request);
  if (!adminUser) {
    return createAuthenticatedResponse({} as any);
  }

  try {
    const emailStatus = getEmailConfigStatus();
    
    return new Response(JSON.stringify({
      emailConfiguration: emailStatus,
      environment: {
        EMAIL_HOST: process.env.EMAIL_HOST ? 'SET' : 'NOT SET',
        EMAIL_PORT: process.env.EMAIL_PORT || 'NOT SET',
        EMAIL_USER: process.env.EMAIL_USER ? 'SET' : 'NOT SET',
        EMAIL_PASS: process.env.EMAIL_PASS ? 'SET' : 'NOT SET',
        EMAIL_FROM: process.env.EMAIL_FROM || 'NOT SET',
        TEAM_EMAIL_ADDRESS: process.env.TEAM_EMAIL_ADDRESS || 'NOT SET',
      },
      timestamp: new Date().toISOString()
    }, null, 2), {
      status: 200,
      headers: { 'Content-Type': 'application/json' }
    });

  } catch (error: any) {
    return new Response(JSON.stringify({
      error: 'Failed to check email configuration',
      details: error.message
    }), {
      status: 500,
      headers: { 'Content-Type': 'application/json' }
    });
  }
};

export const POST: APIRoute = async ({ request }) => {
  // Require admin authentication
  const adminUser = await authenticateRequest(request);
  if (!adminUser) {
    return createAuthenticatedResponse({} as any);
  }

  try {
    const { testType, recipientEmail } = await request.json();
    
    const testResults: any = {
      timestamp: new Date().toISOString(),
      testType,
      recipientEmail
    };

    if (testType === 'contact-form') {
      // Test contact form email
      try {
        await sendContactFormEmail({
          name: 'Test User',
          email: recipientEmail || 'test@example.com',
          message: 'This is a test message from the email testing system.',
          timestamp: new Date().toISOString()
        });
        testResults.contactForm = { success: true, message: 'Contact form email sent successfully' };
      } catch (error: any) {
        testResults.contactForm = { success: false, error: error.message };
      }
    }

    if (testType === 'booking-confirmation' || testType === 'all') {
      // Test user booking confirmation
      try {
        await sendUserBookingConfirmationEmail({
          to: recipientEmail || 'test@example.com',
          name: 'Test User',
          bookingDate: new Date(Date.now() + 24*60*60*1000), // Tomorrow
          bookingTime: '10:00',
          midwifeName: 'clare',
          bookingId: 'test-booking-123'
        });
        testResults.userConfirmation = { success: true, message: 'User confirmation email sent successfully' };
      } catch (error: any) {
        testResults.userConfirmation = { success: false, error: error.message };
      }
    }

    if (testType === 'admin-notification' || testType === 'all') {
      // Test admin notification
      try {
        const teamEmails = process.env.TEAM_EMAIL_ADDRESS?.split(',') || ['clare@birthdebrief.com'];
        
        for (const email of teamEmails) {
          await sendAdminBookingNotificationEmail({
            to: email.trim(),
            userName: 'Test User',
            userEmail: recipientEmail || 'test@example.com',
            userPhone: '07123456789',
            bookingDate: new Date(Date.now() + 24*60*60*1000), // Tomorrow
            bookingTime: '10:00',
            midwifeName: 'clare',
            bookingId: 'test-booking-123',
            bookingAmount: 10000
          });
        }
        
        testResults.adminNotification = { 
          success: true, 
          message: `Admin notification emails sent to: ${teamEmails.join(', ')}`,
          recipients: teamEmails
        };
      } catch (error: any) {
        testResults.adminNotification = { success: false, error: error.message };
      }
    }

    return new Response(JSON.stringify(testResults, null, 2), {
      status: 200,
      headers: { 'Content-Type': 'application/json' }
    });

  } catch (error: any) {
    return new Response(JSON.stringify({
      error: 'Email test failed',
      details: error.message,
      timestamp: new Date().toISOString()
    }), {
      status: 500,
      headers: { 'Content-Type': 'application/json' }
    });
  }
};

// Contact form email function
async function sendContactFormEmail(details: {
  name: string;
  email: string;
  message: string;
  timestamp: string;
}) {
  const { sendAdminBookingNotificationEmail } = await import('../../lib/email');
  
  const teamEmails = process.env.TEAM_EMAIL_ADDRESS?.split(',') || ['clare@birthdebrief.com'];
  
  for (const email of teamEmails) {
    // We'll enhance the email lib to support contact form emails
    // For now, we'll send a modified admin notification
    await sendContactFormNotification({
      to: email.trim(),
      ...details
    });
  }
}

async function sendContactFormNotification(details: {
  to: string;
  name: string;
  email: string;
  message: string;
  timestamp: string;
}) {
  const nodemailer = await import('nodemailer');
  
  // FIXED: Changed createTransporter to createTransport
  const transporter = nodemailer.createTransport({
    host: process.env.EMAIL_HOST!,
    port: parseInt(process.env.EMAIL_PORT || "587", 10),
    secure: process.env.EMAIL_PORT === "465",
    auth: {
      user: process.env.EMAIL_USER!,
      pass: process.env.EMAIL_PASS!,
    },
  });

  const emailHtml = `
    <div style="font-family: Arial, sans-serif; line-height: 1.6; color: #333;">
      <h2 style="color: #15803d;">New Contact Form Message</h2>
      <table style="width: 100%; border-collapse: collapse; margin-bottom: 15px;">
        <tr><td style="padding: 8px; font-weight: bold; width: 30%;">Name:</td><td style="padding: 8px;">${details.name}</td></tr>
        <tr><td style="padding: 8px; font-weight: bold;">Email:</td><td style="padding: 8px;"><a href="mailto:${details.email}">${details.email}</a></td></tr>
        <tr><td style="padding: 8px; font-weight: bold;">Received:</td><td style="padding: 8px;">${new Date(details.timestamp).toLocaleString('en-GB')}</td></tr>
      </table>
      <h3>Message:</h3>
      <div style="background: #f9f9f9; padding: 15px; border-left: 4px solid #15803d; margin: 10px 0;">
        ${details.message.replace(/\n/g, '<br>')}
      </div>
      <p style="margin-top: 20px; font-size: 0.9em; color: #666;">
        Please reply directly to <a href="mailto:${details.email}">${details.email}</a>
      </p>
    </div>
  `;

  await transporter.sendMail({
    from: process.env.EMAIL_FROM!,
    to: details.to,
    subject: `Contact Form: Message from ${details.name}`,
    html: emailHtml,
  });
}