'use client';

import { useEffect, useState, useCallback } from 'react';
import { useParams, useRouter } from 'next/navigation';
import Link from 'next/link';
import { ArrowLeft, Plus, Minus } from 'lucide-react';
import { fetchAPI } from '@/lib/api';
import { Drink, ModifierGroup, ModifierOption } from '@/types';
import { useCart } from '@/contexts/CartContext';
import { useSocket } from '@/hooks/useSocket';
import DrinkImage from '@/components/DrinkImage';

export default function DrinkPage() {
  const params = useParams();
  const router = useRouter();
  const { addItem } = useCart();
  const { socket } = useSocket();
  const [drink, setDrink] = useState<Drink | null>(null);
  const [quantity, setQuantity] = useState(1);
  const [selectedModifiers, setSelectedModifiers] = useState<Record<string, string[]>>({});
  const [loading, setLoading] = useState(true);

  const loadDrink = useCallback(() => {
    if (!params.id) return;
    fetchAPI<Drink>(`/drinks/${params.id}`)
      .then((data) => {
        setDrink(data);
        // Clean up any previously selected modifiers that became unavailable
        setSelectedModifiers((prev) => {
          const nextState: Record<string, string[]> = {};
          data.modifierGroups?.forEach(({ modifierGroup }) => {
            const currentSelected = prev[modifierGroup.id] || [];
            const validSelected = currentSelected.filter((optId) => {
              const opt = modifierGroup.options.find((o) => o.id === optId);
              return opt && opt.isAvailable;
            });
            if (validSelected.length > 0) {
              nextState[modifierGroup.id] = validSelected;
            }
          });
          return nextState;
        });
      })
      .catch(console.error)
      .finally(() => setLoading(false));
  }, [params.id]);

  useEffect(() => {
    loadDrink();
  }, [loadDrink]);

  useEffect(() => {
    if (!socket) return;

    const handleAvailabilityChange = () => {
      loadDrink();
    };

    socket.on('menu.availability_changed', handleAvailabilityChange);
    socket.on('ingredient.availability_changed', handleAvailabilityChange);

    return () => {
      socket.off('menu.availability_changed', handleAvailabilityChange);
      socket.off('ingredient.availability_changed', handleAvailabilityChange);
    };
  }, [socket, loadDrink]);

  const toggleModifier = (groupId: string, optionId: string, maxSelections: number) => {
    setSelectedModifiers((prev) => {
      const current = prev[groupId] || [];
      const isSelected = current.includes(optionId);

      if (isSelected) {
        return { ...prev, [groupId]: current.filter((id) => id !== optionId) };
      } else {
        if (maxSelections === 1) {
          return { ...prev, [groupId]: [optionId] };
        } else {
          if (current.length < maxSelections) {
            return { ...prev, [groupId]: [...current, optionId] };
          }
          return prev;
        }
      }
    });
  };

  const handleAddToCart = () => {
    if (!drink) return;

    const allSelectedOptions: ModifierOption[] = [];
    drink.modifierGroups.forEach(({ modifierGroup }) => {
      const selected = selectedModifiers[modifierGroup.id] || [];
      selected.forEach((optionId) => {
        const option = modifierGroup.options.find((o) => o.id === optionId);
        if (option) allSelectedOptions.push(option);
      });
    });

    // Validate required groups
    const missingRequired = drink.modifierGroups.some(({ modifierGroup }) => {
      if (modifierGroup.isRequired) {
        const selected = selectedModifiers[modifierGroup.id] || [];
        return selected.length < modifierGroup.minSelections;
      }
      return false;
    });

    if (missingRequired) {
      alert('Please select all required options');
      return;
    }

    addItem({
      drink,
      quantity,
      selectedModifiers: allSelectedOptions,
    });

    router.push('/kiosk/menu');
  };

  const calculateTotal = () => {
    if (!drink) return 0;
    let total = parseFloat(drink.price);
    Object.values(selectedModifiers)
      .flat()
      .forEach((optionId) => {
        drink.modifierGroups.forEach(({ modifierGroup }) => {
          const option = modifierGroup.options.find((o) => o.id === optionId);
          if (option) {
            total += parseFloat(option.priceAdjustment);
          }
        });
      });
    return total * quantity;
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-amber-50 flex items-center justify-center">
        <p className="text-2xl text-amber-900">Loading...</p>
      </div>
    );
  }

  if (!drink) {
    return (
      <div className="min-h-screen bg-amber-50 flex items-center justify-center">
        <p className="text-2xl text-red-600">Drink not found</p>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-amber-50">
      <header className="bg-amber-900 text-white py-6 px-8 flex items-center gap-4">
        <Link href="/kiosk/menu" className="hover:bg-amber-800 p-2 rounded-lg transition-colors">
          <ArrowLeft size={28} />
        </Link>
        <h1 className="text-2xl font-bold">Customize Your Drink</h1>
      </header>

      <main className="max-w-4xl mx-auto px-8 py-8">
        <div className="bg-white rounded-2xl p-6 sm:p-8 shadow-lg mb-8 border border-amber-100 flex flex-col sm:flex-row items-center gap-6">
          <div className="w-full sm:w-48 h-48 rounded-xl overflow-hidden bg-amber-50 shrink-0 border border-amber-200">
            <DrinkImage drinkId={drink.id} alt={drink.name} className="w-full h-full object-cover object-center" />
          </div>
          <div className="flex-1 text-left">
            <h2 className="text-3xl font-bold text-amber-900 mb-2">{drink.name}</h2>
            {drink.description && <p className="text-gray-600 mb-4">{drink.description}</p>}
            <p className="text-3xl font-extrabold text-amber-800">
              Rs. {parseFloat(drink.price).toLocaleString()}
            </p>
          </div>
        </div>

        {drink.modifierGroups.map(({ modifierGroup }) => (
          <div key={modifierGroup.id} className="bg-white rounded-xl p-8 shadow-lg mb-6">
            <h3 className="text-xl font-bold text-amber-900 mb-2">
              {modifierGroup.name}
              {modifierGroup.isRequired && <span className="text-red-600 ml-2">*</span>}
            </h3>
            <p className="text-sm text-gray-600 mb-4">
              {modifierGroup.maxSelections === 1
                ? 'Select one'
                : `Select up to ${modifierGroup.maxSelections}`}
            </p>
            <div className="space-y-3">
              {modifierGroup.options.map((option) => {
                const isSelected = (selectedModifiers[modifierGroup.id] || []).includes(option.id);
                const isDisabled = !option.isAvailable;

                return (
                  <button
                    key={option.id}
                    onClick={() =>
                      !isDisabled &&
                      toggleModifier(modifierGroup.id, option.id, modifierGroup.maxSelections)
                    }
                    disabled={isDisabled}
                    className={`w-full text-left p-4 rounded-lg border-2 transition-all ${
                      isSelected
                        ? 'border-amber-600 bg-amber-50'
                        : 'border-gray-200 hover:border-amber-300'
                    } ${isDisabled ? 'opacity-50 cursor-not-allowed' : 'cursor-pointer'}`}
                  >
                    <div className="flex justify-between items-center">
                      <span className="font-semibold text-gray-800">{option.name}</span>
                      <span className="text-amber-700 font-bold">
                        {parseFloat(option.priceAdjustment) === 0
                          ? 'Included'
                          : `+Rs. ${parseFloat(option.priceAdjustment).toLocaleString()}`}
                      </span>
                    </div>
                    {isDisabled && (
                      <p className="text-red-600 text-sm mt-1">Currently unavailable</p>
                    )}
                  </button>
                );
              })}
            </div>
          </div>
        ))}

        <div className="bg-white rounded-xl p-8 shadow-lg">
          <div className="flex items-center justify-between mb-6">
            <span className="text-xl font-bold text-gray-800">Quantity</span>
            <div className="flex items-center gap-4">
              <button
                onClick={() => setQuantity((q) => Math.max(1, q - 1))}
                className="bg-amber-200 hover:bg-amber-300 w-12 h-12 rounded-full flex items-center justify-center transition-colors"
              >
                <Minus size={20} />
              </button>
              <span className="text-2xl font-bold w-12 text-center">{quantity}</span>
              <button
                onClick={() => setQuantity((q) => q + 1)}
                className="bg-amber-200 hover:bg-amber-300 w-12 h-12 rounded-full flex items-center justify-center transition-colors"
              >
                <Plus size={20} />
              </button>
            </div>
          </div>

          <button
            onClick={handleAddToCart}
            className="w-full bg-amber-600 hover:bg-amber-700 text-white py-4 px-8 rounded-xl text-xl font-bold transition-colors"
          >
            Add to Cart - Rs. {calculateTotal().toLocaleString()}
          </button>
        </div>
      </main>
    </div>
  );
}
