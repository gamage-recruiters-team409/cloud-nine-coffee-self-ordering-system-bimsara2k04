'use client';

import { useState } from 'react';
import { Coffee } from 'lucide-react';
import { getDrinkImage } from '@/lib/images';

type DrinkImageProps = {
  drinkId: string;
  alt: string;
  /** Classes for the <img> itself, e.g. object-cover plus hover effects. */
  className?: string;
};

/**
 * Drink artwork with a graceful fallback.
 *
 * Images are resolved from the drink id (`/images/drinks/<name>.png`), and the
 * 16 seeded drinks use slug ids that match a file on disk. Drinks created by an
 * admin get a UUID, so nothing matches and a bare <img> renders as a broken
 * image icon.
 *
 * The placeholder is swapped in only after the request actually fails, so a
 * drink that has artwork is never covered by it.
 */
export default function DrinkImage({ drinkId, alt, className }: DrinkImageProps) {
  const [failed, setFailed] = useState(false);

  if (failed) {
    return (
      <div className="w-full h-full flex flex-col items-center justify-center gap-1 text-amber-400">
        <Coffee size={40} aria-hidden="true" />
        <span className="text-xs font-semibold text-amber-500">No image yet</span>
      </div>
    );
  }

  return (
    <img
      src={getDrinkImage(drinkId)}
      alt={alt}
      // Swap to the placeholder only on a genuine 404.
      onError={() => setFailed(true)}
      className={className}
      loading="lazy"
    />
  );
}