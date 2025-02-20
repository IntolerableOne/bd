import type { APIRoute } from 'astro';
import { releaseHold, HoldError } from '../../../lib/holds';

export const DELETE: APIRoute = async ({ params }) => {
  try {
    const { id } = params;
    if (!id) {
      return new Response(
        JSON.stringify({ error: 'ID is required' }), 
        { 
          status: 400,
          headers: { 'Content-Type': 'application/json' }
        }
      );
    }

    const released = await releaseHold(id);
    
    if (!released) {
      return new Response(
        JSON.stringify({ message: 'No hold found to release' }), 
        { 
          status: 200,
          headers: { 'Content-Type': 'application/json' }
        }
      );
    }

    return new Response(null, { status: 204 });
  } catch (error) {
    console.error('Error releasing hold:', error);
    
    if (error instanceof HoldError) {
      return new Response(
        JSON.stringify({ 
          error: error.message,
          code: error.code 
        }), 
        {
          status: error.code === 'INTERNAL_ERROR' ? 500 : 400,
          headers: { 'Content-Type': 'application/json' }
        }
      );
    }

    return new Response(
      JSON.stringify({ error: 'Failed to release hold' }), 
      {
        status: 500,
        headers: { 'Content-Type': 'application/json' }
      }
    );
  }
};