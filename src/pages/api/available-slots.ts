import type { APIContext } from 'astro';
import { prisma } from '../../lib/prisma';

export async function GET({ url }: APIContext) {
  try {
    const startDate = url.searchParams.get('startDate');
    const endDate = url.searchParams.get('endDate');

    console.log('Received date range:', { startDate, endDate });

    if (!startDate || !endDate) {
      return new Response(JSON.stringify({ error: 'Start and end dates are required' }), {
        status: 400,
        headers: {
          'Content-Type': 'application/json'
        }
      });
    }

    // Parse dates and ensure they're valid
    const startDateTime = new Date(startDate);
    const endDateTime = new Date(endDate);

    console.log('Parsed dates:', {
      startDateTime,
      endDateTime
    });

    if (isNaN(startDateTime.getTime()) || isNaN(endDateTime.getTime())) {
      return new Response(JSON.stringify({ error: 'Invalid date format' }), {
        status: 400,
        headers: {
          'Content-Type': 'application/json'
        }
      });
    }

    // Log the query we're about to make
    console.log('Querying for slots between:', {
      start: startDateTime.toISOString(),
      end: endDateTime.toISOString()
    });

    const slots = await prisma.availability.findMany({
      where: {
        date: {
          gte: startDateTime,
          lte: endDateTime
        },
        booking: null
      },
      orderBy: {
        date: 'asc'
      }
    });

    console.log('Found slots:', slots);

    return new Response(JSON.stringify(slots), {
      status: 200,
      headers: {
        'Content-Type': 'application/json'
      }
    });
  } catch (error) {
    console.error('Error fetching available slots:', error);
    return new Response(JSON.stringify({ error: 'Failed to fetch slots' }), {
      status: 500,
      headers: {
        'Content-Type': 'application/json'
      }
    });
  }
}