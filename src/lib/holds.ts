// File: src/lib/holds.ts - Safer cleanup version
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
  console.log(`🧹 Starting SAFE cleanup of expired holds (expired before ${now.toISOString()})...`);

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
      console.log('✅ No expired holds found to clean up.');
      return { holdsDeleted: 0, bookingsAbandoned: 0, oldBookingsDeleted: 0 };
    }

    console.log(`🔍 Found ${expiredHolds.length} expired holds. Processing safely...`);

    // Process each expired hold with extra safety checks
    await prisma.$transaction(async (tx: Prisma.TransactionClient) => {
      for (const hold of expiredHolds) {
        const availability = hold.availability;
        const booking = availability?.booking;

        // SAFETY CHECK: Only process bookings that are clearly unpaid and pending
        if (booking) {
          console.log(`📋 Checking booking ${booking.id} - Status: ${booking.status}, Paid: ${booking.paid}, Amount: ${booking.amount}`);
          
          // EXTRA SAFETY: Multiple conditions must be true to mark as abandoned
          const isSafeToAbandon = (
            booking.paid === false &&                    // Must be unpaid
            booking.status === 'PENDING' &&             // Must be pending status
            booking.amount > 0 &&                       // Must have an amount (real booking)
            booking.stripePaymentId === null            // No payment processing started
          );
          
          if (isSafeToAbandon) {
            // Double-check: ensure no payment has been processed in Stripe
            // (In a real implementation, you might want to check Stripe directly)
            
            await tx.booking.update({
              where: { id: booking.id },
              data: { status: 'ABANDONED' }
            });
            bookingsAbandonedCount++;
            console.log(`✅ Booking ${booking.id} safely marked as ABANDONED (was unpaid PENDING for expired hold)`);
          } else {
            console.log(`⚠️ Skipping booking ${booking.id} - doesn't meet safe abandonment criteria`);
            console.log(`   - Paid: ${booking.paid}, Status: ${booking.status}, StripePaymentId: ${booking.stripePaymentId}`);
          }
        }

        // Always safe to release expired holds (just removes the "reservation")
        await tx.hold.delete({
          where: { id: hold.id }
        });
        holdsDeletedCount++;
        console.log(`✅ Expired hold ${hold.id} deleted (availability slot freed up)`);
      }
    });

    // VERY CONSERVATIVE: Only delete abandoned bookings older than 6 months (not 3)
    const sixMonthsAgo = new Date(now.getTime() - (180 * 24 * 60 * 60 * 1000));
    
    // Additional safety: only delete abandoned bookings with no payment ID
    const deletedOldBookings = await prisma.booking.deleteMany({
      where: {
        AND: [
          { status: 'ABANDONED' },
          { paid: false },                    // Extra safety: must be unpaid
          { stripePaymentId: null },          // Extra safety: no Stripe payment
          { createdAt: { lt: sixMonthsAgo } } // Extra safety: 6 months instead of 3
        ]
      }
    });
    
    oldBookingsDeletedCount = deletedOldBookings.count;
    
    if (oldBookingsDeletedCount > 0) {
      console.log(`🗑️ Safely deleted ${oldBookingsDeletedCount} very old abandoned bookings (>6 months, unpaid, no payment ID)`);
    }

    console.log('✅ SAFE cleanup completed');
    console.log(`📊 Summary:`);
    console.log(`   - Holds deleted: ${holdsDeletedCount} (freed up booking slots)`);
    console.log(`   - Bookings marked abandoned: ${bookingsAbandonedCount} (were unpaid & pending)`);
    console.log(`   - Very old bookings deleted: ${oldBookingsDeletedCount} (>6 months old)`);

    return { 
      holdsDeleted: holdsDeletedCount, 
      bookingsAbandoned: bookingsAbandonedCount,
      oldBookingsDeleted: oldBookingsDeletedCount 
    };

  } catch (error: any) {
    console.error('❌ Error during safe cleanup of expired holds:', error);
    throw new HoldError('An error occurred during the safe hold cleanup process.', 'CLEANUP_FAILED');
  }
}

export {};
