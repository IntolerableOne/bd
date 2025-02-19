import type { APIContext } from 'astro';
import { prisma } from '../../lib/prisma';

export async function GET() {
  try {
    const bookings = await prisma.booking.findMany({
      include: {
        availability: true
      },
      orderBy: {
        createdAt: 'desc'
      }
    });

    // Calculate earnings
    const earnings = {
      monthly: {} as Record<string, number>,
      yearly: 0
    };

    bookings.forEach(booking => {
      if (booking.paid) {
        const month = booking.createdAt.getMonth();
        earnings.monthly[month] = (earnings.monthly[month] || 0) + booking.amount;
        earnings.yearly += booking.amount;
      }
    });

    return new Response(JSON.stringify({ bookings, earnings }), {
      status: 200,
      headers: {
        'Content-Type': 'application/json'
      }
    });
  } catch (error) {
    console.error('Error fetching bookings:', error);
    return new Response(JSON.stringify({ error: 'Failed to fetch bookings' }), {
      status: 500
    });
  }
}