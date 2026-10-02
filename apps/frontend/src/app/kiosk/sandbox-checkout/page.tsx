'use client';

/**
 * Self-contained sandbox payment page.
 *
 * This replaces PayHe's hosted checkout whenever PAYHERE_SANDBOX=true. PayHe's
 * sandbox is a third-party dependency we do not control — it intermittently
 * rejects valid requests with "Unauthorized payment request" — so local demos
 * must not depend on it. Approving here posts to the sandbox-only endpoint,
 * which the backend hard-blocks outside sandbox mode.
 *
 * No real money moves. The page is deliberately labelled so nobody mistakes it
 * for a live terminal.
 */

import { Suspense, useEffect, useState } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import Link from 'next/link';
import { ArrowLeft, Coffee, Lock, ShieldAlert } from 'lucide-react';
import { fetchAPI } from '@/lib/api';

type OrderSummary = {
  orderNumber: number;
  items: Array<{ name: string; quantity: number }>;
};

function SandboxCheckoutContent() {
  const router = useRouter();
  const params = useSearchParams();

  const token = params.get('token') ?? '';
  const orderNumber = params.get('orderNumber') ?? '';
  const amount = params.get('amount') ?? '0.00';

  const [summary, setSummary] = useState<OrderSummary | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [paying, setPaying] = useState(false);

  useEffect(() => {
    if (!token) {
      setError('This checkout link is missing its order token.');
      return;
    }
    // Best-effort: the amount above comes from the signed redirect, this only
    // adds the line items for the summary.
    fetchAPI<OrderSummary>(`/tracking/${token}`)
      .then(setSummary)
      .catch(() => setSummary(null));
  }, [token]);

  async function pay() {
    setPaying(true);
    setError(null);
    try {
      await fetchAPI(`/payments/payhere/sandbox/approve/${token}`, { method: 'POST' });
      router.push(`/kiosk/success/${token}`);
    } catch {
      setError('Could not complete the sandbox payment. Please try again.');
      setPaying(false);
    }
  }

  function cancel() {
    router.push(
      `/kiosk/payment-cancelled?orderNumber=${encodeURIComponent(orderNumber)}&orderId=${params.get('orderId') ?? ''}`,
    );
  }

  return (
    <div className="min-h-screen bg-amber-50">
      <header className="bg-amber-900 text-white py-6 px-8 flex items-center gap-4">
        <button onClick={cancel} className="hover:bg-amber-800 p-2 rounded-lg transition-colors">
          <ArrowLeft size={28} />
        </button>
        <h1 className="text-2xl font-bold">Payment</h1>
      </header>

      <main className="max-w-xl mx-auto px-8 py-10">
        <div className="bg-amber-100 border-2 border-amber-400 rounded-2xl p-5 mb-6 flex items-start gap-3">
          <ShieldAlert size={28} className="text-amber-700 shrink-0 mt-0.5" />
          <div>
            <p className="font-extrabold text-amber-900 text-lg">Sandbox — test mode</p>
            <p className="text-amber-800 text-sm mt-1">
              No real payment is taken and no card details are collected or sent anywhere.
              This page replaces the PayHere sandbox gateway.
            </p>
          </div>
        </div>

        <div className="bg-white rounded-2xl shadow-lg border border-amber-100 overflow-hidden">
          <div className="px-6 py-4 border-b border-amber-100 flex justify-between items-center">
            <span className="text-gray-600">Order</span>
            <span className="font-bold text-gray-900">#{orderNumber}</span>
          </div>

          <div className="px-6 py-4 border-b border-amber-100 space-y-2">
            {summary?.items?.length ? (
              summary.items.map((item, i) => (
                <div key={i} className="flex justify-between text-gray-700">
                  <span>
                    {item.quantity} x {item.name}
                  </span>
                </div>
              ))
            ) : (
              <div className="flex justify-center py-2 text-gray-400 text-sm">
                <Coffee size={16} className="mr-2" /> Loading items…
              </div>
            )}
          </div>

          <div className="px-6 py-5 flex justify-between items-center bg-amber-50">
            <span className="text-lg font-bold text-gray-900">Total</span>
            <span className="text-3xl font-extrabold text-amber-800">
              Rs. {parseFloat(amount || '0').toLocaleString()}
            </span>
          </div>
        </div>

        {error && (
          <div className="mt-5 bg-red-50 border border-red-200 text-red-700 rounded-xl p-4 text-sm">
            {error}
          </div>
        )}

        <button
          onClick={pay}
          disabled={paying || !token}
          className="mt-6 w-full bg-amber-600 hover:bg-amber-700 disabled:bg-amber-300 text-white py-4 rounded-xl text-xl font-bold transition-colors flex items-center justify-center gap-2"
        >
          {paying ? (
            'Processing…'
          ) : (
            <>
              <Lock size={20} /> Pay Rs. {parseFloat(amount || '0').toLocaleString()}
            </>
          )}
        </button>

        <button
          onClick={cancel}
          disabled={paying}
          className="mt-3 w-full text-gray-500 hover:text-gray-700 py-3 rounded-xl text-sm font-semibold transition-colors"
        >
          Simulate a declined card
        </button>

        <p className="mt-6 text-center text-xs text-gray-400">
          Sandbox orders are approved by the backend without a gateway callback.{' '}
          <Link href="/kiosk/menu" className="underline">
            Back to menu
          </Link>
        </p>
      </main>
    </div>
  );
}

export default function SandboxCheckoutPage() {
  return (
    <Suspense
      fallback={
        <div className="min-h-screen bg-amber-50 flex items-center justify-center">
          <div className="text-center">
            <Coffee size={40} className="mx-auto text-amber-700 animate-pulse mb-3" />
            <p className="text-amber-900 font-bold">Loading payment terminal...</p>
          </div>
        </div>
      }
    >
      <SandboxCheckoutContent />
    </Suspense>
  );
}