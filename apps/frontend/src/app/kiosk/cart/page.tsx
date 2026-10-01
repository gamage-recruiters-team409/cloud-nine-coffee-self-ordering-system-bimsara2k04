'use client';

import Link from 'next/link';
import { ArrowLeft, Trash2 } from 'lucide-react';
import { useCart } from '@/contexts/CartContext';
import { fetchAPI } from '@/lib/api';
import { getDrinkImage } from '@/lib/images';
import { useState } from 'react';
import { PayHereInitResponse } from '@/types';

/**
 * Submits a hidden form to PayHere so the browser navigates to the
 * hosted sandbox checkout. The merchant secret is never present here —
 * the backend already signed the payload.
 */
function submitToPayHere({ action, method, fields }: PayHereInitResponse) {
  const form = document.createElement('form');
  form.method = method;
  form.action = action;
  form.style.display = 'none';

  for (const [name, value] of Object.entries(fields)) {
    const input = document.createElement('input');
    input.type = 'hidden';
    input.name = name;
    input.value = value;
    form.appendChild(input);
  }

  document.body.appendChild(form);
  form.submit();
}

export default function CartPage() {
  const { items, removeItem, updateQuantity, clearCart, total } = useCart();
  const [diningOption, setDiningOption] = useState<'DINE_IN' | 'TAKEAWAY'>('DINE_IN');
  const [customerName, setCustomerName] = useState('');
  const [email, setEmail] = useState('');
  const [phone, setPhone] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [checkoutError, setCheckoutError] = useState<string | null>(null);

  const handleCheckout = async () => {
    if (items.length === 0 || submitting) return;

    setSubmitting(true);
    setCheckoutError(null);

    try {
      // Step 1: Create the order as PENDING. It is NOT visible to the barista yet.
      const orderData = {
        items: items.map((item) => ({
          drinkId: item.drink.id,
          quantity: item.quantity,
          modifierOptionIds: item.selectedModifiers.map((m) => m.id),
        })),
        diningOption,
        customerName: customerName.trim() || undefined,
      };

      const pendingOrder = await fetchAPI<{ id: string; orderNumber: number }>('/orders', {
        method: 'POST',
        body: JSON.stringify(orderData),
      });

      // Step 2: Ask the backend to build the signed PayHere sandbox form fields.
      const payhere = await fetchAPI<PayHereInitResponse>(
        `/payments/payhere/init/${pendingOrder.id}`,
        {
          method: 'POST',
          body: JSON.stringify({
            firstName: customerName.trim() || undefined,
            email: email.trim() || undefined,
            phone: phone.trim() || undefined,
          }),
        },
      );

      // Step 3: Hand the browser over to PayHere. Nothing is marked paid here —
      // only the PayHere notify callback can confirm payment.
      clearCart();
      submitToPayHere(payhere);
    } catch (error: any) {
      setCheckoutError(error.message || 'Something went wrong. Please try again.');
      setSubmitting(false);
    }
  };


  return (
    <div className="min-h-screen bg-amber-50">
      <header className="bg-amber-900 text-white py-6 px-8 flex items-center gap-4">
        <Link href="/kiosk/menu" className="hover:bg-amber-800 p-2 rounded-lg transition-colors">
          <ArrowLeft size={28} />
        </Link>
        <h1 className="text-2xl font-bold">Your Cart</h1>
      </header>

      <main className="max-w-4xl mx-auto px-8 py-8">
        {items.length === 0 ? (
          <div className="bg-white rounded-xl p-12 shadow-lg text-center">
            <p className="text-2xl text-gray-600 mb-6">Your cart is empty</p>
            <Link
              href="/kiosk/menu"
              className="inline-block bg-amber-600 hover:bg-amber-700 text-white py-3 px-8 rounded-lg text-lg font-bold transition-colors"
            >
              Browse Menu
            </Link>
          </div>
        ) : (
          <>
            <div className="space-y-4 mb-8">
              {items.map((item, index) => {
                const itemTotal =
                  (parseFloat(item.drink.price) +
                    item.selectedModifiers.reduce(
                      (sum, mod) => sum + parseFloat(mod.priceAdjustment),
                      0,
                    )) *
                  item.quantity;

                return (
                  <div key={index} className="bg-white rounded-2xl p-6 shadow-md border border-amber-100">
                    <div className="flex justify-between items-start gap-4 mb-4">
                      <div className="w-16 h-16 rounded-xl overflow-hidden bg-amber-50 shrink-0 border border-amber-200">
                        <img
                          src={getDrinkImage(item.drink.id)}
                          alt={item.drink.name}
                          className="w-full h-full object-cover object-center"
                        />
                      </div>
                      <div className="flex-1">
                        <h3 className="text-xl font-bold text-amber-900">{item.drink.name}</h3>
                        {item.selectedModifiers.length > 0 && (
                          <ul className="text-sm text-gray-600 mt-2 space-y-1">
                            {item.selectedModifiers.map((mod) => (
                              <li key={mod.id}>
                                {mod.name}
                                {parseFloat(mod.priceAdjustment) > 0 &&
                                  ` (+Rs. ${parseFloat(mod.priceAdjustment).toLocaleString()})`}
                              </li>
                            ))}
                          </ul>
                        )}
                      </div>
                      <button
                        onClick={() => removeItem(index)}
                        className="text-red-600 hover:text-red-800 p-2 hover:bg-red-50 rounded-lg transition-colors"
                      >
                        <Trash2 size={20} />
                      </button>
                    </div>

                    <div className="flex justify-between items-center">
                      <div className="flex items-center gap-4">
                        <button
                          onClick={() => updateQuantity(index, item.quantity - 1)}
                          className="bg-amber-200 hover:bg-amber-300 w-10 h-10 rounded-lg transition-colors"
                        >
                          -
                        </button>
                        <span className="text-lg font-bold w-8 text-center">{item.quantity}</span>
                        <button
                          onClick={() => updateQuantity(index, item.quantity + 1)}
                          className="bg-amber-200 hover:bg-amber-300 w-10 h-10 rounded-lg transition-colors"
                        >
                          +
                        </button>
                      </div>
                      <span className="text-xl font-bold text-amber-700">
                        Rs. {itemTotal.toLocaleString()}
                      </span>
                    </div>
                  </div>
                );
              })}
            </div>

            <div className="bg-white rounded-xl p-8 shadow-lg space-y-6">
              {/* Dining Option Selection */}
              <div>
                <label className="block text-lg font-bold text-gray-800 mb-3">
                  Dine In or Takeaway?
                </label>
                <div className="grid grid-cols-2 gap-4">
                  <button
                    type="button"
                    onClick={() => setDiningOption('DINE_IN')}
                    className={`py-4 px-6 rounded-xl text-lg font-bold transition-colors ${
                      diningOption === 'DINE_IN'
                        ? 'bg-amber-600 text-white'
                        : 'bg-amber-100 text-amber-900 hover:bg-amber-200'
                    }`}
                  >
                    Dine In
                  </button>
                  <button
                    type="button"
                    onClick={() => setDiningOption('TAKEAWAY')}
                    className={`py-4 px-6 rounded-xl text-lg font-bold transition-colors ${
                      diningOption === 'TAKEAWAY'
                        ? 'bg-amber-600 text-white'
                        : 'bg-amber-100 text-amber-900 hover:bg-amber-200'
                    }`}
                  >
                    Takeaway
                  </button>
                </div>
              </div>

              {/* Customer details used for the PayHere checkout */}
              <div>
                <label htmlFor="customerName" className="block text-lg font-bold text-gray-800 mb-3">
                  Name (Optional)
                </label>
                <input
                  id="customerName"
                  type="text"
                  value={customerName}
                  onChange={(e) => setCustomerName(e.target.value)}
                  placeholder="Enter your name"
                  className="w-full px-4 py-3 rounded-lg border-2 border-amber-200 focus:border-amber-500 focus:outline-none text-lg"
                />
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <label htmlFor="email" className="block text-lg font-bold text-gray-800 mb-3">
                    Email
                  </label>
                  <input
                    id="email"
                    type="email"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    placeholder="you@example.com"
                    className="w-full px-4 py-3 rounded-lg border-2 border-amber-200 focus:border-amber-500 focus:outline-none text-lg"
                  />
                </div>
                <div>
                  <label htmlFor="phone" className="block text-lg font-bold text-gray-800 mb-3">
                    Phone
                  </label>
                  <input
                    id="phone"
                    type="tel"
                    value={phone}
                    onChange={(e) => setPhone(e.target.value)}
                    placeholder="07X XXX XXXX"
                    className="w-full px-4 py-3 rounded-lg border-2 border-amber-200 focus:border-amber-500 focus:outline-none text-lg"
                  />
                </div>
              </div>

              {/* Total */}
              <div className="flex justify-between items-center pt-4 border-t-2 border-amber-100">
                <span className="text-2xl font-bold text-gray-800">Total</span>
                <span className="text-3xl font-bold text-amber-700">Rs. {total.toLocaleString()}</span>
              </div>

              {/* Inline error */}
              {checkoutError && (
                <div className="bg-red-50 border border-red-300 text-red-700 px-4 py-3 rounded-lg text-sm">
                  {checkoutError}
                </div>
              )}

              {/* Place Order Button */}
              <button
                onClick={handleCheckout}
                disabled={submitting}
                className="w-full bg-amber-600 hover:bg-amber-700 disabled:bg-amber-400 disabled:cursor-not-allowed text-white py-4 px-8 rounded-xl text-xl font-bold transition-colors"
              >
                {submitting ? 'Redirecting to secure payment...' : 'Pay with PayHere'}
              </button>
            </div>
          </>
        )}
      </main>
    </div>
  );
}
