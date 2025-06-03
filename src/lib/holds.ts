import { prisma } from './prisma';
import { type Prisma } from '@prisma/client';

export class HoldError extends Error {
  constructor(message: string, public code?: string) {
    super(message);
    this.name = 'HoldError';
  }
}

export async function createOrUpdateHold(availabilityId: string, holdDurationMinutes: number = 15): Promise<Prisma.HoldGetPayload<{}>> {
  const now = new Date();
  const expiresAt = new Date(now.getTime() + holdDurationMinutes * 60 * 1000);
  console.log(`Attempting to create/update hold for availabilityId ${availabilityId}, expires at ${expiresAt.toISOString()}`);

  try {
    // Check if the slot is already definitively booked (paid)
    const availability = await prisma.availability.findUnique({
      where: { id: availabilityId },
      include: {
        booking: { where: { paid: true } },
        hold: true
      },
    });

    if (!availability) {
      throw new HoldError('Availability slot not found.', 'SLOT_NOT_FOUND');
    }
    if (availability.booking) {
      throw new HoldError('Slot is already booked and paid.', 'SLOT_BOOKED');
    }

    if (availability.hold && new Date(availability.hold.expiresAt) > new Date()) {
      console.log(`Slot ${availabilityId} already has an active hold. Updating its expiry and updatedAt.`);
    }

    // Create or update the hold for the availability slot
    const hold = await prisma.hold.upsert({
      where: { availabilityId: availabilityId },
      update: {
        expiresAt: expiresAt,
        updatedAt: now,
      },
      create: {
        availabilityId: availabilityId,
        expiresAt: expiresAt,
        createdAt: now,
        updatedAt: now,
      },
    });

    console.log(`Hold successfully created/updated for availabilityId ${availabilityId}.`);
    return hold;

  } catch (error: any) {
    if (error instanceof HoldError) throw error;
    console.error(`Error in createOrUpdateHold for availabilityId ${availabilityId}:`, error);
    if (error.code === 'P2003' || error.code === 'P2025') {
        throw new HoldError('Failed to create hold: Invalid availability slot.', 'INVALID_SLOT_ID');
    }
    throw new HoldError('Failed to create or update hold on the slot.', 'DB_ERROR');
  }
}

export async function releaseHold(availabilityId: string): Promise<boolean> {
  console.log(`Attempting to release hold for availabilityId ${availabilityId}`);
  try {
    const result = await prisma.hold.delete({
      where: { availabilityId: availabilityId },
    });

    if (result) {
      console.log(`Hold released successfully for availabilityId ${availabilityId}.`);
      return true;
    }
    console.log(`No active hold found to release for availabilityId ${availabilityId} (delete operation did not throw but returned falsy).`);
    return false;
  } catch (error: any) {
    if (error.code === 'P2025') {
        console.log(`No active hold found to release for availabilityId ${availabilityId} (P2025).`);
        return false;
    }
    console.error(`Error releasing hold for availabilityId ${availabilityId}:`, error);
    throw new HoldError('Failed to release hold.', 'DB_ERROR');
  }
}

export async function cleanupExpiredHolds(): Promise<{ 
  holdsDeleted: number, 
  bookingsAbandoned: number,
  oldBookingsDeleted: number 
}> {
  const now = new Date();
  console.log(`Starting cleanup of expired holds (expired before ${now.toISOString()})...`);

  let holdsDeletedCount = 0;
  let bookingsAbandonedCount = 0;
  let oldBookingsDeletedCount = 0;

  try {
    // Find Hold records that have passed their 'expiresAt' time
    const expiredHolds = await prisma.hold.findMany({
      where: {
        expiresAt: {
          lt: now,
        },
      },
      include: {
        availability: {
          include: {
            booking: true
          }
        }
      }
    });

    if (expiredHolds.length === 0) {
      console.log('No expired holds found to clean up.');
      return { holdsDeleted: 0, bookingsAbandoned: 0, oldBookingsDeleted: 0 };
    }

    console.log(`Found ${expiredHolds.length} expired holds. Processing...`);

    // Process each expired hold
    await prisma.$transaction(async (tx: Prisma.TransactionClient) => {
      for (const hold of expiredHolds) {
        const availability = hold.availability;
        const booking = availability?.booking;

        if (booking && !booking.paid) {
          // Mark unpaid booking as abandoned (don't delete)
          if (booking.status === 'PENDING') {
            await tx.booking.update({
              where: { id: booking.id },
              data: { status: 'ABANDONED' }
            });
            bookingsAbandonedCount++;
            console.log(`Booking ${booking.id} marked as ABANDONED`);
          }
        }

        // Always release the hold to free up the slot
        await tx.hold.delete({
          where: { id: hold.id }
        });
        holdsDeletedCount++;
      }
    });

    // Separate cleanup: Delete very old abandoned bookings (older than 3 months) 
    // to prevent database bloat
    const threeMonthsAgo = new Date(now.getTime() - (90 * 24 * 60 * 60 * 1000));
    
    const deletedOldBookings = await prisma.booking.deleteMany({
      where: {
        status: 'ABANDONED',
        createdAt: {
          lt: threeMonthsAgo
        }
      }
    });
    
    oldBookingsDeletedCount = deletedOldBookings.count;
    
    if (oldBookingsDeletedCount > 0) {
      console.log(`Deleted ${oldBookingsDeletedCount} old abandoned bookings (>3 months)`);
    }

    console.log('Expired holds cleanup completed');
    console.log(`- Holds deleted: ${holdsDeletedCount}`);
    console.log(`- Bookings marked abandoned: ${bookingsAbandonedCount}`);
    console.log(`- Old bookings deleted: ${oldBookingsDeletedCount}`);

    return { 
      holdsDeleted: holdsDeletedCount, 
      bookingsAbandoned: bookingsAbandonedCount,
      oldBookingsDeleted: oldBookingsDeletedCount 
    };

  } catch (error: any) {
    console.error('Error during cleanup of expired holds:', error);
    throw new HoldError('An error occurred during hold cleanup process.', 'CLEANUP_FAILED');
  }
}

export {};