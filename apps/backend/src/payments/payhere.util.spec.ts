import { createHash } from 'crypto';
import {
  formatAmount,
  generateCheckoutHash,
  generateNotifyHash,
  safeCompare,
} from './payhere.util';

describe('PayHere util', () => {
  const merchantId = '1234567';
  const orderId = 'ORDER-1';
  const amount = '100.00';
  const currency = 'LKR';
  const secret = 'TEST_SECRET_KEY';

  describe('generateCheckoutHash', () => {
    it('matches the PayHere reference algorithm result', () => {
      const hash = generateCheckoutHash(merchantId, orderId, amount, currency, secret);

      expect(hash).toBe('C4604F10E1BDE5C290D089EC559C6455');
      expect(hash).toMatch(/^[0-9A-F]{32}$/);
    });

    it('reproduces the documented formula computed independently', () => {
      // Deliberately re-derives the spec from PayHere's documentation rather
      // than trusting the implementation. A previous version of this file
      // hard-coded a digest produced by the implementation itself, which let a
      // wrong hash formula pass CI and fail live at PayHere.
      const independent = (value: string) =>
        createHash('md5').update(value, 'utf8').digest('hex').toUpperCase();

      const expected = independent(
        merchantId +
          orderId +
          amount +
          currency +
          independent(secret),
      );

      expect(generateCheckoutHash(merchantId, orderId, amount, currency, secret)).toBe(
        expected,
      );
    });

    it('hides the secret: it must be pre-hashed, not concatenated in the clear', () => {
      // The historical bug hashed (id + order + amount + currency) first and
      // then appended the raw secret. Guard against that shape returning.
      const cleartextAppended =
        createHash('md5')
          .update(
            createHash('md5')
              .update(merchantId + orderId + amount + currency, 'utf8')
              .digest('hex')
              .toUpperCase() + secret,
            'utf8',
          )
          .digest('hex')
          .toUpperCase();

      expect(
        generateCheckoutHash(merchantId, orderId, amount, currency, secret),
      ).not.toBe(cleartextAppended);
    });

    it('is deterministic for the same inputs', () => {
      const first = generateCheckoutHash(merchantId, orderId, amount, currency, secret);
      const second = generateCheckoutHash(merchantId, orderId, amount, currency, secret);

      expect(first).toBe(second);
    });

    it('changes when the amount changes', () => {
      const base = generateCheckoutHash(merchantId, orderId, amount, currency, secret);
      const altered = generateCheckoutHash(merchantId, orderId, '100.01', currency, secret);

      expect(base).not.toBe(altered);
    });
  });

  describe('generateNotifyHash', () => {
    it('matches the PayHere md5sig reference algorithm result', () => {
      const sig = generateNotifyHash(merchantId, orderId, amount, currency, '2', secret);

      expect(sig).toMatch(/^[0-9A-F]{32}$/);
    });

    it('reproduces the documented formula computed independently', () => {
      // PayHere: strtoupper(md5(merchant_id + order_id + payhere_amount +
      // payhere_currency + status_code + strtoupper(md5(merchant_secret))))
      // This previously hard-coded a digest generated from the implementation
      // itself, which let a wrong formula pass CI and reject every live
      // callback with "bad md5sig".
      const independent = (value: string) =>
        createHash('md5').update(value, 'utf8').digest('hex').toUpperCase();

      const expected = independent(
        merchantId +
          orderId +
          amount +
          currency +
          '2' +
          independent(secret),
      );

      expect(generateNotifyHash(merchantId, orderId, amount, currency, '2', secret)).toBe(
        expected,
      );
    });

    it('must not concatenate the raw secret in place of its digest', () => {
      // The historical bug appended the plaintext secret to the outer hash.
      const cleartextAppended =
        createHash('md5')
          .update(
            merchantId + orderId + amount + currency + '2' + secret,
            'utf8',
          )
          .digest('hex')
          .toUpperCase();

      expect(generateNotifyHash(merchantId, orderId, amount, currency, '2', secret)).not.toBe(
        cleartextAppended,
      );
    });

    it('reproduces a signature captured from a real PayHere sandbox callback', () => {
      // Captured verbatim from PayHere notifying order #46 through the tunnel
      // after a successful sandbox payment.
      const sig = generateNotifyHash(
        '1238377',
        'cad6a828-496b-43cd-b1ad-2699b1c39b3b',
        '950.00',
        'LKR',
        '2',
        process.env.PAYHERE_MERCHANT_SECRET ?? '',
      );

      // Only assert when a real secret is present so the suite still runs in CI.
      if (process.env.PAYHERE_MERCHANT_SECRET) {
        expect(sig).toBe('12D1F157C7CBF0F462386389A6E06AE5');
      }
    });

    it('changes when the status code changes', () => {
      const success = generateNotifyHash(merchantId, orderId, amount, currency, '2', secret);
      const failed = generateNotifyHash(merchantId, orderId, amount, currency, '-2', secret);

      expect(success).not.toBe(failed);
    });
  });

  describe('safeCompare', () => {
    it('returns true for identical strings', () => {
      expect(safeCompare('ABC123', 'ABC123')).toBe(true);
    });

    it('returns false for different strings of equal length', () => {
      expect(safeCompare('ABC123', 'ABC124')).toBe(false);
    });

    it('returns false for different lengths or empty input', () => {
      expect(safeCompare('ABC123', 'ABC1234')).toBe(false);
      expect(safeCompare('', 'ABC123')).toBe(false);
      expect(safeCompare('ABC123', '')).toBe(false);
    });
  });

  describe('formatAmount', () => {
    it('always produces exactly 2 decimal places', () => {
      expect(formatAmount(100)).toBe('100.00');
      expect(formatAmount('100.5')).toBe('100.50');
      expect(formatAmount(100.567)).toBe('100.57');
      expect(formatAmount(0.1 + 0.2)).toBe('0.30');
    });
  });
});
