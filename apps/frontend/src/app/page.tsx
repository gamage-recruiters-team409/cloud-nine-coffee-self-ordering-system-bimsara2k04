import Link from 'next/link';

export default function HomePage() {
  return (
    <div className="min-h-screen bg-amber-50">
      <header className="bg-amber-900 text-white py-8 px-8 text-center">
        <h1 className="text-4xl font-bold mb-2">Cloud Nine Cafe Bar</h1>
        <p className="text-xl text-amber-200">Self-Ordering System</p>
      </header>

      <main className="max-w-6xl mx-auto px-8 py-16">
        <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
          <Link
            href="/kiosk"
            className="block bg-white hover:bg-gray-50 rounded-2xl p-12 shadow-xl text-center transition-all hover:scale-105"
          >
            <div className="text-6xl mb-6">☕</div>
            <h2 className="text-3xl font-bold text-amber-900 mb-4">Customer Ordering</h2>
            <p className="text-gray-600 text-lg">Browse menu and place your order</p>
          </Link>

          <Link
            href="/staff/login"
            className="block bg-white hover:bg-gray-50 rounded-2xl p-12 shadow-xl text-center transition-all hover:scale-105"
          >
            <div className="text-6xl mb-6">👨‍🍳</div>
            <h2 className="text-3xl font-bold text-amber-900 mb-4">Staff Access</h2>
            <p className="text-gray-600 text-lg">Manage orders and ingredients</p>
          </Link>
        </div>
      </main>
    </div>
  );
}
