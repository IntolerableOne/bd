// File: src/pages/api/test-email.ts
// Complete fixed version with proper contact form email function

import type { APIRoute } from 'astro';
import { sendUserBookingConfirmationEmail, sendAdminBookingNotificationEmail, sendContactFormEmail, getEmailConfigStatus } from '../../lib/email';
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
    console.error('Error in test-email GET:', error);
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
    const body = await request.json().catch(() => ({}));
    const { testType, recipientEmail } = body;
    
    if (!testType) {
      return new Response(JSON.stringify({
        error: 'testType is required',
        validTypes: ['contact-form', 'booking-confirmation', 'admin-notification', 'all']
      }), {
        status: 400,
        headers: { 'Content-Type': 'application/json' }
      });
    }

    const testResults: any = {
      timestamp: new Date().toISOString(),
      testType,
      recipientEmail: recipientEmail || 'test@example.com'
    };

    console.log(`Testing email type: ${testType} to ${recipientEmail || 'test@example.com'}`);

    if (testType === 'contact-form' || testType === 'all') {
      // Test contact form email
      try {
        await sendContactFormEmail({
          name: 'Test User',
          email: recipientEmail || 'test@example.com',
          message: 'This is a test message from the email testing system. If you receive this, the contact form email functionality is working correctly.'
        });
        testResults.contactForm = { success: true, message: 'Contact form email sent successfully' };
        console.log('✅ Contact form test email sent');
      } catch (error: any) {
        console.error('❌ Contact form test failed:', error);
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
        console.log('✅ User confirmation test email sent');
      } catch (error: any) {
        console.error('❌ User confirmation test failed:', error);
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
        console.log('✅ Admin notification test emails sent');
      } catch (error: any) {
        console.error('❌ Admin notification test failed:', error);
        testResults.adminNotification = { success: false, error: error.message };
      }
    }

    return new Response(JSON.stringify(testResults, null, 2), {
      status: 200,
      headers: { 'Content-Type': 'application/json' }
    });

  } catch (error: any) {
    console.error('❌ Email test failed:', error);
    return new Response(JSON.stringify({
      error: 'Email test failed',
      details: error.message,
      timestamp: new Date().toISOString(),
      stack: process.env.NODE_ENV === 'development' ? error.stack : undefined
    }), {
      status: 500,
      headers: { 'Content-Type': 'application/json' }
    });
  }
};