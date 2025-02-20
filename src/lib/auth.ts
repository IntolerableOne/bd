export async function authenticate(email: string, password: string): Promise<string> {
  const response = await fetch('/api/admin/login', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json'
    },
    body: JSON.stringify({ email, password })
  });

  if (!response.ok) {
    throw new Error('Authentication failed');
  }

  const data = await response.json();
  return data.token;
}

export function verifyToken(token: string): boolean {
  // Simple check if token exists and hasn't expired
  if (!token) return false;

  try {
    const [, payload] = token.split('.');
    const decodedPayload = JSON.parse(atob(payload));
    const expirationTime = decodedPayload.exp * 1000; // Convert to milliseconds
    return Date.now() < expirationTime;
  } catch {
    return false;
  }
}