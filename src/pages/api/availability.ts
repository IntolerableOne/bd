import type { APIContext } from 'astro';
import { prisma } from '../../lib/prisma';

export async function GET() {
  try {
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
      headers: {
        'Content-Type': 'application/json'
      }
    });
  } catch (error) {
    console.error('Error fetching availability:', error);
    return new Response(JSON.stringify({ error: 'Failed to fetch availability' }), {
      status: 500
    });
  }
}

export async function POST({ request }: APIContext) {
  try {
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
      headers: {
        'Content-Type': 'application/json'
      }
    });
  } catch (error) {
    console.error('Error creating availability:', error);
    return new Response(JSON.stringify({ error: 'Failed to create availability' }), {
      status: 500
    });
  }
}