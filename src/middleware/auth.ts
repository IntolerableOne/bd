// File: src/middleware/auth.ts
// Changes: Removed unused 'context' parameter from createAuthenticatedResponse.
// If it was intended for future use, it should be typed appropriately.

import jwt from 'jsonwebtoken';
import type { APIContext } from 'astro'; // Keep APIContext if other functions here need it

// JWT Secret should ideally come from environment variables
const JWT_SECRET = process.env.JWT_SECRET;

if (!JWT_SECRET) {
    console.warn("JWT_SECRET is not set. Authentication middleware may not function correctly.");
}

export async function authenticateRequest(request: Request): Promise<jwt.JwtPayload | null | string> {
  const authHeader = request.headers.get('Authorization');
  if (!authHeader?.startsWith('Bearer ')) {
    return null;
  }

  const token = authHeader.substring(7); // "Bearer ".length
  if (!token) {
    return null;
  }

  if (!JWT_SECRET) {
    console.error("Cannot verify token: JWT_SECRET is not configured.");
    return null; // Or throw an error
  }

  try {
    const decoded = jwt.verify(token, JWT_SECRET);
    return decoded as jwt.JwtPayload; // Cast to JwtPayload for better typing
  } catch (error) {
    console.error("Token verification failed:", error);
    return null;
  }
}

// Removed unused 'context' parameter.
// If you need context for specific response modifications (e.g., cookies), add it back with proper typing.
export function createAuthenticatedResponse(_context?: APIContext) { // Made context optional or remove if truly unused
  return new Response(JSON.stringify({ error: 'Unauthorized', message: 'Valid authentication token required.' }), {
    status: 401,
    headers: {
      'Content-Type': 'application/json',
      // Consider adding WWW-Authenticate header for 401 responses
      // 'WWW-Authenticate': 'Bearer realm="api"'
    }
  });
}
