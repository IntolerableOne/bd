import type { APIRoute } from 'astro';
import { prisma } from '../../../../lib/prisma';

export const GET: APIRoute = async ({ params }) => {
  try {
    const availability = await prisma.availability.findUnique({
      where: { id: params.id },
      include: { booking: true }
    });

    if (!availability) {
      return new Response(JSON.stringify({ 
        confirmed: false,
        message: 'Slot not found'
      }), {
        status: 404,
        headers: { 'Content-Type': 'application/json' }
      });
    }

    return new Response(JSON.stringify({ 
      confirmed: availability.booking?.paid === true,
      message: availability.booking?.paid ? 'Booking confirmed' : 'No confirmed booking found'
    }), {
      status: 200,
      headers: { 'Content-Type': 'application/json' }
    });
  } catch (error) {
    console.error('Error checking booking status:', error);
    return new Response(JSON.stringify({ 
      confirmed: false,
      message: 'Error checking booking status'
    }), {
      status: 500,
      headers: { 'Content-Type': 'application/json' }
    });
  }
};