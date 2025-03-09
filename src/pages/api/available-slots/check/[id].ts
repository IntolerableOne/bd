import type { APIRoute } from 'astro';
import { prisma } from '../../../../lib/prisma';

export const GET: APIRoute = async ({ params }) => {
  try {
    const { id } = params;
    if (!id) {
      return new Response(JSON.stringify({ error: 'ID is required' }), { 
        status: 400,
        headers: { 'Content-Type': 'application/json' }
      });
    }

    // Find the availability slot and check if it's booked
    const slot = await prisma.availability.findUnique({
      where: { id },
      include: {
        booking: true,
        hold: true
      }
    });

    if (!slot) {
      return new Response(JSON.stringify({ 
        available: false,
        error: 'Slot not found'
      }), { 
        status: 404,
        headers: { 'Content-Type': 'application/json' }
      });
    }

    // Check if slot is already booked
    if (slot.booking) {
      return new Response(JSON.stringify({ 
        available: false,
        error: 'Slot is already booked'
      }), {
        status: 200,
        headers: { 'Content-Type': 'application/json' }
      });
    }

    // Check if slot has an active hold by someone else
    if (slot.hold && slot.hold.expiresAt > new Date()) {
      return new Response(JSON.stringify({ 
        available: false,
        error: 'Slot is currently reserved by another user'
      }), {
        status: 200,
        headers: { 'Content-Type': 'application/json' }
      });
    }

    // Check if slot is in the past
    if (new Date(slot.date) < new Date()) {
      return new Response(JSON.stringify({ 
        available: false,
        error: 'Slot is in the past'
      }), {
        status: 200,
        headers: { 'Content-Type': 'application/json' }
      });
    }

    return new Response(JSON.stringify({ 
      available: true 
    }), {
      status: 200,
      headers: { 'Content-Type': 'application/json' }
    });
  } catch (error) {
    console.error('Error checking slot availability:', error);
    return new Response(JSON.stringify({ 
      error: 'Failed to check availability',
      available: false
    }), {
      status: 500,
      headers: { 'Content-Type': 'application/json' }
    });
  }
};