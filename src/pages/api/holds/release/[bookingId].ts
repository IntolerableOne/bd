// File: src/pages/api/holds/release/[bookingId].ts
// Purpose: API endpoint to release a hold and delete an unpaid booking if a user cancels.
// Changes: Uses releaseHold from lib/holds.ts based on availabilityId.

import type { APIRoute } from 'astro';
import { prisma } from '../../../../lib/prisma';
import { type Prisma } from '@prisma/client';
import { releaseHold, HoldError } from '../../../../lib/holds'; // Import releaseHold

export const DELETE: APIRoute = async ({ params }) => {
  const { bookingId } = params;

  if (!bookingId) {
    return new Response(JSON.stringify({ error: 'Booking ID is required' }), {
      status: 400, headers: { 'Content-Type': 'application/json' },
    });
  }

  try {
    console.log(`API: [/api/holds/release] Attempting to release hold/booking for bookingId: ${bookingId}`);

    // Find the booking to get its status and associated availabilityId
    const booking = await prisma.booking.findUnique({
      where: { id: bookingId },
      select: { paid: true, availabilityId: true } // Need availabilityId to release the correct Hold
    });

    if (!booking) {
      console.log(`API: Booking not found for ID: ${bookingId}. Assuming already handled or never existed.`);
      return new Response(JSON.stringify({ message: 'Booking not found or already handled.' }), { status: 200 });
    }

    if (booking.paid) {
      console.log(`API: Booking ${bookingId} is already paid. Cannot cancel via this endpoint. Hold should have been released by webhook.`);
      return new Response(JSON.stringify({ message: 'Booking already paid. Cancellation not allowed here.' }), { status: 400 });
    }

    // If booking is not paid, proceed to delete the booking and its associated hold.
    const { availabilityId } = booking;

    await prisma.$transaction(async (tx: Prisma.TransactionClient) => {
      // 1. Delete the unpaid booking record
      await tx.booking.delete({
        where: { id: bookingId },
      });
      console.log(`API: Unpaid booking ${bookingId} deleted.`);

      // 2. Release the hold from the Hold table using the availabilityId
      if (availabilityId) {
        const holdReleased = await releaseHold(availabilityId); // Calling releaseHold from lib/holds.ts
        if (holdReleased) {
          console.log(`API: Hold for availabilityId ${availabilityId} (associated with booking ${bookingId}) released.`);
        } else {
          console.warn(`API: No hold found for availabilityId ${availabilityId} to release, or it was already released.`);
        }
      } else {
        // This case should be rare if bookings always have an availabilityId
        console.warn(`API: No availabilityId found for unpaid booking ${bookingId}. Cannot explicitly release associated hold by availabilityId.`);
      }
    });

    return new Response(JSON.stringify({ message: 'Booking cancelled and associated hold released successfully.' }), {
      status: 200, headers: { 'Content-Type': 'application/json' },
    });

  } catch (error: any) {
    console.error(`API: Error releasing hold/booking for bookingId ${bookingId}: ${error.message}`, error);
    let statusCode = 500;
    let responseMessage = 'Failed to cancel booking and release hold.';
    if (error.code === 'P2025') { // Prisma "Record to delete not found"
        console.warn(`API: Attempted to delete records for bookingId ${bookingId}, but some were already gone.`);
        responseMessage = 'Records already deleted or not found.';
        statusCode = 200; // Or 404 if preferred, but 200 implies the desired state is achieved
    } else if (error instanceof HoldError) {
        responseMessage = error.message;
        // Use a generic 500 for HoldErrors here unless specific client responses are needed
    }
    return new Response(JSON.stringify({ error: responseMessage, details: error.message }), {
      status: statusCode, headers: { 'Content-Type': 'application/json' },
    });
  }
};
