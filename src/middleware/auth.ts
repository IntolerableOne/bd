import jwt from 'jsonwebtoken';
import type { APIContext } from 'astro';

export async function authenticateRequest(request: Request) {
  const authHeader = request.headers.get('Authorization');
  if (!authHeader?.startsWith('Bearer ')) {
    return null;
  }

  const token = authHeader.substring(7);
  try {
    const decoded = jwt.verify(token, import.meta.env.JWT_SECRET);
    return decoded;
  } catch {
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