// File: src/pages/api/booking.ts
// Purpose: API endpoint to fetch booking data for the admin panel.
// This version ensures correct Prisma type imports.

import type { APIContext } from 'astro';
import { prisma } from '../../lib/prisma';
import { type Prisma } from '@prisma/client'; // Correctly import Prisma namespace for types
import { authenticateRequest, createAuthenticatedResponse } from '../../middleware/auth';

// Define a type for the booking object as returned by Prisma, including its relations.
// This uses Prisma.BookingGetPayload to create a precise type based on the query.
type BookingWithAvailability = Prisma.BookingGetPayload<{
  include: { availability: true } // Specify that the 'availability' relation should be included
}>;

export async function GET({ request }: APIContext) {
  // Authenticate the request to ensure only admin users can access this endpoint
  const adminUser = await authenticateRequest(request);
  if (!adminUser) {
    return createAuthenticatedResponse({} as any); // Return a 401 Unauthorized response
  }

  try {
    // Fetch bookings from the database
    const bookings: BookingWithAvailability[] = await prisma.booking.findMany({
      where: {
        paid: true, // Only retrieve bookings that have been paid for
      },
      include: {
        availability: true, // Include the related availability slot details
      },
      orderBy: {
        availability: { // Order bookings by the date of the availability slot
            date: 'desc' // Latest bookings first
        }
      },
    });

    // Initialize an object to store calculated earnings
    const earnings = {
      monthly: {} as Record<string, number>, // Key: "YYYY-MM", Value: amount in pence
      yearly: 0, // Total amount in pence for the current year
    };

    const currentYear = new Date().getFullYear();

    // Iterate over bookings to calculate earnings
    bookings.forEach((booking: BookingWithAvailability) => {
      const amountInPence = Number(booking.amount); // Ensure amount is treated as a number

      // Check if the booking is paid, has availability info, and amount is a valid number
      if (booking.paid && booking.availability && !isNaN(amountInPence)) {
        const bookingDate = new Date(booking.availability.date);
        const year = bookingDate.getFullYear();
        const month = bookingDate.getMonth(); // 0-indexed (January is 0)
        const yearMonthKey = `${year}-${String(month + 1).padStart(2, '0')}`; // Format as YYYY-MM

        // Add to monthly earnings
        earnings.monthly[yearMonthKey] = (earnings.monthly[yearMonthKey] || 0) + amountInPence;

        // Add to yearly earnings if the booking is for the current year
        if (year === currentYear) {
            earnings.yearly += amountInPence;
        }
      }
    });

    // Return the bookings and calculated earnings
    return new Response(JSON.stringify({ bookings, earnings }), {
      status: 200,
      headers: {
        'Content-Type': 'application/json',
      },
    });
  } catch (error: any) {
    console.error('Error fetching bookings:', error);
    // Return a generic error response if fetching fails
    return new Response(JSON.stringify({ error: 'Failed to fetch bookings', details: error.message }), {
      status: 500,
      headers: { 'Content-Type': 'application/json' },
    });
  }
}
