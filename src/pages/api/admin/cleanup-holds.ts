import type { APIRoute } from 'astro';
import { cleanupExpiredHolds, HoldError } from '../../../lib/holds';
import { authenticateRequest, createAuthenticatedResponse } from '../../../middleware/auth';

export const POST: APIRoute = async ({ request }) => {
  // Protection for this endpoint
  const adminUser = await authenticateRequest(request);
  if (!adminUser) {
    const authHeader = request.headers.get('Authorization');
    const cronSecret = process.env.CRON_JOB_SECRET; // For scheduled tasks

    // Check for CRON_JOB_SECRET if you intend to call this via a scheduled task
    if (!cronSecret || !authHeader || authHeader !== `Bearer ${cronSecret}`) {
        console.warn('Unauthorized attempt to access cleanup-holds endpoint.');
        return createAuthenticatedResponse({} as any);
    }
    console.log('Cleanup holds endpoint accessed by CRON job.');
  } else {
    console.log('Cleanup holds endpoint accessed by authenticated admin.');
  }

  try {
    const result = await cleanupExpiredHolds();
    console.log('Cleanup process completed via API.', result);
    return new Response(JSON.stringify({
      message: 'Expired holds cleanup process finished successfully.',
      holdsDeleted: result.holdsDeleted,
      bookingsAbandoned: result.bookingsAbandoned, // Fixed: changed from unpaidBookingsDeleted
      oldBookingsDeleted: result.oldBookingsDeleted,
    }), {
      status: 200,
      headers: { 'Content-Type': 'application/json' },
    });
  } catch (error: any) {
    console.error('API Error during cleanup-holds:', error.message, error);
    const errorCode = error instanceof HoldError ? error.code : 'UNKNOWN_ERROR';
    return new Response(JSON.stringify({
      error: 'Failed to cleanup expired holds.',
      details: error.message,
      code: errorCode,
    }), {
      status: 500,
      headers: { 'Content-Type': 'application/json' },
    });
  }
};