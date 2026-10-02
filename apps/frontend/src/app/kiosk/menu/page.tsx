'use client';

import { useEffect, useState, useCallback } from 'react';
import Link from 'next/link';
import { ArrowLeft, ShoppingCart } from 'lucide-react';
import { fetchAPI } from '@/lib/api';
import { DrinkCategory } from '@/types';
import { useCart } from '@/contexts/CartContext';
import { useSocket } from '@/hooks/useSocket';
import DrinkImage from '@/components/DrinkImage';

export default function MenuPage() {
  const [categories, setCategories] = useState<DrinkCategory[]>([]);
  const [loading, setLoading] = useState(true);
  const { items } = useCart();
  const { socket } = useSocket();
  const itemCount = items.reduce((sum, item) => sum + item.quantity, 0);

  const loadMenu = useCallback(() => {
    fetchAPI<DrinkCategory[]>('/categories')
      .then(setCategories)
      .catch(console.error)
      .finally(() => setLoading(false));
  }, []);

  useEffect(() => {
    loadMenu();
  }, [loadMenu]);

  useEffect(() => {
    if (!socket) return;

    const handleAvailabilityChange = () => {
      loadMenu();
    };

    // These names must match the gateway exactly. They previously used
    // snake_case while the server emits camelCase, so an admin changing a price
    // or availability never reached an already-open kiosk.
    socket.on('menu.availabilityChanged', handleAvailabilityChange);
    socket.on('ingredient.availabilityChanged', handleAvailabilityChange);

    return () => {
      socket.off('menu.availabilityChanged', handleAvailabilityChange);
      socket.off('ingredient.availabilityChanged', handleAvailabilityChange);
    };
  }, [socket, loadMenu]);

  // An item an admin has hidden must not appear on the kiosk at all, rather
  // than being listed greyed out and unclickable: a hidden item is off the
  // menu, not sold out. Categories left with nothing to show are dropped so we
  // never render a bare heading.
  const visibleCategories = categories
    .map((category) => ({
      ...category,
      drinks: category.drinks?.filter((drink) => drink.isAvailable) ?? [],
    }))
    .filter((category) => category.drinks.length > 0);

  if (loading) {
    return (
      <div className="min-h-screen bg-amber-50 flex items-center justify-center">
        <p className="text-2xl text-amber-900">Loading menu...</p>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-amber-50">
      <header className="bg-amber-900 text-white py-6 px-8 flex justify-between items-center sticky top-0 z-10 shadow-md">
        <div className="flex items-center gap-4">
          <Link href="/kiosk" className="hover:bg-amber-800 p-2 rounded-lg transition-colors">
            <ArrowLeft size={28} />
          </Link>
          <h1 className="text-2xl font-bold">Menu</h1>
        </div>
        <Link
          href="/kiosk/cart"
          className="relative bg-amber-700 hover:bg-amber-600 px-6 py-3 rounded-full flex items-center gap-2 transition-colors shadow-sm"
        >
          <ShoppingCart size={24} />
          {itemCount > 0 && (
            <span className="absolute -top-2 -right-2 bg-red-600 text-white w-7 h-7 rounded-full flex items-center justify-center text-sm font-bold shadow-md">
              {itemCount}
            </span>
          )}
        </Link>
      </header>

      <main className="max-w-6xl mx-auto px-8 py-8">
        {visibleCategories.map((category) => (
          <section key={category.id} className="mb-12">
            <h2 className="text-3xl font-bold text-amber-900 mb-6">{category.name}</h2>
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
              {category.drinks?.map((drink) => (
                <Link
                  key={drink.id}
                  href={`/kiosk/drink/${drink.id}`}
                  className="group block bg-white rounded-2xl p-5 shadow-md transition-all overflow-hidden border border-amber-100/60 hover:shadow-xl hover:-translate-y-1 cursor-pointer"
                >
                  <div className="relative w-full h-48 mb-4 rounded-xl overflow-hidden bg-amber-50 flex items-center justify-center border border-amber-100">
                    <DrinkImage
                      drinkId={drink.id}
                      alt={drink.name}
                      className="w-full h-full object-cover object-center group-hover:scale-105 transition-transform duration-300"
                    />
                  </div>
                  <h3 className="text-xl font-bold text-amber-900 mb-1.5">{drink.name}</h3>
                  {drink.description && (
                    <p className="text-gray-600 text-sm mb-3 line-clamp-2">{drink.description}</p>
                  )}
                  <div className="flex items-center justify-between pt-2 border-t border-amber-50">
                    <p className="text-2xl font-extrabold text-amber-800">
                      Rs. {parseFloat(drink.price).toLocaleString()}
                    </p>
                    <span className="text-xs font-bold text-amber-700 bg-amber-50 px-3 py-1 rounded-full border border-amber-200">
                      Customize →
                    </span>
                  </div>
                </Link>
              ))}
            </div>
          </section>
        ))}
      </main>
    </div>
  );
}
