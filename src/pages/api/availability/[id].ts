import type { APIRoute } from 'astro';
import { prisma } from '../../../lib/prisma';
import { authenticateRequest } from '../../../middleware/auth';

export const DELETE: APIRoute = async ({ request, params }) => {
  try {
    console.log(`DELETE request for availability/${params.id}`);
    
    const user = await authenticateRequest(request);
    if (!user) {
      console.log('Authentication failed');
      return new Response(JSON.stringify({ error: 'Unauthorized' }), { 
        status: 401,
        headers: { 'Content-Type': 'application/json' }
      });
    }

    const { id } = params;
    if (!id) {
      return new Response(JSON.stringify({ error: 'ID is required' }), { 
        status: 400,
        headers: { 'Content-Type': 'application/json' }
      });
    }

    // Check if slot is booked
    const slot = await prisma.availability.findUnique({
      where: { id },
      include: { booking: true }
    });

    if (!slot) {
      return new Response(JSON.stringify({ error: 'Slot not found' }), { 
        status: 404,
        headers: { 'Content-Type': 'application/json' }
      });
    }

    if (slot.booking) {
      return new Response(JSON.stringify({ error: 'Cannot delete booked slot' }), { 
        status: 400,
        headers: { 'Content-Type': 'application/json' }
      });
    }

    // Delete any related holds first
    try {
      await prisma.hold.deleteMany({
        where: { availabilityId: id }
      });
    } catch (error) {
      console.log('Error deleting related holds (continuing):', error);
    }

    // Delete the availability slot
    await prisma.availability.delete({
      where: { id }
    });
    
    return new Response(null, { status: 204 });
  } catch (error) {
    console.error('Error deleting availability:', error);
    return new Response(JSON.stringify({ 
      error: 'Failed to delete availability',
      details: error.message 
    }), {
      status: 500,
      headers: { 'Content-Type': 'application/json' }
    });
  }
};