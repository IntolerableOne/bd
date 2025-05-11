// File: src/lib/email.ts
// Purpose: Utility functions for sending booking confirmation and admin notification emails.
// Ensure nodemailer is installed: npm install nodemailer
// For types: npm install -D @types/nodemailer

import nodemailer from 'nodemailer';
import type { Transporter } from 'nodemailer';

// Interface for user booking confirmation details
interface UserBookingConfirmationDetails {
  to: string;         // User's email address
  name: string;       // User's name
  bookingDate: Date;
  bookingTime: string;
  midwifeName: string;
  bookingId: string;
}

// Interface for admin new booking notification details
interface AdminBookingNotificationDetails {
  to: string;         // Team's email address
  userName: string;   // User's name
  userEmail: string;  // User's email
  userPhone?: string; // User's phone (optional)
  bookingDate: Date;
  bookingTime: string;
  midwifeName: string;
  bookingId: string;
  bookingAmount: number; // Amount in pence
}

let transporter: Transporter | null = null;

// Initialize transporter only if environment variables are set
if (process.env.EMAIL_HOST && process.env.EMAIL_USER && process.env.EMAIL_PASS && process.env.EMAIL_FROM && process.env.TEAM_EMAIL_ADDRESS) {
  transporter = nodemailer.createTransport({
    host: process.env.EMAIL_HOST,
    port: parseInt(process.env.EMAIL_PORT || "587", 10),
    secure: process.env.EMAIL_PORT === "465", // true for 465, false for other ports
    auth: {
      user: process.env.EMAIL_USER,
      pass: process.env.EMAIL_PASS,
    },
    // Optional: Add connection timeout and other settings if needed
    // connectionTimeout: 5 * 1000, // 5 seconds
  });
  console.log("Email transporter configured.");
} else {
  console.warn(
    "Email transporter not fully configured. Missing one or more required environment variables: " +
    "EMAIL_HOST, EMAIL_PORT, EMAIL_USER, EMAIL_PASS, EMAIL_FROM, TEAM_EMAIL_ADDRESS. " +
    "Emails will not be sent."
  );
}

/**
 * Sends a booking confirmation email to the user.
 * @param details - The details for the user confirmation email.
 */
export async function sendUserBookingConfirmationEmail(details: UserBookingConfirmationDetails): Promise<void> {
  if (!transporter) {
    console.error("Email not sent (User Confirmation): Transporter not initialized. Check email configuration in environment variables.");
    return; // Exit if transporter is not configured
  }

  const { to, name, bookingDate, bookingTime, midwifeName, bookingId } = details;

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
    from: process.env.EMAIL_FROM!, // Assert non-null as checked in transporter init
    to: to,
    subject: `Your Birth Debrief Consultation is Confirmed (Booking ID: ${bookingId})`,
    html: emailHtml,
  };

  try {
    await transporter.sendMail(mailOptions);
    console.log(`User booking confirmation email sent to ${to} for Booking ID: ${bookingId}`);
  } catch (error) {
    console.error(`Error sending user confirmation email to ${to} for Booking ID: ${bookingId}:`, error);
    // Do not throw error here to prevent webhook failure, but ensure it's logged.
  }
}

/**
 * Sends a new booking notification email to the admin/team.
 * @param details - The details for the admin notification email.
 */
export async function sendAdminBookingNotificationEmail(details: AdminBookingNotificationDetails): Promise<void> {
  if (!transporter) {
    console.error("Email not sent (Admin Notification): Transporter not initialized. Check email configuration.");
    return; // Exit if transporter is not configured
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
      <p>Please ensure a Microsoft Teams invite is manually sent to the client for this appointment.</p>
      <p>You can view and manage bookings in the <a href="https://birthdebrief.com/admin">Admin Panel</a>.</p>
      <p>Thank you.</p>
    </div>
  `;

  const mailOptions = {
    from: process.env.EMAIL_FROM!,
    to: to, // This should be process.env.TEAM_EMAIL_ADDRESS
    subject: `New Booking Confirmed: ${userName} - ${formattedDate} at ${bookingTime} (ID: ${bookingId})`,
    html: emailHtml,
  };

  try {
    await transporter.sendMail(mailOptions);
    console.log(`Admin new booking notification sent to ${to} for Booking ID: ${bookingId}`);
  } catch (error) {
    console.error(`Error sending admin notification email to ${to} for Booking ID: ${bookingId}:`, error);
  }
}

// Ensure the file is treated as a module by TypeScript
export {};
