/**
 * Server-side helpers for talking to the backend from React Server Components.
 *
 * These run on the server, so they must use a reachable host rather than the
 * browser-facing API URL. `BACKEND_INTERNAL_URL` lets a deployment point at a
 * loopback address or a service binding; otherwise BACKEND_URL is used.
 */

const INTERNAL = () =>
  (process.env.BACKEND_INTERNAL_URL ?? process.env.BACKEND_URL ?? 'http://localhost:3001')
    .replace(/\/+$/, '');

async function get<T>(path: string, fallback: T): Promise<T> {
  try {
    const res = await fetch(`${INTERNAL()}${path}`, { cache: 'no-store' });
    if (!res.ok) return fallback;
    return (await res.json()) as T;
  } catch {
    return fallback;
  }
}

export type LatestPaymentStatus = {
  orderId: string;
  orderNumber: number;
  paymentStatus: 'PENDING' | 'PAID' | 'FAILED';
  paid: boolean;
  trackingToken: string | null;
};

/** Most recent pending or paid order, used only as a redirect fallback. */
export function getLatestPaymentStatus(): Promise<LatestPaymentStatus | null> {
  return get<LatestPaymentStatus | null>('/payments/payhere/status/latest', null);
}