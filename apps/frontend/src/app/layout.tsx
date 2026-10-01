import '@fontsource-variable/manrope';
import './globals.css';
import type { Metadata } from 'next';

export const metadata: Metadata = {
  title: 'Cloud Nine Cafe Bar',
  description: 'Order and track your drinks with Cloud Nine Cafe Bar.',
};

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  );
}
