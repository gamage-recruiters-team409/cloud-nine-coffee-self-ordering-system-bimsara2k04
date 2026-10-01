'use client';

import { ReactNode } from 'react';
import { CartProvider } from '@/contexts/CartContext';

export default function KioskLayout({ children }: { children: ReactNode }) {
  return <CartProvider>{children}</CartProvider>;
}
