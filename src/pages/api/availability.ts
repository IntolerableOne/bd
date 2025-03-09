import type { APIRoute } from 'astro';
import { prisma } from '../../lib/prisma';
import { authenticateRequest } from '../../middleware/auth';

export const GET: APIRoute = async ({ request }) => {
  try {
    const authHeader = request.headers.get('Authorization');
    const isAdmin = authHeader?.startsWith('Bearer ');
    
    // For non-authenticated users (public view), only show available slots
    if (!isAdmin) {
      console.log('Public request - returning only available slots');
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

    // For authenticated users, verify token
    console.log('Admin request - attempting authentication');
    try {
      const user = await authenticateRequest(request);
      if (!user) {
        console.log('Authentication failed');
        return new Response(JSON.stringify({ error: 'Unauthorized' }), { 
          status: 401,
          headers: { 'Content-Type': 'application/json' }
        });
      }
      
      console.log('Authentication successful - returning all slots');
      // Fetch all slots with booking and hold info
      const slots = await prisma.availability.findMany({
        include: {
          booking: true,
          hold: true
        },
        orderBy: {
          date: 'asc'
        }
      });
      
      return new Response(JSON.stringify(slots), {
        status: 200,
        headers: { 'Content-Type': 'application/json' }
      });
    } catch (authError) {
      console.error('Authentication error:', authError);
      return new Response(JSON.stringify({ error: 'Authentication failed' }), { 
        status: 401,
        headers: { 'Content-Type': 'application/json' }
      });
    }
  } catch (error) {
    console.error('Error fetching availability:', error);
    return new Response(JSON.stringify({ error: 'Failed to fetch availability' }), {
      status: 500
    });
  }
};

export const POST: APIRoute = async ({ request }) => {
  try {
    console.log('Creating availability - checking authorization');
    // Verify admin authentication
    const user = await authenticateRequest(request);
    if (!user) {
      console.log('Authentication failed for POST request');
      return new Response(JSON.stringify({ error: 'Unauthorized' }), { 
        status: 401,
        headers: { 'Content-Type': 'application/json' }
      });
    }

    const data = await request.json();
    console.log('Creating slot with data:', data);
    
    try {
      const slot = await prisma.availability.create({
        data: {
          date: new Date(data.date),
          startTime: data.startTime,
          endTime: data.endTime,
          midwife: data.midwife
        }
      });
      
      console.log('Slot created successfully:', slot.id);
      return new Response(JSON.stringify(slot), {
        status: 201,
        headers: { 'Content-Type': 'application/json' }
      });
    } catch (createError) {
      console.error('Error creating availability:', createError);
      return new Response(JSON.stringify({ 
        error: 'Failed to create availability',
        details: createError.message 
      }), {
        status: 500
      });
    }
  } catch (error) {
    console.error('Error in POST handler:', error);
    return new Response(JSON.stringify({ error: 'Failed to create availability' }), {
      status: 500
    });
  }
};