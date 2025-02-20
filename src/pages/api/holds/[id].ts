import type { APIRoute } from 'astro';
import { releaseHold } from '../../../lib/holds';

export const DELETE: APIRoute = async ({ params }) => {
  try {
    const { id } = params;
    if (!id) {
      return new Response(JSON.stringify({ error: 'ID is required' }), { 
        status: 400,
        headers: { 'Content-Type': 'application/json' }
      });
    }

    await releaseHold(id);
    
    return new Response(null, { status: 204 });
  } catch (error) {
    console.error('Error releasing hold:', error);
    return new Response(JSON.stringify({ error: 'Failed to release hold' }), {
      status: 500,
      headers: { 'Content-Type': 'application/json' }
    });
  }
};