'use client';

import { useEffect, useState, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import {
  TrendingUp,
  TrendingDown,
  DollarSign,
  ShoppingBag,
  Clock,
  CheckCircle2,
  Users,
  RefreshCw,
  Coffee,
  AlertCircle,
  ExternalLink,
  ChevronRight,
  ShieldCheck,
} from 'lucide-react';
import { fetchWithAuth } from '@/lib/api';

interface DashboardMetrics {
  kpi: {
    totalOrdersToday: number;
    totalRevenueToday: number;
    averageOrderValueToday: number;
    ordersInProgress: number;
    completedOrdersToday: number;
    totalAllTimeOrders: number;
  };
  comparisons: {
    revenue: {
      today: number;
      yesterday: number;
      diff: number;
      percentChange: number;
    };
    orderCount: {
      today: number;
      yesterday: number;
      diff: number;
      percentChange: number;
    };
    averageOrderValue: {
      today: number;
      yesterday: number;
      diff: number;
      percentChange: number;
    };
  };
  trends: Array<{
    date: string;
    revenue: number;
    orderCount: number;
    aov: number;
  }>;
  staffPerformance: Array<{
    id: string;
    email: string;
    role: string;
    todayPreparing: number;
    todayReady: number;
    todayCompleted: number;
    todayTotalHandled: number;
    allTimeHandled: number;
  }>;
  popularDrinks: Array<{
    drinkId: string;
    drinkName: string;
    totalQuantity: number;
  }>;
  recentOrders: Array<{
    id: string;
    orderNumber: number;
    customerName: string;
    diningOption: 'DINE_IN' | 'TAKEAWAY';
    paymentStatus: 'PAID' | 'PENDING' | 'FAILED';
    paymentMethod: string;
    status: 'RECEIVED' | 'PREPARING' | 'READY_FOR_PICKUP' | 'COLLECTED';
    total: number;
    itemsSummary: string;
    itemCount: number;
    responsibleStaff: string;
    createdAt: string;
    updatedAt: string;
  }>;
}

export default function AdminDashboardPage() {
  const router = useRouter();
  const [data, setData] = useState<DashboardMetrics | null>(null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [currentUser, setCurrentUser] = useState<{ email: string; role: string } | null>(null);

  const loadData = useCallback(
    async (token: string) => {
      try {
        setError(null);
        const result = await fetchWithAuth<DashboardMetrics>('/reports/dashboard', token);
        setData(result);
      } catch (err: any) {
        setError(err.message || 'Failed to load dashboard data');
      } finally {
        setLoading(false);
        setRefreshing(false);
      }
    },
    [],
  );

  useEffect(() => {
    const token = localStorage.getItem('staff_token');
    const userStr = localStorage.getItem('staff_user');

    if (!token) {
      router.push('/staff/login');
      return;
    }

    if (userStr) {
      try {
        const user = JSON.parse(userStr);
        setCurrentUser(user);
        if (user.role !== 'ADMIN') {
          // Access control: Baristas are not allowed on the admin dashboard
          router.push('/staff/orders');
          return;
        }
      } catch (e) {
        localStorage.removeItem('staff_token');
        localStorage.removeItem('staff_user');
        router.push('/staff/login');
        return;
      }
    }

    loadData(token);
  }, [router, loadData]);

  const handleRefresh = () => {
    const token = localStorage.getItem('staff_token');
    if (token) {
      setRefreshing(true);
      loadData(token);
    }
  };

  const handleLogout = () => {
    localStorage.removeItem('staff_token');
    localStorage.removeItem('staff_user');
    router.push('/staff/login');
  };

  const getStatusBadge = (status: string) => {
    switch (status) {
      case 'RECEIVED':
        return <span className="px-2.5 py-1 rounded-full text-xs font-semibold bg-blue-100 text-blue-800">Received</span>;
      case 'PREPARING':
        return <span className="px-2.5 py-1 rounded-full text-xs font-semibold bg-amber-100 text-amber-800">Preparing</span>;
      case 'READY_FOR_PICKUP':
        return <span className="px-2.5 py-1 rounded-full text-xs font-semibold bg-emerald-100 text-emerald-800">Ready</span>;
      case 'COLLECTED':
        return <span className="px-2.5 py-1 rounded-full text-xs font-semibold bg-gray-100 text-gray-700">Collected</span>;
      default:
        return <span className="px-2.5 py-1 rounded-full text-xs font-semibold bg-gray-100 text-gray-600">{status}</span>;
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-slate-50 flex items-center justify-center">
        <div className="text-center">
          <RefreshCw className="animate-spin text-amber-700 mx-auto mb-4" size={40} />
          <p className="text-xl font-medium text-slate-700">Loading Admin Dashboard...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-slate-50 text-slate-900">
      {/* Top Navbar */}
      <header className="bg-slate-900 text-white sticky top-0 z-20 shadow-md">
        <div className="max-w-7xl mx-auto px-6 py-4 flex flex-wrap justify-between items-center gap-4">
          <div className="flex items-center gap-4">
            <div className="bg-amber-600 p-2 rounded-lg text-white">
              <ShieldCheck size={24} />
            </div>
            <div>
              <h1 className="text-xl font-bold tracking-tight">Cloud Nine Coffee Bar</h1>
              <p className="text-xs text-slate-400">Management & Operational Analytics</p>
            </div>
          </div>

          <div className="flex items-center gap-3">
            <Link
              href="/staff/orders"
              className="flex items-center gap-1.5 text-xs font-medium bg-slate-800 hover:bg-slate-700 text-slate-200 px-3.5 py-2 rounded-lg transition-colors border border-slate-700"
            >
              <Coffee size={15} />
              Barista Queue
            </Link>

            <Link
              href="/staff/ingredients"
              className="flex items-center gap-1.5 text-xs font-medium bg-slate-800 hover:bg-slate-700 text-slate-200 px-3.5 py-2 rounded-lg transition-colors border border-slate-700"
            >
              Ingredients
            </Link>

            <button
              onClick={handleRefresh}
              disabled={refreshing}
              className="flex items-center gap-1.5 text-xs font-medium bg-amber-600 hover:bg-amber-700 text-white px-3.5 py-2 rounded-lg transition-colors disabled:opacity-50"
            >
              <RefreshCw size={14} className={refreshing ? 'animate-spin' : ''} />
              Refresh
            </button>

            <button
              onClick={handleLogout}
              className="text-xs font-medium bg-rose-600 hover:bg-rose-700 text-white px-3.5 py-2 rounded-lg transition-colors ml-2"
            >
              Logout
            </button>
          </div>
        </div>
      </header>

      <main className="max-w-7xl mx-auto px-6 py-8 space-y-8">
        {/* Welcome & Role Status */}
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 border-b border-slate-200 pb-4">
          <div>
            <h2 className="text-2xl font-bold text-slate-900">Executive Dashboard</h2>
            <p className="text-sm text-slate-500">
              Live business KPIs, daily revenue trends, and staff operations
            </p>
          </div>
          <div className="inline-flex items-center gap-2 bg-white px-3 py-1.5 rounded-lg border border-slate-200 text-xs text-slate-600">
            <span className="w-2 h-2 rounded-full bg-emerald-500"></span>
            <span>Logged in as: <strong className="text-slate-800">{currentUser?.email}</strong> (ADMIN)</span>
          </div>
        </div>

        {error && (
          <div className="bg-rose-50 border border-rose-200 text-rose-700 px-4 py-3 rounded-xl flex items-center gap-3">
            <AlertCircle size={20} />
            <span className="text-sm">{error}</span>
          </div>
        )}

        {/* A. Top KPI Cards */}
        <section>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-4">
            {/* KPI 1: Orders Today */}
            <div className="bg-white p-5 rounded-2xl border border-slate-200 shadow-sm flex flex-col justify-between">
              <div className="flex items-center justify-between text-slate-500 mb-2">
                <span className="text-xs font-bold uppercase tracking-wider">Orders Today</span>
                <div className="p-2 rounded-xl bg-blue-50 text-blue-600">
                  <ShoppingBag size={18} />
                </div>
              </div>
              <div>
                <p className="text-3xl font-extrabold text-slate-900">{data?.kpi.totalOrdersToday ?? 0}</p>
                <div className="mt-2 flex items-center text-xs">
                  {data?.comparisons.orderCount.diff !== undefined && (
                    <span
                      className={`inline-flex items-center font-bold mr-1 ${
                        data.comparisons.orderCount.diff >= 0 ? 'text-emerald-600' : 'text-rose-600'
                      }`}
                    >
                      {data.comparisons.orderCount.diff >= 0 ? (
                        <TrendingUp size={14} className="mr-0.5" />
                      ) : (
                        <TrendingDown size={14} className="mr-0.5" />
                      )}
                      {data.comparisons.orderCount.diff >= 0 ? '+' : ''}
                      {data.comparisons.orderCount.diff} ({data.comparisons.orderCount.percentChange}%)
                    </span>
                  )}
                  <span className="text-slate-400">vs yesterday</span>
                </div>
              </div>
            </div>

            {/* KPI 2: Revenue Today */}
            <div className="bg-white p-5 rounded-2xl border border-slate-200 shadow-sm flex flex-col justify-between">
              <div className="flex items-center justify-between text-slate-500 mb-2">
                <span className="text-xs font-bold uppercase tracking-wider">Revenue Today</span>
                <div className="p-2 rounded-xl bg-emerald-50 text-emerald-600">
                  <DollarSign size={18} />
                </div>
              </div>
              <div>
                <p className="text-3xl font-extrabold text-slate-900">
                  Rs. {data?.kpi.totalRevenueToday?.toLocaleString() ?? '0'}
                </p>
                <div className="mt-2 flex items-center text-xs">
                  {data?.comparisons.revenue.diff !== undefined && (
                    <span
                      className={`inline-flex items-center font-bold mr-1 ${
                        data.comparisons.revenue.diff >= 0 ? 'text-emerald-600' : 'text-rose-600'
                      }`}
                    >
                      {data.comparisons.revenue.diff >= 0 ? (
                        <TrendingUp size={14} className="mr-0.5" />
                      ) : (
                        <TrendingDown size={14} className="mr-0.5" />
                      )}
                      {data.comparisons.revenue.diff >= 0 ? '+Rs. ' : '-Rs. '}
                      {Math.abs(data.comparisons.revenue.diff).toLocaleString()} ({data.comparisons.revenue.percentChange}%)
                    </span>
                  )}
                  <span className="text-slate-400">vs yesterday</span>
                </div>
              </div>
            </div>

            {/* KPI 3: Average Order Value */}
            <div className="bg-white p-5 rounded-2xl border border-slate-200 shadow-sm flex flex-col justify-between">
              <div className="flex items-center justify-between text-slate-500 mb-2">
                <span className="text-xs font-bold uppercase tracking-wider">Avg Order Value</span>
                <div className="p-2 rounded-xl bg-amber-50 text-amber-600">
                  <TrendingUp size={18} />
                </div>
              </div>
              <div>
                <p className="text-3xl font-extrabold text-slate-900">
                  Rs. {data?.kpi.averageOrderValueToday?.toLocaleString() ?? '0'}
                </p>
                <div className="mt-2 flex items-center text-xs">
                  {data?.comparisons.averageOrderValue.diff !== undefined && (
                    <span
                      className={`inline-flex items-center font-bold mr-1 ${
                        data.comparisons.averageOrderValue.diff >= 0 ? 'text-emerald-600' : 'text-rose-600'
                      }`}
                    >
                      {data.comparisons.averageOrderValue.diff >= 0 ? '+Rs. ' : '-Rs. '}
                      {Math.abs(data.comparisons.averageOrderValue.diff).toLocaleString()}
                    </span>
                  )}
                  <span className="text-slate-400">vs yesterday</span>
                </div>
              </div>
            </div>

            {/* KPI 4: In Progress */}
            <div className="bg-white p-5 rounded-2xl border border-slate-200 shadow-sm flex flex-col justify-between">
              <div className="flex items-center justify-between text-slate-500 mb-2">
                <span className="text-xs font-bold uppercase tracking-wider">In Progress</span>
                <div className="p-2 rounded-xl bg-purple-50 text-purple-600">
                  <Clock size={18} />
                </div>
              </div>
              <div>
                <p className="text-3xl font-extrabold text-purple-700">{data?.kpi.ordersInProgress ?? 0}</p>
                <p className="text-xs text-slate-400 mt-2">Active queue</p>
              </div>
            </div>

            {/* KPI 5: Completed Today */}
            <div className="bg-white p-5 rounded-2xl border border-slate-200 shadow-sm flex flex-col justify-between">
              <div className="flex items-center justify-between text-slate-500 mb-2">
                <span className="text-xs font-bold uppercase tracking-wider">Completed Today</span>
                <div className="p-2 rounded-xl bg-teal-50 text-teal-600">
                  <CheckCircle2 size={18} />
                </div>
              </div>
              <div>
                <p className="text-3xl font-extrabold text-teal-700">{data?.kpi.completedOrdersToday ?? 0}</p>
                <p className="text-xs text-slate-400 mt-2">Collected drinks</p>
              </div>
            </div>
          </div>
        </section>

        {/* B. Sales / Trend Section */}
        <section className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          {/* 7-Day Trend Chart Representation */}
          <div className="lg:col-span-2 bg-white p-6 rounded-2xl border border-slate-200 shadow-sm">
            <div className="flex items-center justify-between mb-6">
              <div>
                <h3 className="text-lg font-bold text-slate-900">7-Day Sales & Volume Trend</h3>
                <p className="text-xs text-slate-500">Revenue and order count progression over the past week</p>
              </div>
              <span className="text-xs font-semibold px-2.5 py-1 bg-amber-50 text-amber-800 rounded-lg border border-amber-200">
                Daily Breakdown
              </span>
            </div>

            <div className="space-y-3">
              {data?.trends.map((item, idx) => {
                const maxRevenue = Math.max(...(data?.trends.map((t) => t.revenue) || [1]), 100);
                const percentage = Math.min(Math.max((item.revenue / maxRevenue) * 100, 4), 100);

                return (
                  <div key={idx} className="space-y-1">
                    <div className="flex justify-between items-center text-xs">
                      <span className="font-semibold text-slate-700 w-28">{item.date}</span>
                      <div className="flex items-center gap-4">
                        <span className="text-slate-500">{item.orderCount} orders</span>
                        <span className="text-slate-500">AOV: Rs. {item.aov.toLocaleString()}</span>
                        <span className="font-bold text-slate-900 w-24 text-right">
                          Rs. {item.revenue.toLocaleString()}
                        </span>
                      </div>
                    </div>
                    <div className="w-full bg-slate-100 rounded-full h-3 overflow-hidden">
                      <div
                        className="bg-amber-600 h-3 rounded-full transition-all duration-500"
                        style={{ width: `${percentage}%` }}
                      ></div>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>

          {/* Popular Items / Quick Insights */}
          <div className="bg-white p-6 rounded-2xl border border-slate-200 shadow-sm flex flex-col justify-between">
            <div>
              <div className="flex items-center justify-between mb-4">
                <h3 className="text-lg font-bold text-slate-900">Top Selling Drinks</h3>
                <Coffee size={18} className="text-amber-700" />
              </div>
              <p className="text-xs text-slate-500 mb-4">Most ordered drinks across all historical orders</p>

              <div className="space-y-3">
                {data?.popularDrinks && data.popularDrinks.length > 0 ? (
                  data.popularDrinks.map((drink, i) => (
                    <div
                      key={drink.drinkId}
                      className="flex items-center justify-between p-3 rounded-xl bg-slate-50 border border-slate-100"
                    >
                      <div className="flex items-center gap-3">
                        <span className="w-6 h-6 rounded-full bg-amber-100 text-amber-800 text-xs font-bold flex items-center justify-center">
                          {i + 1}
                        </span>
                        <span className="text-sm font-semibold text-slate-800">{drink.drinkName}</span>
                      </div>
                      <span className="text-xs font-bold bg-amber-600 text-white px-2.5 py-1 rounded-full">
                        {drink.totalQuantity} sold
                      </span>
                    </div>
                  ))
                ) : (
                  <p className="text-sm text-slate-400 py-4 text-center">No drink sales recorded yet</p>
                )}
              </div>
            </div>

            <div className="mt-6 pt-4 border-t border-slate-100 text-xs text-slate-500 flex justify-between items-center">
              <span>All-time total orders</span>
              <span className="font-bold text-slate-800">{data?.kpi.totalAllTimeOrders ?? 0}</span>
            </div>
          </div>
        </section>

        {/* C. Staff Responsibility & Performance Section */}
        <section className="bg-white p-6 rounded-2xl border border-slate-200 shadow-sm">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 mb-6">
            <div>
              <div className="flex items-center gap-2">
                <Users className="text-amber-700" size={20} />
                <h3 className="text-lg font-bold text-slate-900">Staff Responsibility & Barista Output</h3>
              </div>
              <p className="text-xs text-slate-500 mt-0.5">
                Tracks order assignments, preparation status updates, and completed handoffs per barista
              </p>
            </div>
            <span className="text-xs text-slate-400">Captured in real-time via authenticated status changes</span>
          </div>

          <div className="overflow-x-auto">
            <table className="w-full text-left text-sm">
              <thead className="bg-slate-50 text-slate-600 text-xs uppercase tracking-wider border-b border-slate-200">
                <tr>
                  <th className="py-3 px-4">Staff Member</th>
                  <th className="py-3 px-4">Role</th>
                  <th className="py-3 px-4 text-center">Preparing (Today)</th>
                  <th className="py-3 px-4 text-center">Ready (Today)</th>
                  <th className="py-3 px-4 text-center">Completed (Today)</th>
                  <th className="py-3 px-4 text-center">Total Actions (Today)</th>
                  <th className="py-3 px-4 text-right">All-Time Handled</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {data?.staffPerformance && data.staffPerformance.length > 0 ? (
                  data.staffPerformance.map((staff) => (
                    <tr key={staff.id} className="hover:bg-slate-50 transition-colors">
                      <td className="py-3.5 px-4 font-semibold text-slate-800">
                        {staff.email}
                      </td>
                      <td className="py-3.5 px-4">
                        <span
                          className={`text-xs px-2 py-0.5 rounded font-bold ${
                            staff.role === 'ADMIN'
                              ? 'bg-purple-100 text-purple-800'
                              : 'bg-amber-100 text-amber-800'
                          }`}
                        >
                          {staff.role}
                        </span>
                      </td>
                      <td className="py-3.5 px-4 text-center font-medium text-amber-700">
                        {staff.todayPreparing}
                      </td>
                      <td className="py-3.5 px-4 text-center font-medium text-emerald-700">
                        {staff.todayReady}
                      </td>
                      <td className="py-3.5 px-4 text-center font-medium text-teal-700">
                        {staff.todayCompleted}
                      </td>
                      <td className="py-3.5 px-4 text-center font-bold text-slate-900">
                        {staff.todayTotalHandled}
                      </td>
                      <td className="py-3.5 px-4 text-right font-semibold text-slate-600">
                        {staff.allTimeHandled}
                      </td>
                    </tr>
                  ))
                ) : (
                  <tr>
                    <td colSpan={7} className="py-8 text-center text-slate-400">
                      No staff performance data available today
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </section>

        {/* D. Recent Operational Activity */}
        <section className="bg-white p-6 rounded-2xl border border-slate-200 shadow-sm">
          <div className="flex items-center justify-between mb-6">
            <div>
              <h3 className="text-lg font-bold text-slate-900">Recent Operational Activity</h3>
              <p className="text-xs text-slate-500">Live feed of the latest orders across the cafe</p>
            </div>
            <Link
              href="/staff/orders"
              className="inline-flex items-center gap-1 text-xs font-bold text-amber-700 hover:text-amber-800"
            >
              Open Live Barista Board <ChevronRight size={14} />
            </Link>
          </div>

          <div className="overflow-x-auto">
            <table className="w-full text-left text-sm">
              <thead className="bg-slate-50 text-slate-600 text-xs uppercase tracking-wider border-b border-slate-200">
                <tr>
                  <th className="py-3 px-4">Order #</th>
                  <th className="py-3 px-4">Customer</th>
                  <th className="py-3 px-4">Dining</th>
                  <th className="py-3 px-4">Items Summary</th>
                  <th className="py-3 px-4">Total</th>
                  <th className="py-3 px-4">Payment</th>
                  <th className="py-3 px-4">Status</th>
                  <th className="py-3 px-4">Handled By</th>
                  <th className="py-3 px-4 text-right">Time</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {data?.recentOrders && data.recentOrders.length > 0 ? (
                  data.recentOrders.map((order) => (
                    <tr key={order.id} className="hover:bg-slate-50 transition-colors">
                      <td className="py-3.5 px-4 font-bold text-slate-900">
                        #{order.orderNumber}
                      </td>
                      <td className="py-3.5 px-4 font-medium text-slate-700">
                        {order.customerName}
                      </td>
                      <td className="py-3.5 px-4">
                        <span className="text-xs font-semibold px-2 py-0.5 rounded bg-slate-100 text-slate-700">
                          {order.diningOption === 'DINE_IN' ? 'Dine In' : 'Takeaway'}
                        </span>
                      </td>
                      <td className="py-3.5 px-4 text-slate-600 max-w-xs truncate" title={order.itemsSummary}>
                        {order.itemsSummary}
                      </td>
                      <td className="py-3.5 px-4 font-bold text-slate-900">
                        Rs. {order.total.toLocaleString()}
                      </td>
                      <td className="py-3.5 px-4">
                        <span
                          className={`text-xs px-2 py-0.5 rounded-full font-bold ${
                            order.paymentStatus === 'PAID'
                              ? 'bg-emerald-100 text-emerald-800'
                              : 'bg-amber-100 text-amber-800'
                          }`}
                        >
                          {order.paymentStatus}
                        </span>
                      </td>
                      <td className="py-3.5 px-4">
                        {getStatusBadge(order.status)}
                      </td>
                      <td className="py-3.5 px-4 text-xs font-medium text-slate-600">
                        {order.responsibleStaff}
                      </td>
                      <td className="py-3.5 px-4 text-right text-xs text-slate-400">
                        {new Date(order.createdAt).toLocaleTimeString([], {
                          hour: '2-digit',
                          minute: '2-digit',
                        })}
                      </td>
                    </tr>
                  ))
                ) : (
                  <tr>
                    <td colSpan={9} className="py-8 text-center text-slate-400">
                      No recent orders found
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </section>
      </main>
    </div>
  );
}
