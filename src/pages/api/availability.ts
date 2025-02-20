import type { APIRoute } from 'astro';
import { prisma } from '../../lib/prisma';
import { authenticateRequest } from '../../middleware/auth';

export const GET: APIRoute = async ({ request }) => {
  try {
    // Non-authenticated users only see available slots
    if (!request.headers.get('Authorization')) {
      const slots = await prisma.availability.findMany({
        where: {
          booking: null
        },
        orderBy: {
          date: 'asc'
        }
      });
      
      return new Response(JSON.stringify(slots), {
        status: 200,
        headers: { 'Content-Type': 'application/json' }
      });
    }

    // Authenticated users see all slots with booking info
    const user = await authenticateRequest(request);
    if (!user) {
      return new Response(JSON.stringify({ error: 'Unauthorized' }), { status: 401 });
    }

    const slots = await prisma.availability.findMany({
      include: {
        booking: true
      },
      orderBy: {
        date: 'asc'
      }
    });
    
    return new Response(JSON.stringify(slots), {
      status: 200,
      headers: { 'Content-Type': 'application/json' }
    });
  } catch (error) {
    console.error('Error fetching availability:', error);
    return new Response(JSON.stringify({ error: 'Failed to fetch availability' }), {
      status: 500
    });
  }
};

export const POST: APIRoute = async ({ request }) => {
  try {
    const user = await authenticateRequest(request);
    if (!user) {
      return new Response(JSON.stringify({ error: 'Unauthorized' }), { status: 401 });
    }

    const data = await request.json();
    
    const slot = await prisma.availability.create({
      data: {
        date: new Date(data.date),
        startTime: data.startTime,
        endTime: data.endTime,
        midwife: data.midwife
      }
    });
    
    return new Response(JSON.stringify(slot), {
      status: 201,
      headers: { 'Content-Type': 'application/json' }
    });
  } catch (error) {
    console.error('Error creating availability:', error);
    return new Response(JSON.stringify({ error: 'Failed to create availability' }), {
      status: 500
    });
  }
};