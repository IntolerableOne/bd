// File: src/middleware/auth.ts
// Changes: Consistent use of import.meta.env for JWT_SECRET.

import jwt from 'jsonwebtoken';
import type { APIContext } from 'astro';

// JWT Secret from environment variables
const JWT_SECRET = import.meta.env.JWT_SECRET; // Changed from process.env

if (!JWT_SECRET) {
  console.warn("JWT_SECRET is not set in environment variables. Authentication middleware may not function correctly.");
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
      // 'WWW-Authenticate': 'Bearer realm="api"' // Consider adding for strictness
    }
  });
}