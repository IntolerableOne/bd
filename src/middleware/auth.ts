
import jwt from 'jsonwebtoken';
import type { APIContext } from 'astro';

// Change from import.meta.env to process.env for server-side
const JWT_SECRET = process.env.JWT_SECRET;

if (!JWT_SECRET) {
  console.warn("JWT_SECRET is not set in environment variables. Authentication middleware may not function correctly.");
}

export async function authenticateRequest(request: Request): Promise<jwt.JwtPayload | null | string> {
  const authHeader = request.headers.get('Authorization');
  if (!authHeader?.startsWith('Bearer ')) {
    return null;
  }

  const token = authHeader.substring(7);
  if (!token) {
    return null;
  }

  if (!JWT_SECRET) {
    console.error("Cannot verify token: JWT_SECRET is not configured.");
    return null;
  }

  try {
    const decoded = jwt.verify(token, JWT_SECRET);
    return decoded as jwt.JwtPayload;
  } catch (error) {
    console.error("Token verification failed:", error);
    return null;
  }
}

export function createAuthenticatedResponse(_context?: APIContext) {
  return new Response(JSON.stringify({ error: 'Unauthorized', message: 'Valid authentication token required.' }), {
    status: 401,
    headers: {
      'Content-Type': 'application/json',
    }
  });
}