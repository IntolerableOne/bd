import type { APIContext } from 'astro';
import { prisma } from '../../lib/prisma';
import { cleanupExpiredHolds } from '../../lib/holds';

export async function GET({ url }: APIContext) {
  try {
    // Try to clean up expired holds, but continue even if it fails
    try {
      await cleanupExpiredHolds();
    } catch (error) {
      console.error('Warning: Could not clean up expired holds:', error);
      // Continue execution even if cleanup fails
    }
    
    const startDate = url.searchParams.get('startDate');
    const endDate = url.searchParams.get('endDate');

    if (!startDate || !endDate) {
      return new Response(JSON.stringify({ error: 'Start and end dates are required' }), {
        status: 400,
        headers: { 'Content-Type': 'application/json' }
      });
    }

    // Get current time plus 2 hours
    const minDateTime = new Date(Date.now() + (2 * 60 * 60 * 1000));
    minDateTime.setMinutes(0, 0, 0); // Round to nearest hour

    // Parse the dates and ensure they're valid
    const parsedStartDate = new Date(startDate);
    const parsedEndDate = new Date(endDate);

    if (isNaN(parsedStartDate.getTime()) || isNaN(parsedEndDate.getTime())) {
      return new Response(JSON.stringify({ error: 'Invalid date format' }), {
        status: 400,
        headers: { 'Content-Type': 'application/json' }
      });
    }

    try {
      // Find slots that are:
      // 1. Within the date range
      // 2. After the minimum booking time
      // 3. Have no booking
      // 4. Have either no hold, or the hold has expired
      const slots = await prisma.availability.findMany({
        where: {
          AND: [
            {
              date: {
                gte: parsedStartDate,
                lte: parsedEndDate
              }
            },
            {
              date: {
                gte: minDateTime
              }
            },
            {
              booking: null
            },
            {
              OR: [
                { hold: null },
                {
                  hold: {
                    expiresAt: {
                      lt: new Date()
                    }
                  }
                }
              ]
            }
          ]
        },
        orderBy: {
          date: 'asc'
        }
      });

      return new Response(JSON.stringify(slots), {
        status: 200,
        headers: {
          'Content-Type': 'application/json',
          'Cache-Control': 'no-cache'
        }
      });
    } catch (dbError) {
      console.error('Database query error:', dbError);
      // Return mock/empty data instead of failing completely
      return new Response(JSON.stringify([]), {
        status: 200,
        headers: {
          'Content-Type': 'application/json',
          'Cache-Control': 'no-cache'
        }
      });
    }
  } catch (error) {
    console.error('Error fetching available slots:', error);
    // Return empty array instead of error to prevent UI from breaking
    return new Response(JSON.stringify([]), {
      status: 200,
      headers: { 'Content-Type': 'application/json' }
    });
  }
}