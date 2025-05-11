// File: src/lib/holds.ts
// Purpose: Manages slot holds using the dedicated 'Hold' model from the Prisma schema.

import { prisma } from './prisma'; // Import Prisma client instance
import { type Prisma } from '@prisma/client'; // Import Prisma namespace directly for types

// Custom error class for hold-related operations
export class HoldError extends Error {
  constructor(message: string, public code?: string) {
    super(message);
    this.name = 'HoldError';
  }
}

/**
 * Creates or updates a hold on an availability slot.
 * This should be called when a user indicates intent to book a slot, typically before payment.
 * @param availabilityId The ID of the availability slot to hold.
 * @param holdDurationMinutes The duration for which the hold should be active.
 * @returns The created or updated Hold object, conforming to Prisma.HoldGetPayload<{}>.
 */
export async function createOrUpdateHold(availabilityId: string, holdDurationMinutes: number = 15): Promise<Prisma.HoldGetPayload<{}>> {
  const now = new Date(); // Get current time once
  const expiresAt = new Date(now.getTime() + holdDurationMinutes * 60 * 1000);
  console.log(`Attempting to create/update hold for availabilityId ${availabilityId}, expires at ${expiresAt.toISOString()}`);

  try {
    // Check if the slot is already definitively booked (paid)
    const availability = await prisma.availability.findUnique({
      where: { id: availabilityId },
      include: {
        booking: { where: { paid: true } }, // Check for an existing *paid* booking
        hold: true // Check for an existing hold
      },
    });

    if (!availability) {
      throw new HoldError('Availability slot not found.', 'SLOT_NOT_FOUND');
    }
    if (availability.booking) { // If booking is not null, it means it's paid as per the where clause
      throw new HoldError('Slot is already booked and paid.', 'SLOT_BOOKED');
    }

    if (availability.hold && new Date(availability.hold.expiresAt) > new Date()) {
      console.log(`Slot ${availabilityId} already has an active hold. Updating its expiry and updatedAt.`);
    }

    // Create or update the hold for the availability slot.
    const hold = await prisma.hold.upsert({
      where: { availabilityId: availabilityId }, // This relies on availabilityId being @unique in Hold model
      update: { // Fields to update if the record exists
        expiresAt: expiresAt,
        updatedAt: now, // Explicitly set updatedAt on update
      },
      create: { // Fields to set if the record is created
        availabilityId: availabilityId,
        expiresAt: expiresAt,
        createdAt: now, // Explicitly set createdAt
        updatedAt: now, // Explicitly set updatedAt
      },
    });

    console.log(`Hold successfully created/updated for availabilityId ${availabilityId}.`);
    return hold;

  } catch (error: any) {
    if (error instanceof HoldError) throw error;
    console.error(`Error in createOrUpdateHold for availabilityId ${availabilityId}:`, error);
    if (error.code) { 
        console.error(`Prisma error code: ${error.code}`);
    }
    if (error.code === 'P2003' || error.code === 'P2025') { // P2003: Foreign key constraint failed, P2025: Record not found for relation
        throw new HoldError('Failed to create hold: Invalid availability slot.', 'INVALID_SLOT_ID');
    }
    throw new HoldError('Failed to create or update hold on the slot.', 'DB_ERROR');
  }
}

/**
 * Releases (deletes) a hold on an availability slot.
 * @param availabilityId The ID of the availability slot whose hold is to be released.
 * @returns True if a hold was deleted, false otherwise.
 */
