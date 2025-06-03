// File: src/lib/email.ts
// Fixed version with corrected method name and null checks

import nodemailer from 'nodemailer';
import type { Transporter } from 'nodemailer';

interface UserBookingConfirmationDetails {
  to: string;
  name: string;
  bookingDate: Date;
  bookingTime: string;
  midwifeName: string;
  bookingId: string;
}

interface AdminBookingNotificationDetails {
  to: string;
  userName: string;
  userEmail: string;
  userPhone?: string;
  bookingDate: Date;
  bookingTime: string;
  midwifeName: string;
  bookingId: string;
  bookingAmount: number;
}

interface ContactFormDetails {
  name: string;
  email: string;
  message: string;
}

let transporter: Transporter | null = null;
let emailConfigStatus = {
  configured: false,
  missingVars: [] as string[]
};

// Validate and initialize email configuration
function validateEmailConfig() {
  const requiredVars = [
    'EMAIL_HOST',
    'EMAIL_USER', 
    'EMAIL_PASS',
    'EMAIL_FROM',
    'TEAM_EMAIL_ADDRESS'
  ];
  
  const missing = requiredVars.filter(varName => !process.env[varName]);
  
  if (missing.length > 0) {
    emailConfigStatus = {
      configured: false,
      missingVars: missing
    };
    console.warn('❌ Email configuration incomplete. Missing environment variables:', missing.join(', '));
    return false;
  }
  
  return true;
}

// Initialize transporter
if (validateEmailConfig()) {
  try {
    // FIXED: Changed createTransporter to createTransport
    transporter = nodemailer.createTransport({
      host: process.env.EMAIL_HOST!,
      port: parseInt(process.env.EMAIL_PORT || "587", 10),
      secure: process.env.EMAIL_PORT === "465",
      auth: {
        user: process.env.EMAIL_USER!,
        pass: process.env.EMAIL_PASS!,
      },
      connectionTimeout: 10000,
      greetingTimeout: 5000,
      socketTimeout: 10000,
    });
    
    emailConfigStatus.configured = true;
    console.log('✅ Email transporter configured successfully');
    
    // Test the connection - FIXED: Added null check
    if (transporter) {
      transporter.verify((error, success) => {
        if (error) {
          console.error('❌ Email configuration test failed:', error.message);
          emailConfigStatus.configured = false;
        } else {
          console.log('✅ Email server connection verified');
        }
      });
    }
    
  } catch (error: any) {
    console.error('❌ Failed to create email transporter:', error.message);
    transporter = null;
    emailConfigStatus.configured = false;
  }
}

