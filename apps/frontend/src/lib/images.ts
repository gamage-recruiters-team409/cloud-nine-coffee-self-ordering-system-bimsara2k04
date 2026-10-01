export const DRINK_IMAGES: Record<string, string> = {
  'drink-espresso': '/images/drinks/espresso.png',
  'drink-americano': '/images/drinks/americano.png',
  'drink-latte': '/images/drinks/latte.png',
  'drink-cappuccino': '/images/drinks/cappuccino.png',
  'drink-mocha': '/images/drinks/mocha.png',
  'drink-flat-white': '/images/drinks/flat_white.png',
  'drink-iced-latte': '/images/drinks/iced_latte.png',
  'drink-iced-americano': '/images/drinks/iced_americano.png',
  'drink-iced-mocha': '/images/drinks/iced_mocha.png',
  'drink-cold-brew': '/images/drinks/cold_brew.png',
  'drink-chai-latte': '/images/drinks/chai_latte.png',
  'drink-matcha-latte': '/images/drinks/matcha_latte.png',
  'drink-hot-chocolate': '/images/drinks/hot_chocolate.png',
  'drink-caramel-macchiato': '/images/drinks/caramel_macchiato.png',
  'drink-iced-chai': '/images/drinks/iced_chai.png',
  'drink-iced-matcha': '/images/drinks/iced_matcha.png',
};

export function getDrinkImage(drinkId: string): string {
  if (DRINK_IMAGES[drinkId]) {
    return DRINK_IMAGES[drinkId];
  }
  const cleanId = drinkId.replace(/^drink-/, '').replace(/-/g, '_');
  return `/images/drinks/${cleanId}.png`;
}
