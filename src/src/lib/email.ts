// File: src/lib/email.ts
// Purpose: Utility functions for sending emails (e.g., booking confirmations)
// Changes: Ensured the file is treated as a module by TypeScript by adding an export.

import nodemailer from 'nodemailer';
import type { Transporter } from 'nodemailer'; // Import Transporter type

interface BookingDetails {
  to: string;
  name: string;
  bookingDate: Date;
  bookingTime: string;
  midwifeName: string; // Ensure this is available on availability object
  bookingId: string;
}

// Configure your email transporter using environment variables
// These would be for your email provider (e.g., Gmail, SendGrid, Mailgun)
let transporter: Transporter | null = null;

// Initialize transporter only if environment variables are set
if (process.env.EMAIL_HOST && process.env.EMAIL_USER && process.env.EMAIL_PASS) {
  transporter = nodemailer.createTransport({
    host: process.env.EMAIL_HOST,
    port: parseInt(process.env.EMAIL_PORT || "587", 10),
    secure: process.env.EMAIL_PORT === "465", // true for 465, false for other ports
    auth: {
      user: process.env.EMAIL_USER,
      pass: process.env.EMAIL_PASS,
    },
  });
} else {
  console.warn("Email transporter not configured. Missing EMAIL_HOST, EMAIL_USER, or EMAIL_PASS environment variables. Emails will not be sent.");
}


export async function sendBookingConfirmationEmail(details: BookingDetails): Promise<void> {
  if (!transporter) {
    console.error("Email not sent: Transporter not initialized. Check email configuration.");
    // Optionally, you could throw an error or return a status
    // For now, just logging and not sending.
    return;
  }

  const { to, name, bookingDate, bookingTime, midwifeName, bookingId } = details;

  const formattedDate = new Date(bookingDate).toLocaleDateString('en-GB', {
    weekday: 'long', year: 'numeric', month: 'long', day: 'numeric'
  });

  const emailHtml = `
    <div style="font-family: Arial, sans-serif; line-height: 1.6; color: #333;">
      <div style="max-width: 600px; margin: 20px auto; padding: 20px; border: 1px solid #ddd; border-radius: 8px; background-color: #f9f9f9;">
        <h1 style="color: #15803d; text-align: center; border-bottom: 2px solid #15803d; padding-bottom: 10px;">Booking Confirmed!</h1>
        <p>Dear ${name},</p>
        <p>Thank you for booking your consultation with Birth Debrief. We're pleased to confirm your appointment details:</p>
        <table style="width: 100%; border-collapse: collapse; margin-bottom: 20px;">
          <tr style="border-bottom: 1px solid #eee;">
            <td style="padding: 8px; font-weight: bold;">Service:</td>
            <td style="padding: 8px;">One hour consultation</td>
          </tr>
          <tr style="border-bottom: 1px solid #eee;">
            <td style="padding: 8px; font-weight: bold;">Date:</td>
            <td style="padding: 8px;">${formattedDate}</td>
          </tr>
          <tr style="border-bottom: 1px solid #eee;">
            <td style="padding: 8px; font-weight: bold;">Time:</td>
            <td style="padding: 8px;">${bookingTime}</td>
          </tr>
          <tr style="border-bottom: 1px solid #eee;">
            <td style="padding: 8px; font-weight: bold;">Midwife:</td>
            <td style="padding: 8px;">${midwifeName}</td>
          </tr>
          <tr>
            <td style="padding: 8px; font-weight: bold;">Booking ID:</td>
            <td style="padding: 8px;">${bookingId}</td>
          </tr>
        </table>
        <p>You will receive a separate email with the Microsoft Teams meeting link for your video consultation at least 24 hours before your scheduled appointment. Please check your spam/junk folder if you don't see it.</p>
        <p>If you have any questions or need to reschedule, please contact us by replying to this email or visiting our contact page on our website.</p>
        <p>We look forward to speaking with you.</p>
        <p>Sincerely,</p>
        <p><strong>The Birth Debrief Team</strong></p>
        <p style="text-align: center; margin-top: 30px; font-size: 0.9em; color: #777;">
          <a href="https://birthdebrief.com" style="color: #15803d; text-decoration: none;">birthdebrief.com</a>
        </p>
      </div>
    </div>
  `;

  const mailOptions = {
    from: `"Birth Debrief" <${process.env.EMAIL_FROM || process.env.EMAIL_USER}>`,
    to: to,
    subject: 'Your Birth Debrief Consultation is Confirmed!',
    html: emailHtml,
  };

  try {
    await transporter.sendMail(mailOptions);
    console.log(`Confirmation email sent to ${to} for booking ID ${bookingId}`);
  } catch (error) {
    console.error(`Error sending email to ${to} for booking ID ${bookingId}:`, error);
    // Decide if this should throw an error up to the webhook handler.
    // For now, it's logged, and the webhook can still succeed.
    // throw new Error('Failed to send confirmation email.');
  }
}

// Adding an empty export statement to ensure this file is treated as a module.
export {};
