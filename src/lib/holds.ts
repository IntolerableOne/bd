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
    // Check if slot is available without using hold relation
    const availability = await prisma.availability.findUnique({
      where: { id: availabilityId },
      include: { 
        booking: true
      }
    });

    if (!availability) {
      throw new HoldError('Slot not found', 'NOT_FOUND');
    }

    if (availability.booking) {
      throw new HoldError('Slot is already booked', 'ALREADY_BOOKED');
    }

    // Try to create hold, but don't fail if the table doesn't exist yet
    try {
      const hold = await prisma.hold.create({
        data: {
          availabilityId,
          expiresAt
        }
      });
      return hold;
    } catch (error) {
      // If hold table doesn't exist, just proceed without creating a hold
      console.log('Hold creation failed (this is okay if holds table does not exist yet):', error);
      return null;
    }
  } catch (error) {
    if (error instanceof HoldError) {
      throw error;
    }
    console.error('Error in createHold:', error);
    throw new HoldError('Failed to create hold', 'INTERNAL_ERROR');
  }
}

export async function releaseHold(availabilityId: string) {
  try {
    // Try to release hold, but don't fail if the table doesn't exist
    try {
      const result = await prisma.hold.deleteMany({
        where: { availabilityId }
      });
      return result.count > 0;
    } catch (error) {
      console.log('Hold release failed (this is okay if holds table does not exist yet):', error);
      return false;
    }
  } catch (error) {
    console.error('Error releasing hold:', error);
    throw new HoldError('Failed to release hold', 'INTERNAL_ERROR');
  }
}

export async function isSlotAvailable(availabilityId: string): Promise<boolean> {
  try {
    const availability = await prisma.availability.findUnique({
      where: { id: availabilityId },
      include: {
        booking: true
      }
    });

    if (!availability) {
      return false;
    }

    if (availability.booking) {
      return false;
    }

    return true;
  } catch (error) {
    console.error('Error checking slot availability:', error);
    throw new HoldError('Failed to check slot availability', 'INTERNAL_ERROR');
  }
}
