import pkg from '@prisma/client';
const { PrismaClient } = pkg;

const prisma = new PrismaClient();

async function cleanupDatabase() {
  try {
    // Delete all unpaid bookings
    const result = await prisma.booking.deleteMany({
      where: {
        paid: false
      }
    });

    console.log(`Successfully deleted ${result.count} unpaid bookings`);
  } catch (error) {
    console.error('Error cleaning database:', error);
  } finally {
    await prisma.$disconnect();
  }
}

cleanupDatabase();