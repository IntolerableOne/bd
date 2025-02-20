import type { APIContext } from 'astro';
import { prisma } from '../../lib/prisma';

export async function GET({ url }: APIContext) {
  try {
    const startDate = url.searchParams.get('startDate');
    const endDate = url.searchParams.get('endDate');

    if (!startDate || !endDate) {
      return new Response(JSON.stringify({ error: 'Start and end dates are required' }), {
        status: 400,
        headers: { 'Content-Type': 'application/json' }
      });
    }

    const startDateTime = new Date(startDate);
    const endDateTime = new Date(endDate);

    if (isNaN(startDateTime.getTime()) || isNaN(endDateTime.getTime())) {
      return new Response(JSON.stringify({ error: 'Invalid date format' }), {
        status: 400,
        headers: { 'Content-Type': 'application/json' }
      });
    }

    // Get current time plus 2 hours
    const minDateTime = new Date(Date.now() + (2 * 60 * 60 * 1000));
    minDateTime.setMinutes(0, 0, 0); // Round to nearest hour

    const slots = await prisma.availability.findMany({
      where: {
        date: {
          gte: startDateTime,
          lte: endDateTime
        },
        AND: [
          {
            date: {
              gte: minDateTime
            }
          },
          {
            booking: null // Only return slots that aren't booked
          }
        ]
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
    console.error('Error fetching available slots:', error);
    return new Response(JSON.stringify({ error: 'Failed to fetch slots' }), {
      status: 500,
      headers: { 'Content-Type': 'application/json' }
    });
  }
}