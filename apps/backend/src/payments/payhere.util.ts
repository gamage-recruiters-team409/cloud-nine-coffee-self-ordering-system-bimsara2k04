import { createHash } from 'crypto';

const md5 = (value: string): string =>
  createHash('md5').update(value, 'utf8').digest('hex').toUpperCase();

/**
 * PayHere checkout form hash.
 * Spec: hash = strtoupper( md5( merchant_id + order_id + amount + currency + strtoupper( md5( merchant_secret ) ) ) )
 * The secret is hashed first and only its digest enters the outer hash.
 */
export function generateCheckoutHash(
  merchantId: string,
  orderId: string,
  amount: string,
  currency: string,
  merchantSecret: string,
): string {
  return md5(`${merchantId}${orderId}${amount}${currency}${md5(merchantSecret)}`);
}

/**
 * PayHere server-to-server notify signature check.
 * Spec: md5sig = strtoupper( md5( merchant_id + order_id + payhere_amount + payhere_currency + status_code + strtoupper( md5( merchant_secret ) ) ) )
 *
 * The secret is hashed first and only its digest enters the outer hash, the
 * same nesting the checkout hash uses. Concatenating the raw secret here
 * produces a different digest, so PayHere callbacks are rejected.
 */
export function generateNotifyHash(
  merchantId: string,
  orderId: string,
  payhereAmount: string,
  payhereCurrency: string,
  statusCode: string,
  merchantSecret: string,
): string {
  return md5(
    `${merchantId}${orderId}${payhereAmount}${payhereCurrency}${statusCode}${md5(merchantSecret)}`,
  );
}

/** Constant-time string comparison to avoid leaking secrets through timing. */
export function safeCompare(a: string, b: string): boolean {
  if (!a || !b || a.length !== b.length) return false;
  let mismatch = 0;
  for (let i = 0; i < a.length; i++) {
    mismatch |= a.charCodeAt(i) ^ b.charCodeAt(i);
  }
  return mismatch === 0;
}

/**
 * PayHere requires the amount to be formatted to exactly 2 decimal places.
 * The same string is used for the checkout hash and the amount field, so the
 * signature stays consistent when PayHere echoes it back to notify_url.
 */
export function formatAmount(value: number | string): string {
  return Number(value).toFixed(2);
}
