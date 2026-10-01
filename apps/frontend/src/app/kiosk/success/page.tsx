'use client';

import { useEffect, useState, Suspense } from 'react';
import { useSearchParams } from 'next/navigation';
import Link from 'next/link';
import { CheckCircle, QrCode, Loader2, AlertTriangle, RefreshCw } from 'lucide-react';
import { fetchAPI } from '@/lib/api';
import { PaymentStatusResponse } from '@/types';

const POLL_INTERVAL_MS = 2000;
const MAX_POLLS = 15; // ~30s, enough for the sandbox notify callback to land

type Phase = 'confirming' | 'confirmed' | 'failed' | 'expired';

function SuccessContent() {
  const searchParams = useSearchParams();
  const orderId = searchParams.get('orderId');
  const orderNumber = searchParams.get('orderNumber');

  const [phase, setPhase] = useState<Phase>('confirming');
  const [qrCode, setQrCode] = useState<string | null>(null);
  const [trackingToken, setTrackingToken] = useState<string | null>(null);

  // This page is PayHere's return_url. It NEVER marks an order paid — it only
  // waits for the server-side notify callback to have already confirmed it.
  useEffect(() => {
    if (!orderId) {
      setPhase('expired');
      return;
    }

    let cancelled = false;
    let attempts = 0;
    let timer: ReturnType<typeof setTimeout>;

    const poll = async () => {
      attempts += 1;
      try {
        const status = await fetchAPI<PaymentStatusResponse>(
          `/payments/payhere/status/${orderId}`,
        );

        if (cancelled) return;

        if (status.paid && status.trackingToken) {
          setTrackingToken(status.trackingToken);
          setPhase('confirmed');
          return;
        }

        if (status.paymentStatus === 'FAILED') {
          setPhase('failed');
          return;
        }
      } catch (err) {
        if (cancelled) return;
      }

      if (attempts >= MAX_POLLS) {
        setPhase('expired');
        return;
      }

      timer = setTimeout(poll, POLL_INTERVAL_MS);
    };

    poll();

    return () => {
      cancelled = true;
      clearTimeout(timer);
    };
  }, [orderId]);

  // Fetch the QR only once payment is confirmed and a token exists.
  useEffect(() => {
    if (!trackingToken) return;
    fetchAPI<{ qrCode: string }>(`/tracking/${trackingToken}/qr`)
      .then((data) => setQrCode(data.qrCode))
      .catch(console.error);
  }, [trackingToken]);

  return (
    <div className="min-h-screen bg-amber-50 flex items-center justify-center p-8">
      <div className="max-w-2xl w-full bg-white rounded-2xl p-12 shadow-2xl text-center">
        {phase === 'confirming' && (
          <>
            <Loader2 size={72} className="mx-auto mb-6 text-amber-600 animate-spin" />
            <h1 className="text-4xl font-bold text-amber-900 mb-4">Confirming Payment</h1>
            <p className="text-xl text-gray-700 mb-3">
              Thanks! We are waiting for PayHere to confirm your payment for order{' '}
              <span className="font-bold text-amber-700">#{orderNumber ?? '—'}</span>.
            </p>
            <p className="text-lg text-gray-500">Please keep this page open.</p>
          </>
        )}

        {phase === 'confirmed' && (
          <>
            <div className="flex justify-center mb-6">
              <CheckCircle size={80} className="text-green-600" />
            </div>

            <h1 className="text-4xl font-bold text-amber-900 mb-4">Payment Successful!</h1>
            <p className="text-2xl text-gray-700 mb-8">
              Your order number is{' '}
              <span className="font-bold text-amber-700">#{orderNumber}</span>
            </p>

            {qrCode && (
              <div className="bg-gray-50 rounded-xl p-8 mb-8">
                <div className="flex items-center justify-center gap-2 mb-4">
                  <QrCode size={24} className="text-amber-700" />
                  <p className="text-lg font-semibold text-gray-800">Scan to track your order</p>
                </div>
                <img src={qrCode} alt="Order Tracking QR Code" className="mx-auto w-64 h-64" />
              </div>
            )}

            {trackingToken && (
              <Link
                href={`/tracking/${trackingToken}`}
                className="inline-block bg-amber-600 hover:bg-amber-700 text-white py-4 px-8 rounded-xl text-xl font-bold mb-6 transition-colors"
              >
                Track Your Order
              </Link>
            )}
          </>
        )}

        {phase === 'failed' && (
          <>
            <div className="flex justify-center mb-6">
              <AlertTriangle size={80} className="text-red-600" />
            </div>
            <h1 className="text-4xl font-bold text-amber-900 mb-4">Payment Failed</h1>
            <p className="text-xl text-gray-700 mb-8">
              Your payment for order #{orderNumber} could not be completed. No order has been sent
              to the barista.
            </p>
            <Link
              href="/kiosk/menu"
              className="inline-block bg-amber-600 hover:bg-amber-700 text-white py-4 px-8 rounded-xl text-xl font-bold transition-colors"
            >
              Return to Menu
            </Link>
          </>
        )}

        {phase === 'expired' && (
          <>
            <div className="flex justify-center mb-6">
              <RefreshCw size={72} className="text-amber-600" />
            </div>
            <h1 className="text-4xl font-bold text-amber-900 mb-4">Confirmation Pending</h1>
            <p className="text-xl text-gray-700 mb-4">
              We have not received confirmation from PayHere for order #{orderNumber} yet.
            </p>
            <p className="text-lg text-gray-500 mb-8">
              Your order is only sent to the barista once payment is confirmed. Please check with
              staff if you completed payment.
            </p>
            <Link
              href="/kiosk"
              className="inline-block bg-amber-600 hover:bg-amber-700 text-white py-4 px-8 rounded-xl text-xl font-bold transition-colors"
            >
              Back to Kiosk
            </Link>
          </>
        )}

        {phase === 'confirmed' && (
          <div className="pt-6 border-t">
            <Link
              href="/kiosk"
              className="inline-block text-amber-700 hover:text-amber-900 font-semibold text-lg"
            >
              Place Another Order
            </Link>
          </div>
        )}
      </div>
    </div>
  );
}

export default function SuccessPage() {
  return (
    <Suspense
      fallback={
        <div className="min-h-screen bg-amber-50 flex items-center justify-center">
          <p className="text-2xl text-amber-900">Loading...</p>
        </div>
      }
    >
      <SuccessContent />
    </Suspense>
  );
}
