import type { APIRoute } from 'astro';
import { cleanupExpiredHolds } from '../../../lib/holds';
import { authenticateRequest } from '../../../middleware/auth';

export const GET: APIRoute = async ({ request }) => {
  try {
    // Check if request is authenticated for manual runs
    if (request.headers.has('Authorization')) {
      const user = await authenticateRequest(request);
      if (!user) {
        return new Response(JSON.stringify({ error: 'Unauthorized' }), { 
          status: 401,
          headers: { 'Content-Type': 'application/json' }
        });
      }
    } else {
      // Check for cron job secret if not authenticated
      const cronSecret = request.headers.get('x-cron-secret');
      const validSecret = import.meta.env.CRON_SECRET;
      
      if (!cronSecret || cronSecret !== validSecret) {
        return new Response(JSON.stringify({ error: 'Unauthorized' }), { 
          status: 401,
          headers: { 'Content-Type': 'application/json' }
        });
      }
    }

    // Run the cleanup
    const count = await cleanupExpiredHolds();
    
    return new Response(JSON.stringify({ 
      success: true,
      message: `Cleaned up ${count} expired holds`
    }), {
      status: 200,
      headers: { 'Content-Type': 'application/json' }
    });
  } catch (error) {
    console.error('Cleanup error:', error);
    return new Response(JSON.stringify({ 
      error: 'Cleanup failed',
      message: error instanceof Error ? error.message : 'Unknown error'
    }), {
      status: 500,
      headers: { 'Content-Type': 'application/json' }
    });
  }
};