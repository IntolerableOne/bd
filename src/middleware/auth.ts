import jwt from 'jsonwebtoken';
import type { APIContext } from 'astro';

export async function authenticateRequest(request: Request) {
  const authHeader = request.headers.get('Authorization');
  if (!authHeader?.startsWith('Bearer ')) {
    console.log('No Authorization header or invalid format');
    return null;
  }

  const token = authHeader.substring(7);
  try {
    // Make sure we have a JWT_SECRET
    const jwtSecret = import.meta.env.JWT_SECRET;
    if (!jwtSecret) {
      console.error('JWT_SECRET environment variable is not set');
      return null;
    }
    
    const decoded = jwt.verify(token, jwtSecret);
    console.log('Token successfully verified');
    return decoded;
  } catch (error) {
    console.error('JWT verification failed:', error);
    return null;
  }
}

export function createAuthenticatedResponse(context: APIContext) {
  return new Response(JSON.stringify({ error: 'Unauthorized' }), {
    status: 401,
    headers: {
      'Content-Type': 'application/json'
    }
  });
}