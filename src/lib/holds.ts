import { prisma } from './prisma';

export class HoldError extends Error {
  constructor(message: string, public code: string) {
    super(message);
    this.name = 'HoldError';
  }
}

export async function createHold(availabilityId: string) {
  const expiresAt = new Date(Date.now() + 10 * 60 * 1000); // 10 minutes from now

  try {
    // First cleanup any expired holds
    await cleanupExpiredHolds();

    // Check if slot is actually available
    const availability = await prisma.availability.findUnique({
      where: { id: availabilityId },
      include: { 
        booking: true,
        hold: true
      }
    });

    if (!availability) {
      throw new HoldError('Slot not found', 'NOT_FOUND');
    }

    if (availability.booking) {
      throw new HoldError('Slot is already booked', 'ALREADY_BOOKED');
    }

    if (availability.hold) {
      if (availability.hold.expiresAt > new Date()) {
        throw new HoldError('Slot is currently held', 'CURRENTLY_HELD');
      }
      // Delete expired hold
      await prisma.hold.delete({
        where: { id: availability.hold.id }
      });
    }

    // Create new hold
    const hold = await prisma.hold.create({
      data: {
        availabilityId,
        expiresAt
      }
    });

    return hold;
  } catch (error) {
    if (error instanceof HoldError) {
      throw error;
    }
    console.error('Error creating hold:', error);
    throw new HoldError('Failed to create hold', 'INTERNAL_ERROR');
  }
}

export async function releaseHold(availabilityId: string) {
  try {
    const result = await prisma.hold.deleteMany({
      where: {
        availabilityId
      }
    });
    return result.count > 0;
  } catch (error) {
    console.error('Error releasing hold:', error);
    throw new HoldError('Failed to release hold', 'INTERNAL_ERROR');
  }
}

export async function cleanupExpiredHolds() {
  try {
    const now = new Date();
    const result = await prisma.hold.deleteMany({
      where: {
        expiresAt: {
          lt: now
        }
      }
    });
    return result.count;
  } catch (error) {
    console.error('Error cleaning up expired holds:', error);
    throw new HoldError('Failed to cleanup expired holds', 'INTERNAL_ERROR');
  }
}

export async function isSlotAvailable(availabilityId: string): Promise<boolean> {
  try {
    const availability = await prisma.availability.findUnique({
      where: { id: availabilityId },
      include: {
        booking: true,
        hold: true
      }
    });

    if (!availability) {
      return false;
    }

    if (availability.booking) {
      return false;
    }

    if (availability.hold && availability.hold.expiresAt > new Date()) {
      return false;
    }

    return true;
  } catch (error) {
    console.error('Error checking slot availability:', error);
    throw new HoldError('Failed to check slot availability', 'INTERNAL_ERROR');
  }
}

// Types for TypeScript
export interface Hold {
  id: string;
  availabilityId: string;
  expiresAt: Date;
  createdAt: Date;
  updatedAt: Date;
}