// File: src/pages/api/admin/cleanup-holds.ts
// Purpose: API endpoint to trigger the cleanup of expired slot holds.
// This imports from the updated lib/holds.ts.

import type { APIRoute } from 'astro';
// Ensure the path to lib/holds.ts is correct relative to this file.
// If this file is in src/pages/api/admin/, then ../../../lib/holds is correct.
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
        return createAuthenticatedResponse({} as any); // Use your standard unauthorized response
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
      unpaidBookingsDeleted: result.unpaidBookingsDeleted,
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
