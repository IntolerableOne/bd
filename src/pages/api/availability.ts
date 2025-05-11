// File: src/pages/api/availability.ts
// Changes:
// - Added Zod for input validation on POST requests.
// - Switched to process.env for server-side environment variables (if any were used, though not directly here).
// - Ensured authentication check for POST.

import type { APIRoute } from 'astro';
import { prisma } from '../../lib/prisma';
import { authenticateRequest, createAuthenticatedResponse } from '../../middleware/auth'; // Assuming createAuthenticatedResponse is for sending 401
import { z } from 'zod';

// Zod schema for validating new availability slot data
const availabilitySchema = z.object({
  date: z.string().refine((val) => !isNaN(Date.parse(val)), { message: "Invalid date format" }),
  startTime: z.string().regex(/^([01]\d|2[0-3]):([0-5]\d)$/, { message: "Invalid start time format, expected HH:MM" }),
  endTime: z.string().regex(/^([01]\d|2[0-3]):([0-5]\d)$/, { message: "Invalid end time format, expected HH:MM" }),
  midwife: z.enum(['clare', 'natalie'], { message: "Invalid midwife selection" }), // Assuming these are the only valid midwives
});

export const GET: APIRoute = async ({ request }) => {
  try {
    // Non-authenticated users (public booking page) only see available slots not in the past
    const minDateTime = new Date(Date.now() + (2 * 60 * 60 * 1000)); // 2 hours from now
    minDateTime.setMinutes(0,0,0); // Round to nearest hour for comparison if needed, or use directly

    if (!request.headers.get('Authorization')) {
      const slots = await prisma.availability.findMany({
        where: {
          booking: null, // Only slots that are not booked
          date: {
            gte: minDateTime // Only slots in the future (at least 2 hours from now)
          }
          // You might also want to filter out slots whose start time on the current day has passed
          // This requires more complex date-time logic if `date` only stores the date part.
        },
        orderBy: {
          date: 'asc',
        },
      });
      return new Response(JSON.stringify(slots), {
        status: 200,
        headers: { 'Content-Type': 'application/json' },
      });
    }

    // Authenticated admin users see all slots with booking info
    const user = await authenticateRequest(request);
    if (!user) {
      // Use your standardized unauthorized response
      return createAuthenticatedResponse({} as any); // Cast as any if context is not fully needed by createAuthenticatedResponse
    }

    const slots = await prisma.availability.findMany({
      include: {
        booking: true, // Include booking details for admin
        hold: true, // Include hold details for admin
      },
      orderBy: {
        date: 'asc',
      },
    });
    return new Response(JSON.stringify(slots), {
      status: 200,
      headers: { 'Content-Type': 'application/json' },
    });

  } catch (error: any) {
    console.error('Error fetching availability:', error);
    return new Response(JSON.stringify({ error: 'Failed to fetch availability', details: error.message }), {
      status: 500,
      headers: { 'Content-Type': 'application/json' },
    });
  }
};

export const POST: APIRoute = async ({ request }) => {
  // Authenticate admin user for creating slots
  const adminUser = await authenticateRequest(request);
  if (!adminUser) {
    return createAuthenticatedResponse({} as any);
  }

  try {
    const rawData = await request.json();
    const validationResult = availabilitySchema.safeParse(rawData);

    if (!validationResult.success) {
      console.error('Validation errors creating availability:', validationResult.error.flatten().fieldErrors);
      return new Response(JSON.stringify({
        error: 'Invalid input for availability slot.',
        details: validationResult.error.flatten().fieldErrors,
      }), {
        status: 400,
        headers: { 'Content-Type': 'application/json' },
      });
    }

    const { date, startTime, endTime, midwife } = validationResult.data;

    // Further validation: Ensure endTime is after startTime if on the same day (optional here, can be client-side)

    const slot = await prisma.availability.create({
      data: {
        date: new Date(date), // Zod ensures date is a valid date string
        startTime,
        endTime,
        midwife,
      },
    });
    return new Response(JSON.stringify(slot), {
      status: 201, // HTTP 201 Created
      headers: { 'Content-Type': 'application/json' },
    });

  } catch (error: any) {
    console.error('Error creating availability:', error);
    // Handle potential Prisma errors, e.g., unique constraint violation if a slot already exists
    if (error.code === 'P2002') { // Prisma unique constraint failed
        return new Response(JSON.stringify({ error: 'This availability slot already exists or conflicts with another.' }), {
            status: 409, // Conflict
            headers: { 'Content-Type': 'application/json' },
        });
    }
    return new Response(JSON.stringify({ error: 'Failed to create availability slot.', details: error.message }), {
      status: 500,
      headers: { 'Content-Type': 'application/json' },
    });
  }
};
