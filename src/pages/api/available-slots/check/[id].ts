export const GET: APIRoute = async ({ params }) => {
    const slot = await prisma.availability.findUnique({
      where: { id: params.id },
      include: { booking: true }
    });
  
    if (!slot) {
      return new Response(JSON.stringify({ 
        available: false, 
        message: 'Slot not found' 
      }), { status: 404 });
    }
  
    return new Response(JSON.stringify({ 
      available: !slot.booking 
    }));
  };