export async function sendUserBookingConfirmationEmail(details: UserBookingConfirmationDetails): Promise<void> {
  if (!transporter || !emailConfigStatus.configured) {
    const errorMsg = emailConfigStatus.missingVars.length > 0 
      ? `Email not configured. Missing: ${emailConfigStatus.missingVars.join(', ')}`
      : 'Email transporter not initialized';
    console.error('❌ User confirmation email not sent:', errorMsg);
    return;
  }

  const { to, name, bookingDate, bookingTime, midwifeName, bookingId } = details;

  if (!to || !name || !bookingDate || !bookingTime || !midwifeName || !bookingId) {
    console.error('❌ User confirmation email not sent: Missing required details');
    return;
  }

  const formattedDate = new Date(bookingDate).toLocaleDateString('en-GB', {
    weekday: 'long', year: 'numeric', month: 'long', day: 'numeric'
  });

  const emailHtml = `
    <div style="font-family: Arial, sans-serif; line-height: 1.6; color: #333; max-width: 600px; margin: auto; border: 1px solid #ddd; padding: 20px; border-radius: 8px;">
      <h1 style="color: #15803d; text-align: center; border-bottom: 2px solid #15803d; padding-bottom: 10px;">Booking Confirmed!</h1>
      <p>Dear ${name},</p>
      <p>Thank you for booking your consultation with Birth Debrief. We're pleased to confirm your appointment details:</p>
      <table style="width: 100%; border-collapse: collapse; margin-bottom: 20px; font-size: 14px;">
        <tr style="border-bottom: 1px solid #eee;"><td style="padding: 8px; font-weight: bold; width: 30%;">Service:</td><td style="padding: 8px;">One hour consultation</td></tr>
        <tr style="border-bottom: 1px solid #eee;"><td style="padding: 8px; font-weight: bold;">Date:</td><td style="padding: 8px;">${formattedDate}</td></tr>
        <tr style="border-bottom: 1px solid #eee;"><td style="padding: 8px; font-weight: bold;">Time:</td><td style="padding: 8px;">${bookingTime}</td></tr>
        <tr style="border-bottom: 1px solid #eee;"><td style="padding: 8px; font-weight: bold;">Midwife:</td><td style="padding: 8px;">${midwifeName}</td></tr>
        <tr><td style="padding: 8px; font-weight: bold;">Booking ID:</td><td style="padding: 8px;">${bookingId}</td></tr>
      </table>
      <p>You will receive a separate email containing the Microsoft Teams meeting link for your video consultation. This will typically be sent at least 24 hours before your scheduled appointment. Please also check your spam/junk folder.</p>
      <p>If you have any questions, need to reschedule, or wish to provide more information ahead of your session, please reply to this email or visit our contact page on our website.</p>
      <p>We look forward to speaking with you.</p>
      <p>Sincerely,</p>
      <p><strong>The Birth Debrief Team</strong></p>
      <p style="text-align: center; margin-top: 30px; font-size: 0.9em; color: #777;">
        <a href="https://birthdebrief.com" style="color: #15803d; text-decoration: none;">birthdebrief.com</a>
      </p>
    </div>
  `;

  const mailOptions = {
    from: process.env.EMAIL_FROM!,
    to: to,
    subject: `Your Birth Debrief Consultation is Confirmed (Booking ID: ${bookingId})`,
    html: emailHtml,
  };

  try {
    console.log('📧 Sending user confirmation email to:', to);
    await transporter.sendMail(mailOptions);
    console.log('✅ User booking confirmation email sent successfully to:', to);
  } catch (error: any) {
    console.error(`❌ Failed to send user confirmation email to ${to}:`, error.message);
    throw error;
  }
}

export async function sendAdminBookingNotificationEmail(details: AdminBookingNotificationDetails): Promise<void> {
  if (!transporter || !emailConfigStatus.configured) {
    const errorMsg = emailConfigStatus.missingVars.length > 0 
      ? `Email not configured. Missing: ${emailConfigStatus.missingVars.join(', ')}`
      : 'Email transporter not initialized';
    console.error('❌ Admin notification email not sent:', errorMsg);
    return;
  }

  const { to, userName, userEmail, userPhone, bookingDate, bookingTime, midwifeName, bookingId, bookingAmount } = details;

  const formattedDate = new Date(bookingDate).toLocaleDateString('en-GB', {
    weekday: 'short', year: 'numeric', month: 'short', day: 'numeric'
  });
  const amountInPounds = (bookingAmount / 100).toFixed(2);

  const emailHtml = `
    <div style="font-family: Arial, sans-serif; line-height: 1.6; color: #333;">
      <h2 style="color: #15803d;">New Booking Notification</h2>
      <p>A new consultation has been booked and paid for:</p>
      <table style="width: 100%; border-collapse: collapse; margin-bottom: 15px; font-size: 14px;">
        <tr style="border-bottom: 1px solid #eee;"><td style="padding: 8px; font-weight: bold; width: 30%;">Booking ID:</td><td style="padding: 8px;">${bookingId}</td></tr>
        <tr style="border-bottom: 1px solid #eee;"><td style="padding: 8px; font-weight: bold;">Client Name:</td><td style="padding: 8px;">${userName}</td></tr>
        <tr style="border-bottom: 1px solid #eee;"><td style="padding: 8px; font-weight: bold;">Client Email:</td><td style="padding: 8px;"><a href="mailto:${userEmail}">${userEmail}</a></td></tr>
        ${userPhone ? `<tr style="border-bottom: 1px solid #eee;"><td style="padding: 8px; font-weight: bold;">Client Phone:</td><td style="padding: 8px;">${userPhone}</td></tr>` : ''}
        <tr style="border-bottom: 1px solid #eee;"><td style="padding: 8px; font-weight: bold;">Appointment Date:</td><td style="padding: 8px;">${formattedDate}</td></tr>
        <tr style="border-bottom: 1px solid #eee;"><td style="padding: 8px; font-weight: bold;">Appointment Time:</td><td style="padding: 8px;">${bookingTime}</td></tr>
        <tr style="border-bottom: 1px solid #eee;"><td style="padding: 8px; font-weight: bold;">Assigned Midwife:</td><td style="padding: 8px;">${midwifeName}</td></tr>
        <tr><td style="padding: 8px; font-weight: bold;">Amount Paid:</td><td style="padding: 8px;">£${amountInPounds}</td></tr>
      </table>
      <p><strong>Action Required:</strong> Please ensure a Microsoft Teams invite is manually sent to the client for this appointment.</p>
      <p>You can view and manage bookings in the <a href="https://birthdebrief.com/admin">Admin Panel</a>.</p>
    </div>
  `;

  const mailOptions = {
    from: process.env.EMAIL_FROM!,
    to: to,
    subject: `New Booking Confirmed: ${userName} - ${formattedDate} at ${bookingTime} (ID: ${bookingId})`,
    html: emailHtml,
  };

  try {
    console.log('📧 Sending admin notification email to:', to);
    await transporter.sendMail(mailOptions);
    console.log('✅ Admin booking notification email sent successfully to:', to);
  } catch (error: any) {
    console.error(`❌ Failed to send admin notification email to ${to}:`, error.message);
    throw error;
  }
}

