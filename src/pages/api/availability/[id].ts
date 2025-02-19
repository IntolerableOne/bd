import type { APIContext } from 'astro';
import { prisma } from '../../../lib/prisma';

export async function DELETE({ params }: APIContext) {
  try {
    const { id } = params;
    if (!id) {
      return new Response(JSON.stringify({ error: 'ID is required' }), {
        status: 400
      });
    }

    await prisma.availability.delete({
      where: {
        id: id
      }
    });
    
    return new Response(null, {
      status: 204
    });
  } catch (error) {
    console.error('Error deleting availability:', error);
    return new Response(JSON.stringify({ error: 'Failed to delete availability' }), {
      status: 500
    });
  }
}