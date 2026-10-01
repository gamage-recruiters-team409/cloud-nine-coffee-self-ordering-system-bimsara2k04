'use client';

import { Suspense } from 'react';
import { useSearchParams } from 'next/navigation';
import Link from 'next/link';
import { XCircle } from 'lucide-react';

function CancelledContent() {
  const searchParams = useSearchParams();
  const orderNumber = searchParams.get('orderNumber');

  return (
    <div className="min-h-screen bg-amber-50 flex items-center justify-center p-8">
      <div className="max-w-xl w-full bg-white rounded-2xl p-12 shadow-2xl text-center">
        <div className="flex justify-center mb-6">
          <XCircle size={80} className="text-red-500" />
        </div>

        <h1 className="text-4xl font-bold text-amber-900 mb-4">Payment Cancelled</h1>
        <p className="text-xl text-gray-700 mb-4">
          Payment for order <span className="font-bold text-amber-700">#{orderNumber ?? '—'}</span>{' '}
          was cancelled.
        </p>
        <p className="text-lg text-gray-500 mb-8">
          No payment was taken and nothing has been sent to the barista. You can start a new order
          at any time.
        </p>

        <Link
          href="/kiosk/menu"
          className="inline-block bg-amber-600 hover:bg-amber-700 text-white py-4 px-8 rounded-xl text-xl font-bold transition-colors"
        >
          Return to Menu
        </Link>
      </div>
    </div>
  );
}

export default function PaymentCancelledPage() {
  return (
    <Suspense
      fallback={
        <div className="min-h-screen bg-amber-50 flex items-center justify-center">
          <p className="text-2xl text-amber-900">Loading...</p>
        </div>
      }
    >
      <CancelledContent />
    </Suspense>
  );
}
