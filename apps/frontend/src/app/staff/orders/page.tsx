'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { Clock, Package, User, Utensils } from 'lucide-react';
import { fetchWithAuth } from '@/lib/api';
import { useSocket } from '@/hooks/useSocket';
import { Order } from '@/types';

type OrderStatus = Order['status'];

const STATUS_COLORS: Record<OrderStatus, string> = {
  RECEIVED: 'bg-blue-500',
  PREPARING: 'bg-amber-500',
  READY_FOR_PICKUP: 'bg-green-500',
  COLLECTED: 'bg-gray-400',
};

const STATUS_NEXT: Record<OrderStatus, OrderStatus | null> = {
  RECEIVED: 'PREPARING',
  PREPARING: 'READY_FOR_PICKUP',
  READY_FOR_PICKUP: 'COLLECTED',
  COLLECTED: null,
};

const STATUS_LABELS: Record<OrderStatus, string> = {
  RECEIVED: 'New Order',
  PREPARING: 'Preparing',
  READY_FOR_PICKUP: 'Ready',
  COLLECTED: 'Collected',
};

export default function OrdersPage() {
  const router = useRouter();
  const [orders, setOrders] = useState<Order[]>([]);
  const [token, setToken] = useState('');
  const [loading, setLoading] = useState(true);
  const { socket, isConnected } = useSocket();

  const [currentUser, setCurrentUser] = useState<{ id: string; email: string; role: string } | null>(null);

  useEffect(() => {
    const savedToken = localStorage.getItem('staff_token');
    const savedUser = localStorage.getItem('staff_user');
    if (!savedToken) {
      router.push('/staff/login');
      return;
    }
    setToken(savedToken);
    if (savedUser) {
      try {
        setCurrentUser(JSON.parse(savedUser));
      } catch (e) {
        // ignore
      }
    }

    fetchWithAuth<Order[]>('/orders', savedToken)
      .then((data) =>
        // Backend already returns PAID only; filter defensively so an unpaid
        // order can never reach the barista board.
        setOrders(
          data.filter((o) => o.status !== 'COLLECTED' && o.paymentStatus !== 'PENDING' && o.paymentStatus !== 'FAILED'),
        ),
      )
      .catch(() => {
        localStorage.removeItem('staff_token');
        localStorage.removeItem('staff_user');
        router.push('/staff/login');
      })
      .finally(() => setLoading(false));
  }, [router]);

  // Join the staff-only room. The backend verifies the staff access token
  // before admitting the socket, and re-joins on every (re)connect so the
  // queue stays live after a drop.
  useEffect(() => {
    if (!socket || !isConnected || !token) return;

    let cancelled = false;

    socket.emit(
      'barista:subscribe',
      { token },
      (ack: { ok: boolean; error?: string }) => {
        if (cancelled) return;

        if (!ack?.ok) {
          // Token rejected or expired — drop the stale session and re-login.
          localStorage.removeItem('staff_token');
          localStorage.removeItem('staff_user');
          router.push('/staff/login');
        }
      },
    );

    return () => {
      cancelled = true;
    };
  }, [socket, isConnected, token, router]);

  useEffect(() => {
    if (!socket) return;

    const handleNewOrder = (order: Order) => {
      // Only paid orders are ever emitted, but guard defensively anyway.
      if (order.paymentStatus && order.paymentStatus !== 'PAID') return;
      setOrders((prev) =>
        prev.some((o) => o.id === order.id) ? prev : [order, ...prev],
      );
    };

    const handleStatusChange = (updatedOrder: Order) => {
      if (updatedOrder.status === 'COLLECTED') {
        setOrders((prev) => prev.filter((o) => o.id !== updatedOrder.id));
      } else {
        setOrders((prev) =>
          prev.map((o) => (o.id === updatedOrder.id ? updatedOrder : o)),
        );
      }
    };

    socket.on('order.created', handleNewOrder);
    socket.on('order.statusChanged', handleStatusChange);

    return () => {
      socket.off('order.created', handleNewOrder);
      socket.off('order.statusChanged', handleStatusChange);
    };
  }, [socket]);

  const handleStatusUpdate = async (orderId: string, newStatus: string) => {
    try {
      await fetchWithAuth(`/orders/${orderId}/status`, token, {
        method: 'PATCH',
        body: JSON.stringify({ status: newStatus }),
      });
    } catch (error) {
      alert('Failed to update order status');
    }
  };

  const handleLogout = () => {
    localStorage.removeItem('staff_token');
    localStorage.removeItem('staff_user');
    router.push('/staff/login');
  };

  const getElapsedTime = (createdAt: string) => {
    const minutes = Math.floor((new Date().getTime() - new Date(createdAt).getTime()) / 60000);
    if (minutes < 1) return 'Just now';
    if (minutes === 1) return '1 min ago';
    return `${minutes} mins ago`;
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-gray-100 flex items-center justify-center">
        <p className="text-2xl text-gray-700">Loading orders...</p>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-100">
      <header className="bg-amber-900 text-white py-4 px-8 flex justify-between items-center sticky top-0 z-10 shadow-md">
        <div className="flex items-center gap-6">
          <h1 className="text-2xl font-bold">Barista Queue</h1>
          <Link
            href="/staff/ingredients"
            className="bg-amber-700 hover:bg-amber-600 px-4 py-2 rounded-lg transition-colors"
          >
            Manage Ingredients
          </Link>
          {currentUser?.role === 'ADMIN' && (
            <Link
              href="/admin"
              className="bg-amber-800 hover:bg-amber-700 border border-amber-500 px-4 py-2 rounded-lg transition-colors font-semibold"
            >
              ← Admin Dashboard
            </Link>
          )}
        </div>
        <div className="flex items-center gap-4">
          <span className="text-sm text-amber-200">Logged in as {currentUser?.email || 'Staff'}</span>
          <button
            onClick={handleLogout}
            className="bg-red-600 hover:bg-red-700 px-4 py-2 rounded-lg transition-colors"
          >
            Logout
          </button>
        </div>
      </header>

      <main className="max-w-7xl mx-auto px-8 py-8">
        {orders.length === 0 ? (
          <div className="bg-white rounded-xl p-12 shadow-lg text-center">
            <Package size={64} className="mx-auto mb-4 text-gray-400" />
            <p className="text-2xl text-gray-600">No active orders</p>
            <p className="text-gray-500 mt-2">New orders will appear here automatically</p>
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {orders.map((order) => {
              const nextStatus = STATUS_NEXT[order.status];
              return (
                <div
                  key={order.id}
                  className={`bg-white rounded-xl p-6 shadow-lg border-t-4 ${STATUS_COLORS[order.status]}`}
                >
                  <div className="flex justify-between items-start mb-4">
                    <div>
                      <h3 className="text-2xl font-bold text-gray-800">#{order.orderNumber}</h3>
                      <div className="flex items-center gap-2 text-sm text-gray-600 mt-1">
                        <Clock size={16} />
                        <span>{getElapsedTime(order.createdAt)}</span>
                      </div>
                    </div>
                    <span
                      className={`px-3 py-1 rounded-full text-white text-sm font-bold ${STATUS_COLORS[order.status]}`}
                    >
                      {STATUS_LABELS[order.status]}
                    </span>
                  </div>

                  <div className="flex flex-wrap gap-2 mb-4">
                    <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-gray-100 text-gray-700 text-xs font-semibold">
                      <Utensils size={12} />
                      {order.diningOption === 'TAKEAWAY' ? 'Takeaway' : 'Dine In'}
                    </span>
                    {order.customerName && (
                      <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-amber-100 text-amber-800 text-xs font-semibold">
                        <User size={12} />
                        {order.customerName}
                      </span>
                    )}
                  </div>

                  <div className="space-y-3 mb-4">
                    {order.items.map((item) => (
                      <div key={item.id} className="border-b pb-2">
                        <p className="font-semibold text-gray-800">
                          {item.quantity}x {item.drinkName}
                        </p>
                        {item.modifiers.length > 0 && (
                          <ul className="text-sm text-gray-600 ml-4 mt-1">
                            {item.modifiers.map((mod) => (
                              <li key={mod.id}>{mod.optionName}</li>
                            ))}
                          </ul>
                        )}
                      </div>
                    ))}
                  </div>

                  {nextStatus && (
                    <button
                      onClick={() => handleStatusUpdate(order.id, nextStatus)}
                      className="w-full bg-amber-600 hover:bg-amber-700 text-white py-3 rounded-lg font-bold transition-colors"
                    >
                      Mark as {STATUS_LABELS[nextStatus]}
                    </button>
                  )}
                </div>
              );
            })}
          </div>
        )}
      </main>
    </div>
  );
}
