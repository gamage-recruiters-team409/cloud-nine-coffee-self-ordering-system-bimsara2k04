'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { fetchAPI } from '@/lib/api';

export default function StaffLoginPage() {
  const router = useRouter();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => {
    const token = localStorage.getItem('staff_token');
    const userStr = localStorage.getItem('staff_user');
    if (token && userStr) {
      try {
        const user = JSON.parse(userStr);
        if (user.role === 'ADMIN') {
          router.push('/admin');
        } else {
          router.push('/staff/orders');
        }
      } catch {
        localStorage.removeItem('staff_token');
        localStorage.removeItem('staff_user');
      }
    }
  }, [router]);

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError('');

    try {
      const response = await fetchAPI<{ access_token: string; user: any }>('/auth/login', {
        method: 'POST',
        body: JSON.stringify({ email, password }),
      });

      localStorage.setItem('staff_token', response.access_token);
      localStorage.setItem('staff_user', JSON.stringify(response.user));

      if (response.user?.role === 'ADMIN') {
        router.push('/admin');
      } else {
        router.push('/staff/orders');
      }
    } catch (err: any) {
      setError(err.message || 'Login failed');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-gray-100 flex items-center justify-center p-8">
      <div className="max-w-md w-full bg-white rounded-xl p-8 shadow-lg">
        <h1 className="text-3xl font-bold text-amber-900 mb-6 text-center">Staff Login</h1>
        <p className="text-gray-600 text-center mb-8">Cloud Nine Cafe Bar</p>

        <form onSubmit={handleLogin} className="space-y-4">
          <div>
            <label htmlFor="email" className="block text-sm font-semibold text-gray-700 mb-2">
              Email
            </label>
            <input
              type="email"
              id="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              required
              className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-amber-500"
              placeholder="your@email.com"
            />
          </div>

          <div>
            <label htmlFor="password" className="block text-sm font-semibold text-gray-700 mb-2">
              Password
            </label>
            <input
              type="password"
              id="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              required
              className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-amber-500"
              placeholder="••••••••"
            />
          </div>

          {error && (
            <div className="bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded-lg">
              {error}
            </div>
          )}

          <button
            type="submit"
            disabled={loading}
            className="w-full bg-amber-600 hover:bg-amber-700 text-white py-3 rounded-lg font-bold transition-colors disabled:opacity-50"
          >
            {loading ? 'Logging in...' : 'Login'}
          </button>
        </form>

        <div className="mt-8 pt-6 border-t text-sm text-gray-600">
          <p className="font-semibold mb-2">Default Accounts:</p>
          <p>Admin: admin@cloudnine.com / admin123</p>
          <p>Barista: barista@cloudnine.com / barista123</p>
        </div>
      </div>
    </div>
  );
}