// Enhanced function to send to multiple team members
export async function sendAdminBookingNotificationToTeam(details: Omit<AdminBookingNotificationDetails, 'to'>): Promise<void> {
  const teamEmails = process.env.TEAM_EMAIL_ADDRESS?.split(',') || ['clare@birthdebrief.com'];
  
  console.log('📧 Sending admin notifications to team:', teamEmails.join(', '));
  
  const emailPromises = teamEmails.map(email => 
    sendAdminBookingNotificationEmail({
      ...details,
      to: email.trim()
    })
  );
  
  try {
    await Promise.all(emailPromises);
    console.log('✅ All admin notification emails sent successfully');
  } catch (error: any) {
    console.error('❌ Some admin notification emails failed:', error.message);
    throw error;
  }
}

// Contact form email function
export async function sendContactFormEmail(details: ContactFormDetails): Promise<void> {
  if (!transporter || !emailConfigStatus.configured) {
    const errorMsg = emailConfigStatus.missingVars.length > 0 
      ? `Email not configured. Missing: ${emailConfigStatus.missingVars.join(', ')}`
      : 'Email transporter not initialized';
    console.error('❌ Contact form email not sent:', errorMsg);
    return;
  }

  const { name, email, message } = details;
  const teamEmails = process.env.TEAM_EMAIL_ADDRESS?.split(',') || ['clare@birthdebrief.com'];

  const emailHtml = `
    <div style="font-family: Arial, sans-serif; line-height: 1.6; color: #333;">
      <h2 style="color: #15803d;">New Contact Form Message</h2>
      <table style="width: 100%; border-collapse: collapse; margin-bottom: 15px;">
        <tr><td style="padding: 8px; font-weight: bold; width: 30%;">Name:</td><td style="padding: 8px;">${name}</td></tr>
        <tr><td style="padding: 8px; font-weight: bold;">Email:</td><td style="padding: 8px;"><a href="mailto:${email}">${email}</a></td></tr>
        <tr><td style="padding: 8px; font-weight: bold;">Received:</td><td style="padding: 8px;">${new Date().toLocaleString('en-GB')}</td></tr>
      </table>
      <h3>Message:</h3>
      <div style="background: #f9f9f9; padding: 15px; border-left: 4px solid #15803d; margin: 10px 0;">
        ${message.replace(/\n/g, '<br>')}
      </div>
      <p style="margin-top: 20px; font-size: 0.9em; color: #666;">
        Please reply directly to <a href="mailto:${email}">${email}</a>
      </p>
    </div>
  `;

  const emailPromises = teamEmails.map(teamEmail => {
    const mailOptions = {
      from: process.env.EMAIL_FROM!,
      to: teamEmail.trim(),
      replyTo: email, // Allow direct reply to the person who sent the message
      subject: `Contact Form: Message from ${name}`,
      html: emailHtml,
    };

    return transporter!.sendMail(mailOptions);
  });

  try {
    await Promise.all(emailPromises);
    console.log('✅ Contact form emails sent to team:', teamEmails.join(', '));
  } catch (error: any) {
    console.error('❌ Failed to send contact form emails:', error.message);
    throw error;
  }
}

// Export configuration status for debugging
export function getEmailConfigStatus() {
  return emailConfigStatus;
}

export {};