export async function releaseHold(availabilityId: string): Promise<boolean> {
  console.log(`Attempting to release hold for availabilityId ${availabilityId}`);
  try {
    // Since availabilityId is @unique in the Hold model, we use it in the where clause for delete.
    const result = await prisma.hold.delete({
      where: { availabilityId: availabilityId },
    });

    if (result) { // `delete` returns the deleted record or throws if not found (P2025)
      console.log(`Hold released successfully for availabilityId ${availabilityId}.`);
      return true;
    }
    // This part might be unreachable if P2025 is thrown and caught.
    console.log(`No active hold found to release for availabilityId ${availabilityId} (delete operation did not throw but returned falsy).`);
    return false;
  } catch (error: any) {
    if (error.code === 'P2025') { // Prisma: "An operation failed because it depends on one or more records that were required but not found. Record to delete not found."
        console.log(`No active hold found to release for availabilityId ${availabilityId} (P2025).`);
        return false; // It's not an application error if the hold was already gone.
    }
    console.error(`Error releasing hold for availabilityId ${availabilityId}:`, error);
    throw new HoldError('Failed to release hold.', 'DB_ERROR');
  }
}

/**
 * Cleans up expired Hold records and any associated unpaid Booking records.
 * @returns An object reporting the number of holds and unpaid bookings deleted.
 */
export async function cleanupExpiredHolds(): Promise<{ holdsDeleted: number, unpaidBookingsDeleted: number }> {
  const now = new Date();
  console.log(`Starting cleanup of expired holds (expired before ${now.toISOString()})...`);

  let holdsDeletedCount = 0;
  let unpaidBookingsDeletedCount = 0;

  try {
    // Find Hold records that have passed their 'expiresAt' time
    const expiredHolds = await prisma.hold.findMany({
      where: {
        expiresAt: {
          lt: now, // 'lt' means "less than" current time
        },
      },
      select: {
        id: true, // ID of the Hold record itself
        availabilityId: true, // Needed to find associated unpaid bookings
      },
    });

    if (expiredHolds.length === 0) {
      console.log('No expired holds found to clean up.');
      return { holdsDeleted: 0, unpaidBookingsDeleted: 0 };
    }

    console.log(`Found ${expiredHolds.length} expired holds. Processing for deletion...`);
    const holdIdsToDelete = expiredHolds.map(h => h.id);
    const availabilityIdsFromExpiredHolds = expiredHolds.map(h => h.availabilityId);

    // Find unpaid bookings associated with these specific expired holds' availability slots
    const unpaidBookingsToDelete = await prisma.booking.findMany({
        where: {
            availabilityId: {
                in: availabilityIdsFromExpiredHolds
            },
            paid: false // Only target unpaid bookings
        },
        select: {
            id: true // Select only the IDs of bookings to delete
        }
    });
    const unpaidBookingIdsToDelete = unpaidBookingsToDelete.map(b => b.id);

    // Perform deletions in a transaction for atomicity
    await prisma.$transaction(async (tx: Prisma.TransactionClient) => {
      // Delete associated unpaid bookings first
      if (unpaidBookingIdsToDelete.length > 0) {
        const deletedBookingsResult = await tx.booking.deleteMany({
          where: {
            id: { in: unpaidBookingIdsToDelete },
          },
        });
        unpaidBookingsDeletedCount = deletedBookingsResult.count;
        console.log(`Deleted ${unpaidBookingsDeletedCount} unpaid bookings linked to expired holds.`);
      }

      // Then delete the expired holds themselves
      if (holdIdsToDelete.length > 0) {
        const deletedHoldsResult = await tx.hold.deleteMany({
          where: {
            id: { in: holdIdsToDelete }, // Delete by the Hold record's own ID
          },
        });
        holdsDeletedCount = deletedHoldsResult.count;
        console.log(`Deleted ${holdsDeletedCount} expired holds.`);
      }
    });

    console.log('Expired holds and associated unpaid bookings cleanup finished.');
    return { holdsDeleted: holdsDeletedCount, unpaidBookingsDeleted: unpaidBookingsDeletedCount };

  } catch (error: any) {
    console.error('Error during cleanup of expired holds:', error);
    throw new HoldError('An error occurred during hold cleanup process.', 'CLEANUP_FAILED');
  }
}

// Ensure the file is treated as a module by TypeScript
export {};
