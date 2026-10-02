import Link from 'next/link';
import { notFound } from 'next/navigation';
import { CheckCircle, QrCode } from 'lucide-react';

export const dynamic = 'force-dynamic';

/**
 * PayHere sandbox return page, identified by the tracking token in the URL
 * path (`/kiosk/success/<token>`).
 *
 * This is a SERVER component on purpose. Everything the customer needs — the
 * order number, the approval, and the QR image — is produced during the
 * initial render, so the page can never show an empty order number or sit on a
 * loading spinner. No client-side polling, no sessionStorage, and no dependency
 * on the gateway preserving its query string.
 *
 * Payment behaviour: this route calls the sandbox-approval endpoint, which is
 * hard-blocked unless PAYHERE_SANDBOX=true. A real PayHere notify callback
 * still verifies the signature and performs the same activation, and it is
 * idempotent, so approving here does not conflict with it.
 */

const API = () =>
  (process.env.BACKEND_INTERNAL_URL ?? process.env.BACKEND_URL ?? 'http://localhost:3001')
    .replace(/\/+$/, '');

type Approval = {
  orderNumber: number;
  paid: boolean;
  trackingToken: string;
};

async function approve(token: string): Promise<Approval | null> {
  try {
    const res = await fetch(`${API()}/payments/payhere/sandbox/approve/${token}`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      cache: 'no-store',
    });

    if (!res.ok) return null;
    return (await res.json()) as Approval;
  } catch {
    return null;
  }
}

async function qrFor(token: string): Promise<string | null> {
  try {
    const res = await fetch(`${API()}/tracking/${token}/qr`, { cache: 'no-store' });
    if (!res.ok) return null;
    const body = (await res.json()) as { qrCode?: string };
    return body.qrCode ?? null;
  } catch {
    return null;
  }
}

export default async function SuccessPage({
  params,
}: {
  params: Promise<{ token: string }>;
}) {
  const { token } = await params;

  // Approve first, then read the token back from the response so a token that
  // was only just minted is picked up correctly.
  const approval = await approve(token);
  const effectiveToken = approval?.trackingToken ?? token;

  // The QR is rendered server-side and inlined as a data URL, so it is part of
  // the very first HTML response the browser receives.
  const [qrCode] = await Promise.all([qrFor(effectiveToken)]);

  if (!approval && !qrCode) {
    notFound();
  }

  return (
    <div className="min-h-screen bg-amber-50 flex items-center justify-center p-8">
      <div className="max-w-2xl w-full bg-white rounded-2xl p-12 shadow-2xl text-center">
        <div className="flex justify-center mb-6">
          <CheckCircle size={80} className="text-green-600" />
        </div>

        <h1 className="text-4xl font-bold text-amber-900 mb-4">Payment Successful!</h1>

        <p className="text-2xl text-gray-700 mb-2">
          Your order number is{' '}
          <span className="font-bold text-amber-700">
            #{approval?.orderNumber ?? '—'}
          </span>
        </p>

        {qrCode && (
          <div className="bg-gray-50 rounded-xl p-8 mb-8">
            <div className="flex items-center justify-center gap-2 mb-4">
              <QrCode size={24} className="text-amber-700" />
              <p className="text-lg font-semibold text-gray-800">Scan to track your order</p>
            </div>
            {/* Data URL inlined server-side; next/image would try to optimize it. */}
            <img
              src={qrCode}
              alt="Order Tracking QR Code"
              className="mx-auto w-64 h-64"
              width={256}
              height={256}
            />
          </div>
        )}

        <Link
          href={`/tracking/${effectiveToken}`}
          className="inline-block bg-amber-600 hover:bg-amber-700 text-white py-4 px-8 rounded-xl text-xl font-bold mb-6 transition-colors"
        >
          Track Your Order
        </Link>

        <div>
          <Link
            href="/kiosk/menu"
            className="inline-block text-amber-700 hover:text-amber-900 font-semibold"
          >
            Start a new order
          </Link>
        </div>
      </div>
    </div>
  );
}