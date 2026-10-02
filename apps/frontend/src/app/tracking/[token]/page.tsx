'use client';

import { useCallback, useEffect, useState } from 'react';
import { useParams } from 'next/navigation';
import { Clock, CheckCircle, AlertTriangle } from 'lucide-react';
import { fetchAPI } from '@/lib/api';
import { useSocket } from '@/hooks/useSocket';
import { PublicOrderTracking } from '@/types';

const STATUS_COLORS: Record<string, string> = {
  RECEIVED: 'bg-blue-100 text-blue-800 border-blue-300',
  PREPARING: 'bg-amber-100 text-amber-800 border-amber-300',
  READY_FOR_PICKUP: 'bg-green-100 text-green-800 border-green-300',
  COLLECTED: 'bg-gray-100 text-gray-800 border-gray-300',
};

export default function TrackingPage() {
  const params = useParams();
  const token = params.token as string;

  const [order, setOrder] = useState<PublicOrderTracking | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const { socket, isConnected } = useSocket();

  const loadOrder = useCallback(async () => {
    try {
      const data = await fetchAPI<PublicOrderTracking>(`/tracking/${token}`);
      setOrder(data);
      setError(null);
    } catch (err: any) {
      setError(err?.message || 'Order not found');
    } finally {
      setLoading(false);
    }
  }, [token]);

  /**
   * Load, with a hard bail-out.
   *
   * `fetchAPI` aborts after 15s, but this guard also covers the case where the
   * request resolves yet the response is unusable. Either way the customer must
   * never be left staring at "Loading order..." with no way forward, so the
   * pending state is force-resolved into a real message.
   */
  useEffect(() => {
    if (!token) return;

    let cancelled = false;
    const bail = setTimeout(() => {
      if (cancelled) return;
      setLoading(false);
      setError((prev) => prev ?? 'We could not load your order. Please check your connection.');
    }, 20000);

    loadOrder();

    return () => {
      cancelled = true;
      clearTimeout(bail);
    };
  }, [token, loadOrder]);

  /**
   * Subscribe to this order's private room.
   *
   * Re-runs on every (re)connect so a dropped connection automatically
   * re-validates the token and rejoins. The server checks the token/order
   * relation before admitting this socket, and only ever emits this order's
   * updates to it.
   */
  useEffect(() => {
    if (!socket || !isConnected || !token) return;

    let cancelled = false;

    socket.emit('order:subscribe', { token }, (ack: { ok: boolean; error?: string }) => {
      if (cancelled) return;
      if (!ack?.ok) {
        setError(ack?.error || 'This tracking link is no longer valid.');
        setLoading(false);
      }
    });

    return () => {
      cancelled = true;
    };
  }, [socket, isConnected, token]);

  useEffect(() => {
    if (!socket) return;

    // The room payload is intentionally minimal, so refetch to render the
    // same server-sanitized shape as the initial page load.
    const handleStatusChange = () => {
      loadOrder();
    };

    socket.on('order.statusChanged', handleStatusChange);

    return () => {
      socket.off('order.statusChanged', handleStatusChange);
    };
  }, [socket, loadOrder]);

  /**
   * Polling fallback.
   *
   * When this page is hosted (Vercel) it reaches the backend through a
   * tunnel, where long-lived WebSockets are unreliable. Refetching on an
   * interval keeps the status accurate even if the socket never connects.
   * Cheap: one small sanitized GET, and it stops once the order is
   * collected.
   */
  useEffect(() => {
    if (!token) return;
    if (order?.status === 'COLLECTED') return;

    const id = setInterval(() => {
      loadOrder();
    }, 5000);

    return () => clearInterval(id);
  }, [token, order?.status, loadOrder]);

if (loading) {
    return (
      <div className="min-h-screen bg-amber-50 flex items-center justify-center p-8">
        <div className="text-center">
          <p className="text-2xl text-amber-900 mb-4">Loading order...</p>
          <p className="text-gray-500 text-sm mb-8">
            If this keeps going, your tracking link may have expired.
          </p>
          <a
            href="/kiosk/menu"
            className="inline-block bg-amber-600 hover:bg-amber-700 text-white py-3 px-6 rounded-xl font-bold"
          >
            Start a new order
          </a>
        </div>
      </div>
    );
  }

  if (error || !order) {
    return (
      <div className="min-h-screen bg-amber-50 flex items-center justify-center p-8">
        <div className="max-w-md w-full bg-white rounded-xl p-8 shadow-lg text-center">
          <AlertTriangle size={48} className="mx-auto mb-4 text-red-500" />
          <p className="text-xl text-red-600 mb-4">{error || 'Order not found'}</p>
          <p className="text-gray-600">Please check your tracking link and try again.</p>
        </div>
      </div>
    );
  }

  const elapsedMinutes = Math.floor(
    (new Date().getTime() - new Date(order.createdAt).getTime()) / 60000,
  );

  return (
    <div className="min-h-screen bg-amber-50 p-8">
      <div className="max-w-2xl mx-auto">
        <div className="bg-white rounded-2xl p-8 shadow-lg mb-6">
          <div className="text-center mb-8">
            <h1 className="text-4xl font-bold text-amber-900 mb-2">Order #{order.orderNumber}</h1>
            <div className="flex items-center justify-center gap-2 text-gray-600">
              <Clock size={20} />
              <span>Placed {elapsedMinutes} min ago</span>
            </div>
          </div>

          <div className={`border-2 rounded-xl p-6 text-center mb-8 ${STATUS_COLORS[order.status]}`}>
            <p className="text-2xl font-bold mb-2">
              {order.paymentConfirmed ? order.statusLabel : 'Confirming Payment'}
            </p>
            <p className="text-lg">
              {order.paymentConfirmed
                ? order.statusMessage
                : 'We are waiting for PayHere to confirm your payment. This page updates automatically.'}
            </p>
          </div>

          <div className="mb-6 flex flex-wrap gap-3 text-sm">
            <span className="px-3 py-1 rounded-full bg-amber-100 text-amber-900 font-semibold">
              {order.diningOption === 'DINE_IN' ? 'Dine In' : 'Takeaway'}
            </span>
            {order.customerName && (
              <span className="px-3 py-1 rounded-full bg-gray-100 text-gray-700 font-semibold">
                {order.customerName}
              </span>
            )}
          </div>

          <div className="space-y-4">
            <h2 className="text-xl font-bold text-amber-900">Your Order</h2>
            {order.items.map((item, index) => (
              <div key={index} className="border-b pb-4">
                <p className="font-bold text-gray-800">
                  {item.quantity} x {item.name}
                </p>
              </div>
            ))}
          </div>
        </div>

        <div className="bg-amber-100 rounded-xl p-6 text-center">
          <CheckCircle size={32} className="text-amber-700 mx-auto mb-2" />
          <p className="text-gray-700">
            This page updates automatically. Keep it open to track your order status.
          </p>
          <p className="text-xs text-gray-500 mt-2">
            {isConnected
              ? 'Live updates connected'
              : 'Updating every few seconds (live connection unavailable)'}
          </p>
        </div>
      </div>
    </div>
  );
}
