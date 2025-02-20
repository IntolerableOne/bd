import type { APIRoute } from 'astro';
import { prisma } from '../../../../lib/prisma';

export const GET: APIRoute = async ({ params }) => {
  try {
    const booking = await prisma.booking.findUnique({
      where: { id: params.id },
      include: {
        availability: true
      }
    });

    if (!booking) {
      return new Response(JSON.stringify({ 
        confirmed: false,
        message: 'Booking not found'
      }), { status: 404 });
    }

    return new Response(JSON.stringify({ 
      confirmed: booking.paid,
      bookingDetails: booking
    }), { status: 200 });
  } catch (error) {
    console.error('Error checking booking:', error);
    return new Response(JSON.stringify({ 
      confirmed: false,
      message: 'Error checking booking status'
    }), { status: 500 });
  }
};