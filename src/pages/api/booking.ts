import type { APIContext } from 'astro';
import { prisma } from '../../lib/prisma';
import { type Prisma } from '@prisma/client';
import { authenticateRequest, createAuthenticatedResponse } from '../../middleware/auth';

type BookingWithAvailability = Prisma.BookingGetPayload<{
  include: { availability: true }
}>;

export async function GET({ request }: APIContext) {
  const adminUser = await authenticateRequest(request);
  if (!adminUser) {
    return createAuthenticatedResponse({} as any);
  }

  try {
    console.log('📊 Admin requesting booking data...');
    
    // Fetch ALL bookings for admin (paid, unpaid, abandoned, cancelled)
    const allBookings: BookingWithAvailability[] = await prisma.booking.findMany({
      include: {
        availability: true,
      },
      orderBy: {
        createdAt: 'desc' // Latest bookings first
      },
    });

    console.log(`📋 Found ${allBookings.length} total bookings`);
    
    // Categorize bookings by status
    const confirmedBookings = allBookings.filter(b => b.paid && b.status === 'CONFIRMED');
    const pendingBookings = allBookings.filter(b => !b.paid && b.status === 'PENDING');
    const abandonedBookings = allBookings.filter(b => b.status === 'ABANDONED');
    const cancelledBookings = allBookings.filter(b => b.status === 'CANCELLED');
    
    console.log(`💳 Confirmed bookings: ${confirmedBookings.length}`);
    console.log(`⏳ Pending bookings: ${pendingBookings.length}`);
    console.log(`🏃 Abandoned bookings: ${abandonedBookings.length}`);
    console.log(`❌ Cancelled bookings: ${cancelledBookings.length}`);
    
    // Log recent abandoned bookings for follow-up
    const recentAbandoned = abandonedBookings.filter(b => {
      const daysSinceCreated = (new Date().getTime() - new Date(b.createdAt).getTime()) / (1000 * 60 * 60 * 24);
      return daysSinceCreated <= 30; // Within last 30 days
    });
    
    if (recentAbandoned.length > 0) {
      console.log(`📧 Recent abandoned bookings for follow-up: ${recentAbandoned.length}`);
    }

    // Calculate earnings from confirmed bookings only
    const earnings = {
      monthly: {} as Record<string, number>,
      yearly: 0,
    };

    const currentYear = new Date().getFullYear();

    confirmedBookings.forEach((booking: BookingWithAvailability) => {
      const amountInPence = Number(booking.amount);

      if (booking.availability && !isNaN(amountInPence)) {
        const bookingDate = new Date(booking.availability.date);
        const year = bookingDate.getFullYear();
        const month = bookingDate.getMonth();
        const yearMonthKey = `${year}-${String(month + 1).padStart(2, '0')}`;

        // Add to monthly earnings
        earnings.monthly[yearMonthKey] = (earnings.monthly[yearMonthKey] || 0) + amountInPence;

        // Add to yearly earnings if current year
        if (year === currentYear) {
          earnings.yearly += amountInPence;
        }
      }
    });

    console.log(`💰 Total yearly earnings: £${(earnings.yearly / 100).toFixed(2)}`);

    // Return ALL bookings with enhanced metadata
    const bookingsWithMetadata = allBookings.map(booking => ({
      ...booking,
      _metadata: {
        status: booking.status,
        isPaid: booking.paid,
        ageInDays: Math.floor((new Date().getTime() - new Date(booking.createdAt).getTime()) / (1000 * 60 * 60 * 24)),
        hasAvailability: !!booking.availability,
        isRecentAbandoned: booking.status === 'ABANDONED' && 
          ((new Date().getTime() - new Date(booking.createdAt).getTime()) / (1000 * 60 * 60 * 24)) <= 30
      }
    }));

    return new Response(JSON.stringify({ 
      bookings: bookingsWithMetadata, 
      earnings,
      statistics: {
        total: allBookings.length,
        confirmed: confirmedBookings.length,
        pending: pendingBookings.length,
        abandoned: abandonedBookings.length,
        cancelled: cancelledBookings.length,
        recentAbandoned: recentAbandoned.length
      }
    }), {
      status: 200,
      headers: {
        'Content-Type': 'application/json',
      },
    });
  } catch (error: any) {
    console.error('❌ Error fetching bookings:', error);
    return new Response(JSON.stringify({ 
      error: 'Failed to fetch bookings', 
      details: error.message,
      bookings: [],
      earnings: { monthly: {}, yearly: 0 },
      statistics: {
        total: 0,
        confirmed: 0,
        pending: 0,
        abandoned: 0,
        cancelled: 0,
        recentAbandoned: 0
      }
    }), {
      status: 500,
      headers: { 'Content-Type': 'application/json' },
    });
  }
}