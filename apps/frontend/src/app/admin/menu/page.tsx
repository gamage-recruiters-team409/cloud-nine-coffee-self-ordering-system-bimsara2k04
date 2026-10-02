'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import {
  Coffee,
  LogOut,
  Plus,
  RefreshCw,
  ShieldCheck,
  Pencil,
  Check,
  X,
  ArrowLeft,
  AlertCircle,
} from 'lucide-react';
import { fetchWithAuth } from '@/lib/api';
import { Drink, DrinkCategory } from '@/types';

/**
 * Admin menu management.
 *
 * Covers the two pricing/catalogue operations an admin needs: change the price
 * of an existing item, and add a new item. Every mutation is a server-authoritative
 * PATCH/POST against /drinks, and the returned drink replaces local state so the
 * UI always reflects what the backend stored (including the Decimal->string
 * round trip).
 *
 * Historical orders are unaffected: OrderItem snapshots drinkName and drinkPrice
 * at checkout, so repricing never rewrites past orders.
 */

type EditState = { price: string; name: string; description: string };

export default function AdminMenuPage() {
  const router = useRouter();

  const [token, setToken] = useState<string | null>(null);
  const [currentUser, setCurrentUser] = useState<{ email: string; role: string } | null>(null);
  const [drinks, setDrinks] = useState<Drink[]>([]);
  const [categories, setCategories] = useState<DrinkCategory[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);

  const [editingId, setEditingId] = useState<string | null>(null);
  const [edit, setEdit] = useState<EditState>({ price: '', name: '', description: '' });
  const [savingId, setSavingId] = useState<string | null>(null);

  const [showCreate, setShowCreate] = useState(false);
  const [draft, setDraft] = useState({ name: '', description: '', price: '', categoryId: '' });
  const [creating, setCreating] = useState(false);

  const load = useCallback(
    async (authToken: string) => {
      try {
        setError(null);
        const [drinkList, categoryList] = await Promise.all([
          fetchWithAuth<Drink[]>('/drinks', authToken),
          fetchWithAuth<DrinkCategory[]>('/categories', authToken),
        ]);
        setDrinks(drinkList);
        setCategories(categoryList);
      } catch (err: any) {
        setError(err?.message || 'Failed to load the menu');
      } finally {
        setLoading(false);
      }
    },
    [],
  );

  useEffect(() => {
    const authToken = localStorage.getItem('staff_token');
    const userStr = localStorage.getItem('staff_user');

    if (!authToken) {
      router.push('/staff/login');
      return;
    }

    if (userStr) {
      try {
        const user = JSON.parse(userStr);
        setCurrentUser(user);
        // Mirrors the dashboard: menu management is ADMIN only.
        if (user.role !== 'ADMIN') {
          router.push('/staff/orders');
          return;
        }
      } catch {
        localStorage.removeItem('staff_token');
        localStorage.removeItem('staff_user');
        router.push('/staff/login');
        return;
      }
    }

    setToken(authToken);
    load(authToken);
  }, [router, load]);

  const handleLogout = useCallback(() => {
    localStorage.removeItem('staff_token');
    localStorage.removeItem('staff_user');
    router.push('/staff/login');
  }, [router]);

  const showNotice = useCallback((message: string) => {
    setNotice(message);
    setError(null);
    setTimeout(() => setNotice(null), 4000);
  }, []);

  const showError = useCallback((err: any, fallback: string) => {
    setNotice(null);
    setError(err?.message || fallback);
  }, []);

  const startEdit = useCallback((drink: Drink) => {
    setEditingId(drink.id);
    setEdit({
      price: parseFloat(drink.price).toFixed(2),
      name: drink.name,
      description: drink.description ?? '',
    });
  }, []);

  const cancelEdit = useCallback(() => {
    setEditingId(null);
    setEdit({ price: '', name: '', description: '' });
  }, []);

  const saveEdit = useCallback(
    async (drink: Drink) => {
      if (!token) return;

      const price = Number(edit.price);

      // Guard before the request: the server rejects these too, but failing
      // fast keeps the message next to the field the admin is looking at.
      if (!Number.isFinite(price) || price < 0) {
        setError('Price must be zero or more.');
        return;
      }

      const name = edit.name.trim();
      if (name.length < 2) {
        setError('Item name must be at least 2 characters.');
        return;
      }

      setSavingId(drink.id);
      try {
        const updated = await fetchWithAuth<Drink>(`/drinks/${drink.id}`, token, {
          method: 'PATCH',
          body: JSON.stringify({
            price,
            name,
            description: edit.description.trim(),
          }),
        });

        setDrinks((prev) => prev.map((d) => (d.id === updated.id ? updated : d)));
        cancelEdit();
        showNotice(`${updated.name} updated — now Rs. ${parseFloat(updated.price).toLocaleString()}`);
      } catch (err: any) {
        showError(err, 'Failed to update the item');
      } finally {
        setSavingId(null);
      }
    },
    [token, edit, cancelEdit, showNotice, showError],
  );

  const toggleAvailability = useCallback(
    async (drink: Drink) => {
      if (!token) return;

      setSavingId(drink.id);
      try {
        const updated = await fetchWithAuth<Drink>(`/drinks/${drink.id}`, token, {
          method: 'PATCH',
          body: JSON.stringify({ isAvailable: !drink.isAvailable }),
        });

        setDrinks((prev) => prev.map((d) => (d.id === updated.id ? updated : d)));
        showNotice(`${updated.name} is now ${updated.isAvailable ? 'available' : 'hidden from the kiosk'}`);
      } catch (err: any) {
        showError(err, 'Failed to change availability');
      } finally {
        setSavingId(null);
      }
    },
    [token, showNotice, showError],
  );

  const createDrink = useCallback(
    async (event: React.FormEvent) => {
      event.preventDefault();
      if (!token) return;

      const price = Number(draft.price);

      if (draft.name.trim().length < 2) {
        setError('Item name must be at least 2 characters.');
        return;
      }
      if (!Number.isFinite(price) || price < 0) {
        setError('Price must be zero or more.');
        return;
      }
      if (!draft.categoryId) {
        setError('Choose a category for the new item.');
        return;
      }

      setCreating(true);
      try {
        const created = await fetchWithAuth<Drink>('/drinks', token, {
          method: 'POST',
          body: JSON.stringify({
            name: draft.name.trim(),
            description: draft.description.trim(),
            price,
            categoryId: draft.categoryId,
          }),
        });

        setDrinks((prev) => [...prev, created]);
        setDraft({ name: '', description: '', price: '', categoryId: draft.categoryId });
        setShowCreate(false);
        showNotice(`${created.name} added at Rs. ${parseFloat(created.price).toLocaleString()}`);
      } catch (err: any) {
        showError(err, 'Failed to add the item');
      } finally {
        setCreating(false);
      }
    },
    [token, draft, showNotice, showError],
  );

  /**
   * Grouped by category for display only. The backend already returns drinks
   * ordered by category then sortOrder, so this preserves that order.
   */
  const grouped = useMemo(() => {
    return drinks.reduce<Record<string, Drink[]>>((acc, drink) => {
      const key = drink.category?.name ?? 'Uncategorised';
      (acc[key] ||= []).push(drink);
      return acc;
    }, {});
  }, [drinks]);

  if (loading) {
    return (
      <div className="min-h-screen bg-slate-100 flex items-center justify-center">
        <RefreshCw size={40} className="text-amber-600 animate-spin" />
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-slate-100">
      <header className="bg-slate-900 text-white sticky top-0 z-20 shadow-md">
        <div className="max-w-7xl mx-auto px-6 py-4 flex flex-wrap justify-between items-center gap-4">
          <div className="flex items-center gap-4">
            <div className="bg-amber-600 p-2 rounded-lg text-white">
              <Coffee size={24} />
            </div>
            <div>
              <h1 className="text-xl font-bold tracking-tight">Menu Management</h1>
              <p className="text-xs text-slate-400">
                {currentUser?.email ?? 'Administrator'} &middot; Pricing &amp; Catalogue
              </p>
            </div>
          </div>

          <div className="flex items-center gap-3">
            <Link
              href="/admin"
              className="flex items-center gap-1.5 text-xs font-medium bg-slate-800 hover:bg-slate-700 text-slate-200 px-3.5 py-2 rounded-lg transition-colors border border-slate-700"
            >
              <ArrowLeft size={15} />
              Dashboard
            </Link>

            <Link
              href="/staff/orders"
              className="flex items-center gap-1.5 text-xs font-medium bg-slate-800 hover:bg-slate-700 text-slate-200 px-3.5 py-2 rounded-lg transition-colors border border-slate-700"
            >
              Barista Queue
            </Link>

            <button
              onClick={() => token && load(token)}
              className="flex items-center gap-1.5 text-xs font-medium bg-amber-600 hover:bg-amber-700 text-white px-3.5 py-2 rounded-lg transition-colors"
            >
              <RefreshCw size={14} />
              Refresh
            </button>

            <button
              onClick={handleLogout}
              className="text-xs font-medium bg-rose-600 hover:bg-rose-700 text-white px-3.5 py-2 rounded-lg transition-colors"
            >
              Logout
            </button>
          </div>
        </div>
      </header>

      <main className="max-w-7xl mx-auto px-6 py-8 space-y-6">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
          <div>
            <h2 className="text-2xl font-bold text-slate-800">Items &amp; Pricing</h2>
            <p className="text-sm text-slate-500">
              {drinks.length} item{drinks.length === 1 ? '' : 's'} across {categories.length}{' '}
              categor{categories.length === 1 ? 'y' : 'ies'}. Price changes apply to new
              orders only.
            </p>
          </div>

          <button
            onClick={() => setShowCreate((v) => !v)}
            className="flex items-center gap-2 bg-amber-600 hover:bg-amber-700 text-white px-5 py-3 rounded-xl font-semibold shadow-sm transition-colors"
          >
            {showCreate ? <X size={18} /> : <Plus size={18} />}
            {showCreate ? 'Cancel' : 'Add New Item'}
          </button>
        </div>

        {error && (
          <div className="bg-rose-50 border border-rose-200 text-rose-700 px-4 py-3 rounded-xl flex items-center gap-2">
            <AlertCircle size={18} />
            {error}
          </div>
        )}

        {notice && (
          <div className="bg-emerald-50 border border-emerald-200 text-emerald-800 px-4 py-3 rounded-xl flex items-center gap-2">
            <Check size={18} />
            {notice}
          </div>
        )}

        {showCreate && (
          <form
            onSubmit={createDrink}
            className="bg-white rounded-2xl shadow-sm border border-slate-200 p-6 space-y-4"
          >
            <div className="flex items-center gap-2">
              <ShieldCheck size={18} className="text-amber-600" />
              <h3 className="font-bold text-slate-800">New menu item</h3>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-semibold text-slate-700 mb-1.5">
                  Name
                </label>
                <input
                  value={draft.name}
                  onChange={(e) => setDraft({ ...draft, name: e.target.value })}
                  placeholder="e.g. Hazelnut Latte"
                  className="w-full border border-slate-300 rounded-lg px-3 py-2.5 focus:outline-none focus:ring-2 focus:ring-amber-500"
                />
              </div>

              <div>
                <label className="block text-sm font-semibold text-slate-700 mb-1.5">
                  Price (Rs.)
                </label>
                <input
                  type="number"
                  min="0"
                  step="0.01"
                  value={draft.price}
                  onChange={(e) => setDraft({ ...draft, price: e.target.value })}
                  placeholder="450.00"
                  className="w-full border border-slate-300 rounded-lg px-3 py-2.5 focus:outline-none focus:ring-2 focus:ring-amber-500"
                />
              </div>

              <div>
                <label className="block text-sm font-semibold text-slate-700 mb-1.5">
                  Category
                </label>
                <select
                  value={draft.categoryId}
                  onChange={(e) => setDraft({ ...draft, categoryId: e.target.value })}
                  className="w-full border border-slate-300 rounded-lg px-3 py-2.5 bg-white focus:outline-none focus:ring-2 focus:ring-amber-500"
                >
                  <option value="">Select a category</option>
                  {categories.map((c) => (
                    <option key={c.id} value={c.id}>
                      {c.name}
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label className="block text-sm font-semibold text-slate-700 mb-1.5">
                  Description
                </label>
                <input
                  value={draft.description}
                  onChange={(e) => setDraft({ ...draft, description: e.target.value })}
                  placeholder="Short description shown on the kiosk"
                  className="w-full border border-slate-300 rounded-lg px-3 py-2.5 focus:outline-none focus:ring-2 focus:ring-amber-500"
                />
              </div>
            </div>

            <div className="flex items-center gap-3 pt-2">
              <button
                type="submit"
                disabled={creating}
                className="flex items-center gap-2 bg-amber-600 hover:bg-amber-700 disabled:opacity-50 text-white px-5 py-2.5 rounded-lg font-semibold transition-colors"
              >
                {creating ? <RefreshCw size={16} className="animate-spin" /> : <Plus size={16} />}
                {creating ? 'Adding...' : 'Add Item'}
              </button>
              <span className="text-xs text-slate-500">
                New items go live on the kiosk immediately.
              </span>
            </div>
          </form>
        )}

        {Object.entries(grouped).map(([categoryName, items]) => (
          <section key={categoryName} className="space-y-3">
            <h3 className="text-lg font-bold text-slate-700">{categoryName}</h3>

            <div className="bg-white rounded-2xl shadow-sm border border-slate-200 divide-y divide-slate-100">
              {items.map((drink) => {
                const isEditing = editingId === drink.id;
                const isSaving = savingId === drink.id;

                return (
                  <div key={drink.id} className="p-4">
                    {isEditing ? (
                      <div className="space-y-3">
                        <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
                          <div>
                            <label className="block text-xs font-semibold text-slate-600 mb-1">
                              Name
                            </label>
                            <input
                              value={edit.name}
                              onChange={(e) => setEdit({ ...edit, name: e.target.value })}
                              className="w-full border border-slate-300 rounded-lg px-3 py-2 focus:outline-none focus:ring-2 focus:ring-amber-500"
                            />
                          </div>

                          <div>
                            <label className="block text-xs font-semibold text-slate-600 mb-1">
                              Price (Rs.)
                            </label>
                            <input
                              type="number"
                              min="0"
                              step="0.01"
                              value={edit.price}
                              onChange={(e) => setEdit({ ...edit, price: e.target.value })}
                              className="w-full border border-slate-300 rounded-lg px-3 py-2 focus:outline-none focus:ring-2 focus:ring-amber-500"
                            />
                          </div>

                          <div>
                            <label className="block text-xs font-semibold text-slate-600 mb-1">
                              Description
                            </label>
                            <input
                              value={edit.description}
                              onChange={(e) => setEdit({ ...edit, description: e.target.value })}
                              className="w-full border border-slate-300 rounded-lg px-3 py-2 focus:outline-none focus:ring-2 focus:ring-amber-500"
                            />
                          </div>
                        </div>

                        <div className="flex items-center gap-2">
                          <button
                            onClick={() => saveEdit(drink)}
                            disabled={isSaving}
                            className="flex items-center gap-1.5 bg-amber-600 hover:bg-amber-700 disabled:opacity-50 text-white px-4 py-2 rounded-lg text-sm font-semibold transition-colors"
                          >
                            {isSaving ? (
                              <RefreshCw size={15} className="animate-spin" />
                            ) : (
                              <Check size={15} />
                            )}
                            Save
                          </button>
                          <button
                            onClick={cancelEdit}
                            className="flex items-center gap-1.5 bg-slate-200 hover:bg-slate-300 text-slate-700 px-4 py-2 rounded-lg text-sm font-semibold transition-colors"
                          >
                            <X size={15} />
                            Cancel
                          </button>
                        </div>
                      </div>
                    ) : (
                      <div className="flex flex-wrap items-center justify-between gap-3">
                        <div className="min-w-0">
                          <div className="flex items-center gap-2">
                            <p className="font-semibold text-slate-800">{drink.name}</p>
                            {!drink.isAvailable && (
                              <span className="text-[10px] font-bold uppercase tracking-wide bg-slate-200 text-slate-600 px-2 py-0.5 rounded">
                                Hidden
                              </span>
                            )}
                          </div>
                          {drink.description && (
                            <p className="text-sm text-slate-500 truncate max-w-md">
                              {drink.description}
                            </p>
                          )}
                        </div>

                        <div className="flex items-center gap-2">
                          <span className="font-bold text-lg text-amber-700 mr-2">
                            Rs. {parseFloat(drink.price).toLocaleString()}
                          </span>

                          <button
                            onClick={() => toggleAvailability(drink)}
                            disabled={isSaving}
                            className="text-xs font-semibold bg-slate-100 hover:bg-slate-200 text-slate-700 px-3 py-2 rounded-lg transition-colors disabled:opacity-50"
                          >
                            {drink.isAvailable ? 'Hide' : 'Show'}
                          </button>

                          <button
                            onClick={() => startEdit(drink)}
                            className="flex items-center gap-1.5 text-xs font-semibold bg-amber-600 hover:bg-amber-700 text-white px-3.5 py-2 rounded-lg transition-colors"
                          >
                            <Pencil size={14} />
                            Edit
                          </button>
                        </div>
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          </section>
        ))}
      </main>
    </div>
  );
}