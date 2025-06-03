import type { APIContext } from 'astro';
import { prisma } from '../../lib/prisma';

export async function GET({ url }: APIContext) {
  try {
    const startDate = url.searchParams.get('startDate');
    const endDate = url.searchParams.get('endDate');

    // Validate required parameters
    if (!startDate || !endDate) {
      console.warn('❌ Available slots request missing date parameters');
      return new Response(JSON.stringify({ 
        error: 'Start and end dates are required',
        details: 'Please provide both startDate and endDate query parameters'
      }), {
        status: 400,
        headers: { 'Content-Type': 'application/json' }
      });
    }

    // Parse and validate dates
    const parsedStartDate = new Date(startDate);
    const parsedEndDate = new Date(endDate);

    if (isNaN(parsedStartDate.getTime()) || isNaN(parsedEndDate.getTime())) {
      console.warn('❌ Invalid date format in available slots request:', { startDate, endDate });
      return new Response(JSON.stringify({ 
        error: 'Invalid date format',
        details: 'Dates must be in ISO format (YYYY-MM-DDTHH:mm:ss.sssZ)'
      }), {
        status: 400,
        headers: { 'Content-Type': 'application/json' }
      });
    }

    // Validate date range
    if (parsedStartDate > parsedEndDate) {
      return new Response(JSON.stringify({ 
        error: 'Invalid date range',
        details: 'Start date must be before or equal to end date'
      }), {
        status: 400,
        headers: { 'Content-Type': 'application/json' }
      });
    }

    // Prevent excessively large date ranges (max 30 days)
    const daysDifference = Math.abs(parsedEndDate.getTime() - parsedStartDate.getTime()) / (1000 * 60 * 60 * 24);
    if (daysDifference > 30) {
      return new Response(JSON.stringify({ 
        error: 'Date range too large',
        details: 'Maximum date range is 30 days'
      }), {
        status: 400,
        headers: { 'Content-Type': 'application/json' }
      });
    }

    // Calculate minimum booking time (2 hours from now)
    const minDateTime = new Date(Date.now() + (2 * 60 * 60 * 1000));
    minDateTime.setMinutes(0, 0, 0); // Round to nearest hour

    // Use the later of parsed start date or minimum booking time
    const effectiveStartDate = new Date(Math.max(parsedStartDate.getTime(), minDateTime.getTime()));

    console.log(`🔍 Fetching available slots: ${effectiveStartDate.toISOString()} to ${parsedEndDate.toISOString()}`);

    const slots = await prisma.availability.findMany({
      where: {
        AND: [
          {
            date: {
              gte: effectiveStartDate,
              lte: parsedEndDate
            }
          },
          {
            booking: null // Only slots without bookings
          }
        ]
      },
      orderBy: [
        { date: 'asc' },
        { startTime: 'asc' }
      ],
      // Limit results to prevent excessive data transfer
      take: 500
    });

    console.log(`✅ Found ${slots.length} available slots`);

    // Add debug info in development
    const isDevelopment = process.env.NODE_ENV === 'development';
    const response = {
      slots,
      ...(isDevelopment && {
        _debug: {
          requestedStart: startDate,
          requestedEnd: endDate,
          effectiveStart: effectiveStartDate.toISOString(),
          minBookingTime: minDateTime.toISOString(),
          totalFound: slots.length
        }
      })
    };

    return new Response(JSON.stringify(isDevelopment ? response : slots), {
      status: 200,
      headers: {
        'Content-Type': 'application/json',
        'Cache-Control': 'no-cache, no-store, must-revalidate',
        'Pragma': 'no-cache',
        'Expires': '0'
      }
    });
  } catch (error: any) {
    console.error('❌ Error fetching available slots:', error);
    
    // Handle specific Prisma errors
    if (error.code === 'P2028') {
      return new Response(JSON.stringify({ 
        error: 'Database connection timeout',
        details: 'Please try again in a moment'
      }), {
        status: 503,
        headers: { 'Content-Type': 'application/json' }
      });
    }

    return new Response(JSON.stringify({ 
      error: 'Failed to fetch available slots',
      details: process.env.NODE_ENV === 'development' ? error.message : 'Internal server error'
    }), {
      status: 500,
      headers: { 'Content-Type': 'application/json' }
    });
  }
}