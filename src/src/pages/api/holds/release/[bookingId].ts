// File: src/pages/api/holds/release/[bookingId].ts
// Changes: Imported Prisma namespace directly from '@prisma/client' for type usage.

import type { APIRoute } from 'astro';
import { prisma } from '../../../../lib/prisma'; // Adjust path as needed
import { type Prisma } from '@prisma/client'; // Import Prisma namespace for types

export const DELETE: APIRoute = async ({ params }) => {
  const { bookingId } = params;

  if (!bookingId) {
    return new Response(JSON.stringify({ error: 'Booking ID is required' }), {
      status: 400,
      headers: { 'Content-Type': 'application/json' },
    });
  }

  try {
    console.log(`Attempting to release hold/booking for bookingId: ${bookingId}`);

    const booking = await prisma.booking.findUnique({
      where: { id: bookingId },
      select: { paid: true, availabilityId: true }
    });

    if (!booking) {
      console.log(`Booking not found for ID: ${bookingId}. No hold to release via this booking.`);
      return new Response(JSON.stringify({ message: 'Booking not found or already handled.' }), { status: 200 });
    }

    if (booking.paid) {
      console.log(`Booking ${bookingId} is already paid. Hold should have been released by webhook. No action taken.`);
      return new Response(JSON.stringify({ message: 'Booking already paid. No action taken.' }), { status: 200 });
    }

    // Use Prisma.TransactionClient for the type of 'tx'
    await prisma.$transaction(async (tx: Prisma.TransactionClient) => {
      await tx.booking.delete({
        where: { id: bookingId },
      });
      console.log(`Unpaid booking ${bookingId} deleted.`);

      if (booking.availabilityId) {
        const deletedHolds = await tx.hold.deleteMany({
          where: { availabilityId: booking.availabilityId },
        });
        console.log(`Deleted ${deletedHolds.count} holds for availabilityId: ${booking.availabilityId}`);
      } else {
        console.warn(`No availabilityId found for booking ${bookingId}. Cannot explicitly delete associated hold or unlink availability.`);
      }
    });

    return new Response(JSON.stringify({ message: 'Hold and unpaid booking released successfully.' }), {
      status: 200,
      headers: { 'Content-Type': 'application/json' },
    });

  } catch (error: any) {
    console.error(`Error releasing hold for bookingId ${bookingId}: ${error.message}`, error);
    if (error.code === 'P2025') { // Prisma error code for "Record to delete not found"
        console.warn(`Attempted to delete records for bookingId ${bookingId}, but some were already gone.`);
        return new Response(JSON.stringify({ message: 'Records already deleted or not found.' }), { status: 200 });
    }
    return new Response(JSON.stringify({ error: 'Failed to release hold', details: error.message }), {
      status: 500,
      headers: { 'Content-Type': 'application/json' },
    });
  }
};
