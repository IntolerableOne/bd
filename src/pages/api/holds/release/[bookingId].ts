// File: src/pages/api/holds/release/[bookingId].ts
// Purpose: API endpoint to release a hold and delete an unpaid booking if a user cancels.
// Changes: Uses releaseHold from lib/holds.ts based on availabilityId.

import type { APIRoute } from 'astro';
import { prisma } from '../../../../lib/prisma'; // Relative path to prisma lib
import { type Prisma } from '@prisma/client';
import { releaseHold, HoldError } from '../../../../lib/holds'; // Relative path to holds lib

export const DELETE: APIRoute = async ({ params }) => {
  const { bookingId } = params;

  if (!bookingId) {
    return new Response(JSON.stringify({ error: 'Booking ID is required' }), {
      status: 400, headers: { 'Content-Type': 'application/json' },
    });
  }

  try {
    console.log(`API: [/api/holds/release] Attempting to cancel booking and release hold for bookingId: ${bookingId}`);

    // Find the booking to get its status and associated availabilityId
    const booking = await prisma.booking.findUnique({
      where: { id: bookingId },
      select: { paid: true, availabilityId: true } // Need availabilityId to release the correct Hold
    });

    if (!booking) {
      console.log(`API: Booking not found for ID: ${bookingId}. Assuming already handled or never existed.`);
      // If booking doesn't exist, the desired state (no booking, no hold) might already be met.
      return new Response(JSON.stringify({ message: 'Booking not found or already handled.' }), { status: 200 });
    }

    if (booking.paid) {
      console.log(`API: Booking ${bookingId} is already paid. Cannot cancel via this endpoint. Hold should have been released by webhook.`);
      return new Response(JSON.stringify({ error: 'Booking already paid. Cancellation not allowed here.' }), { status: 400 });
    }

    // If booking is not paid, proceed to delete the booking and its associated hold.
    const { availabilityId } = booking;

    if (!availabilityId) {
        // This should not happen if your data integrity is good (booking must have an availabilityId)
        console.error(`API: Critical error - Unpaid booking ${bookingId} has no availabilityId. Cannot release hold.`);
        // Delete the booking anyway
        await prisma.booking.delete({ where: { id: bookingId }});
        throw new Error(`Booking ${bookingId} is missing availabilityId.`);
    }

    await prisma.$transaction(async (tx: Prisma.TransactionClient) => {
      // 1. Delete the unpaid booking record
      await tx.booking.delete({
        where: { id: bookingId },
      });
      console.log(`API: Unpaid booking ${bookingId} deleted.`);

      // 2. Release the hold from the Hold table using the availabilityId
      const holdReleased = await releaseHold(availabilityId); // Calling releaseHold from lib/holds.ts
      if (holdReleased) {
        console.log(`API: Hold for availabilityId ${availabilityId} (associated with booking ${bookingId}) released.`);
      } else {
        // This is not necessarily an error if the hold was already cleaned up or never existed for some reason
        console.warn(`API: No hold found for availabilityId ${availabilityId} to release, or it was already released.`);
      }
    });

    return new Response(JSON.stringify({ message: 'Booking cancelled and associated hold released successfully.' }), {
      status: 200, headers: { 'Content-Type': 'application/json' },
    });

  } catch (error: any) {
    console.error(`API: Error releasing hold/booking for bookingId ${bookingId}: ${error.message}`, error);
    let statusCode = 500;
    let responseMessage = 'Failed to cancel booking and release hold.';
    if (error.code === 'P2025') { // Prisma "Record to delete/update not found"
        console.warn(`API: Attempted to delete/update records for bookingId ${bookingId}, but some were not found.`);
        responseMessage = 'Records not found or already processed.';
        // Consider if 200 is appropriate if the desired state (no booking/hold) is achieved.
        // For a DELETE operation, 404 might be if the primary resource (bookingId) isn't found initially.
        statusCode = error.message.includes("Booking") ? 404 : 200;
    } else if (error instanceof HoldError) {
        responseMessage = error.message;
        // Use a generic 500 for HoldErrors here unless specific client responses are needed
    }
    return new Response(JSON.stringify({ error: responseMessage, details: error.message }), {
      status: statusCode, headers: { 'Content-Type': 'application/json' },
    });
  }
};
