'use client';

import Link from 'next/link';
import { ShoppingCart } from 'lucide-react';
import { useCart } from '@/contexts/CartContext';

export default function KioskPage() {
  const { items } = useCart();
  const itemCount = items.reduce((sum, item) => sum + item.quantity, 0);

  return (
    <div className="min-h-screen bg-amber-50">
      <header className="bg-amber-900 text-white py-6 px-8 flex justify-between items-center">
        <div>
          <h1 className="text-3xl font-bold">Cloud Nine Cafe Bar</h1>
          <p className="text-amber-200 text-sm">Order your favorite drinks</p>
        </div>
        <Link
          href="/kiosk/cart"
          className="relative bg-amber-700 hover:bg-amber-600 px-6 py-3 rounded-full flex items-center gap-2 transition-colors"
        >
          <ShoppingCart size={24} />
          {itemCount > 0 && (
            <span className="absolute -top-2 -right-2 bg-red-600 text-white w-7 h-7 rounded-full flex items-center justify-center text-sm font-bold">
              {itemCount}
            </span>
          )}
        </Link>
      </header>

      <main className="max-w-6xl mx-auto px-8 py-12">
        <div className="text-center mb-12">
          <h2 className="text-4xl font-bold text-amber-900 mb-4">Welcome!</h2>
          <p className="text-xl text-gray-700">Browse our menu and place your order</p>
        </div>

        <Link
          href="/kiosk/menu"
          className="block max-w-md mx-auto bg-amber-600 hover:bg-amber-700 text-white text-center py-6 px-8 rounded-2xl text-2xl font-bold transition-colors shadow-lg"
        >
          Start Ordering
        </Link>
      </main>
    </div>
  );
}
