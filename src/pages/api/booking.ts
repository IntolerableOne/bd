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
    
    // Fetch ALL bookings for admin (both paid and unpaid for debugging)
    const allBookings: BookingWithAvailability[] = await prisma.booking.findMany({
      include: {
        availability: true,
      },
      orderBy: {
        createdAt: 'desc' // Latest bookings first
      },
    });

    console.log(`📋 Found ${allBookings.length} total bookings`);
    
    // Separate paid and unpaid for logging
    const paidBookings = allBookings.filter(b => b.paid);
    const unpaidBookings = allBookings.filter(b => !b.paid);
    
    console.log(`💳 Paid bookings: ${paidBookings.length}`);
    console.log(`⏳ Unpaid bookings: ${unpaidBookings.length}`);
    
    if (unpaidBookings.length > 0) {
      console.log('⚠️ Unpaid bookings found (may indicate webhook issues):');
      unpaidBookings.forEach(booking => {
        const ageMinutes = Math.floor((new Date().getTime() - new Date(booking.createdAt).getTime()) / (1000 * 60));
        console.log(`  - ${booking.id}: ${booking.name} (${booking.email}) - Age: ${ageMinutes} minutes`);
      });
    }

    // Calculate earnings from paid bookings only
    const earnings = {
      monthly: {} as Record<string, number>,
      yearly: 0,
    };

    const currentYear = new Date().getFullYear();

    paidBookings.forEach((booking: BookingWithAvailability) => {
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

    // Return ALL bookings but mark which are paid/unpaid for admin visibility
    const bookingsWithStatus = allBookings.map(booking => ({
      ...booking,
      _debug: {
        isPaid: booking.paid,
        ageMinutes: Math.floor((new Date().getTime() - new Date(booking.createdAt).getTime()) / (1000 * 60)),
        hasAvailability: !!booking.availability
      }
    }));

    return new Response(JSON.stringify({ 
      bookings: bookingsWithStatus, 
      earnings,
      _debug: {
        totalBookings: allBookings.length,
        paidBookings: paidBookings.length,
        unpaidBookings: unpaidBookings.length,
        oldestUnpaidMinutes: unpaidBookings.length > 0 ? Math.max(...unpaidBookings.map(b => 
          Math.floor((new Date().getTime() - new Date(b.createdAt).getTime()) / (1000 * 60))
        )) : 0
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
      earnings: { monthly: {}, yearly: 0 }
    }), {
      status: 500,
      headers: { 'Content-Type': 'application/json' },
    });
  }
}