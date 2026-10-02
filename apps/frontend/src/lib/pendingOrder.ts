/**
 * Remembers which order the kiosk is waiting on across the PayHere redirect.
 *
 * PayHe's return_url redirect does not reliably preserve the query string we
 * build into it. When it drops `orderId`, the return page has nothing to poll
 * with and sits on the spinner forever, so the order is stashed before the
 * browser leaves for the gateway.
 */

export const PENDING_ORDER_KEY = 'payhere_pending_order';

export type StoredPendingOrder = {
  orderId: string;
  orderNumber: number;
  /**
   * The tracking token is minted when the order is created, so the kiosk can
   * render the QR immediately on return from PayHere without waiting for any
   * network round trip.
   */
  trackingToken?: string | null;
};

export function rememberPendingOrder(order: StoredPendingOrder): void {
  try {
    sessionStorage.setItem(PENDING_ORDER_KEY, JSON.stringify(order));
  } catch {
    // Private browsing or storage disabled: the return page falls back to
    // /payments/payhere/status/latest.
  }
}

export function readPendingOrder(): StoredPendingOrder | null {
  try {
    const raw = sessionStorage.getItem(PENDING_ORDER_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as StoredPendingOrder;
    return parsed?.orderId ? parsed : null;
  } catch {
    return null;
  }
}

export function clearPendingOrder(): void {
  try {
    sessionStorage.removeItem(PENDING_ORDER_KEY);
  } catch {
    // Nothing to clean up.
  }
}