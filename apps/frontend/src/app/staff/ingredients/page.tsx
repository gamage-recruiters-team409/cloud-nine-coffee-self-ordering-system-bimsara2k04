'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { ArrowLeft, Power, PowerOff } from 'lucide-react';
import { fetchWithAuth } from '@/lib/api';
import { Ingredient } from '@/types';

export default function IngredientsPage() {
  const router = useRouter();
  const [ingredients, setIngredients] = useState<Ingredient[]>([]);
  const [token, setToken] = useState('');
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const savedToken = localStorage.getItem('staff_token');
    if (!savedToken) {
      router.push('/staff/login');
      return;
    }
    setToken(savedToken);

    fetchWithAuth<Ingredient[]>('/ingredients', savedToken)
      .then(setIngredients)
      .catch(() => {
        localStorage.removeItem('staff_token');
        localStorage.removeItem('staff_user');
        router.push('/staff/login');
      })
      .finally(() => setLoading(false));
  }, [router]);

  const handleToggle = async (id: string, currentStatus: boolean) => {
    try {
      const updated = await fetchWithAuth<Ingredient>(`/ingredients/${id}/availability`, token, {
        method: 'PATCH',
        body: JSON.stringify({ isAvailable: !currentStatus }),
      });

      setIngredients((prev) => prev.map((ing) => (ing.id === id ? updated : ing)));
    } catch (error) {
      alert('Failed to update ingredient availability');
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-gray-100 flex items-center justify-center">
        <p className="text-2xl text-gray-700">Loading ingredients...</p>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-100">
      <header className="bg-amber-900 text-white py-4 px-8 flex items-center gap-4">
        <Link href="/staff/orders" className="hover:bg-amber-800 p-2 rounded-lg transition-colors">
          <ArrowLeft size={24} />
        </Link>
        <h1 className="text-2xl font-bold">Manage Ingredients</h1>
      </header>

      <main className="max-w-4xl mx-auto px-8 py-8">
        <div className="bg-white rounded-xl p-6 shadow-lg">
          <p className="text-gray-600 mb-6">
            Toggle ingredient availability. Unavailable ingredients will automatically disable
            related drinks and modifiers.
          </p>

          <div className="space-y-3">
            {ingredients.map((ingredient) => (
              <div
                key={ingredient.id}
                className="flex justify-between items-center p-4 border-2 border-gray-200 rounded-lg hover:border-gray-300 transition-colors"
              >
                <span className="font-semibold text-gray-800">{ingredient.name}</span>
                <button
                  onClick={() => handleToggle(ingredient.id, ingredient.isAvailable)}
                  className={`flex items-center gap-2 px-6 py-2 rounded-lg font-bold transition-colors ${
                    ingredient.isAvailable
                      ? 'bg-green-500 hover:bg-green-600 text-white'
                      : 'bg-red-500 hover:bg-red-600 text-white'
                  }`}
                >
                  {ingredient.isAvailable ? (
                    <>
                      <Power size={20} />
                      Available
                    </>
                  ) : (
                    <>
                      <PowerOff size={20} />
                      Unavailable
                    </>
                  )}
                </button>
              </div>
            ))}
          </div>
        </div>
      </main>
    </div>
  );
}
