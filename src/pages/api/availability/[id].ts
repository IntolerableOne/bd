import type { APIRoute } from 'astro';
import { prisma } from '../../../lib/prisma';
import { authenticateRequest } from '../../../middleware/auth';

export const DELETE: APIRoute = async ({ request, params }) => {
  try {
    const user = await authenticateRequest(request);
    if (!user) {
      return new Response(JSON.stringify({ error: 'Unauthorized' }), { status: 401 });
    }

    const { id } = params;
    if (!id) {
      return new Response(JSON.stringify({ error: 'ID is required' }), { status: 400 });
    }

    // Check if slot is booked
    const slot = await prisma.availability.findUnique({
      where: { id },
      include: { booking: true }
    });

    if (!slot) {
      return new Response(JSON.stringify({ error: 'Slot not found' }), { status: 404 });
    }

    if (slot.booking) {
      return new Response(JSON.stringify({ error: 'Cannot delete booked slot' }), { status: 400 });
    }

    await prisma.availability.delete({
      where: { id }
    });
    
    return new Response(null, { status: 204 });
  } catch (error) {
    console.error('Error deleting availability:', error);
    return new Response(JSON.stringify({ error: 'Failed to delete availability' }), {
      status: 500
    });
  }
};