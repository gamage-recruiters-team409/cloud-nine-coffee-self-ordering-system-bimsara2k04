import { redirect } from 'next/navigation';
import { getLatestPaymentStatus } from '@/lib/backend';

/**
 * Legacy entry point.
 *
 * `return_url` is now built with the tracking token in the path
 * (`/kiosk/success/<token>`), so PayHere should never land here. This redirect
 * exists so a bare `/kiosk/success` still reaches a working page instead of the
 * old polling spinner, which is what previously hung on the return from the
 * sandbox.
 */
export const dynamic = 'force-dynamic';

export default async function LegacySuccessPage() {
  let token: string | null = null;

  try {
    const status = await getLatestPaymentStatus();
    token = status?.trackingToken ?? null;
  } catch {
    token = null;
  }

  if (!token) {
    return (
      <div className="min-h-screen bg-amber-50 flex items-center justify-center p-8">
        <div className="max-w-xl w-full bg-white rounded-2xl p-12 shadow-2xl text-center">
          <h1 className="text-3xl font-bold text-amber-900 mb-4">No order awaiting payment</h1>
          <p className="text-gray-600 mb-6">
            Start a new order from the kiosk menu to see a payment QR code.
          </p>
          <a
            href="/kiosk/menu"
            className="inline-block bg-amber-600 hover:bg-amber-700 text-white py-3 px-6 rounded-xl font-bold"
          >
            Go to Menu
          </a>
        </div>
      </div>
    );
  }

  redirect(`/kiosk/success/${token}`);
}