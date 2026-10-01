/**
 * Base URL for every backend REST call and Socket.IO connection.
 *
 * NEXT_PUBLIC_* is inlined at build time, so a production build must have this
 * set or every customer would silently call their own localhost. That is why
 * it is a required variable rather than an optional override.
 */
function resolveApiUrl(): string {
  const configured = process.env.NEXT_PUBLIC_API_URL?.trim() || 'http://localhost:3001';
  return configured.replace(/\/+$/, '');
}

export const API_URL = resolveApiUrl();

export async function fetchAPI<T>(endpoint: string, options?: RequestInit): Promise<T> {
  const url = `${API_URL}${endpoint}`;
  const response = await fetch(url, {
    ...options,
    headers: {
      'Content-Type': 'application/json',
      ...options?.headers,
    },
  });

  if (!response.ok) {
    const error = await response.json().catch(() => ({ message: response.statusText }));
    throw new Error(error.message || 'API request failed');
  }

  return response.json();
}

export async function fetchWithAuth<T>(
  endpoint: string,
  token: string,
  options?: RequestInit,
): Promise<T> {
  return fetchAPI<T>(endpoint, {
    ...options,
    headers: {
      ...options?.headers,
      Authorization: `Bearer ${token}`,
    },
  });
}