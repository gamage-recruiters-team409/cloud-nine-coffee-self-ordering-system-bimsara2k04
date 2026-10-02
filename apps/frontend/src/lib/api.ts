/**
 * Base URL for every backend REST call and Socket.IO connection.
 *
 * NEXT_PUBLIC_* is inlined at build time, so a value baked in at build time
 * only ever works for the host it was built against. That is not good enough
 * here: the same bundle is loaded from `localhost:3000` while developing and
 * from `192.168.x.x:3000` when a customer scans the tracking QR with a phone.
 * A build-time `localhost` makes every phone call its own machine and silently
 * render an empty page, so it can never be the default.
 *
 * Instead, on the client the backend is derived from `window.location`, which
 * always points at whichever host the page was actually served from. The
 * env var remains the override for server rendering and for deployments where
 * the API genuinely lives on a different host than the frontend.
 */

const API_PORT = '3001';

function normalize(url: string): string {
  return url.replace(/\/+$/, '');
}

function configuredApiUrl(): string | undefined {
  const configured = process.env.NEXT_PUBLIC_API_URL?.trim();
  return configured ? normalize(configured) : undefined;
}

const LOOPBACK = /^(localhost|127\.0\.0\.1|0\.0\.0\.0|\[::1\])$/i;

function hostOf(url: string): string {
  try {
    return new URL(url).hostname;
  } catch {
    return '';
  }
}

/**
 * Resolve the API base URL for the current execution context.
 *
 * Client: the configured env var when it points somewhere genuinely remote,
 * otherwise the same hostname the page was served from. One build then works
 * on localhost, on a LAN address, and against a tunnel, while still allowing
 * a real remote API to be pinned via NEXT_PUBLIC_API_URL. A configured
 * localhost is deliberately ignored on the client, because a phone loading the
 * page would then call its own machine.
 *
 * Server: the configured env var, since there is no meaningful window.
 */
export function resolveApiUrl(): string {
  if (typeof window !== 'undefined') {
    const configured = configuredApiUrl();
    if (configured && !LOOPBACK.test(hostOf(configured))) {
      return configured;
    }
    return `${window.location.protocol}//${window.location.hostname}:${API_PORT}`;
  }
  return configuredApiUrl() ?? `http://localhost:${API_PORT}`;
}

export const API_URL = resolveApiUrl();

/**
 * Upper bound on any single REST call.
 *
 * Without this a request that hangs at the TCP level never settles, so callers
 * stuck in a `loading` branch render a spinner forever with no error and no
 * retry. 15s is long enough for the sanitized tracking GETs on a phone over
 * congested Wi-Fi, and short enough that a failure surfaces as a real message.
 */
const REQUEST_TIMEOUT_MS = 15000;

export async function fetchAPI<T>(endpoint: string, options?: RequestInit): Promise<T> {
  const url = `${resolveApiUrl()}${endpoint}`;

  // Honour a caller-supplied signal, otherwise impose our own timeout.
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), REQUEST_TIMEOUT_MS);

  if (options?.signal) {
    if (options.signal.aborted) controller.abort();
    else options.signal.addEventListener('abort', () => controller.abort(), { once: true });
  }

  let response: Response;

  try {
    response = await fetch(url, {
      ...options,
      signal: controller.signal,
      headers: {
        'Content-Type': 'application/json',
        ...options?.headers,
      },
    });
  } catch (error) {
    // A timeout must surface as an actionable message, not a silent hang.
    if (controller.signal.aborted) {
      throw new Error('The server took too long to respond. Check your connection and try again.');
    }
    throw error;
  } finally {
    clearTimeout(timeout);
  }

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