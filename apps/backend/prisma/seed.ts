import { PrismaClient } from '@prisma/client';
import * as bcrypt from 'bcryptjs';

const prisma = new PrismaClient();

async function main() {
  console.log('Seeding database...');

  // Create users
  const adminPassword = await bcrypt.hash('admin123', 10);
  const baristaPassword = await bcrypt.hash('barista123', 10);

  const admin = await prisma.user.upsert({
    where: { email: 'admin@cloudnine.com' },
    update: {},
    create: {
      email: 'admin@cloudnine.com',
      password: adminPassword,
      role: 'ADMIN',
    },
  });

  const barista = await prisma.user.upsert({
    where: { email: 'barista@cloudnine.com' },
    update: {},
    create: {
      email: 'barista@cloudnine.com',
      password: baristaPassword,
      role: 'BARISTA',
    },
  });

  console.log('Users created:', { admin: admin.email, barista: barista.email });

  // Create ingredients
  const ingredients = await Promise.all([
    prisma.ingredient.upsert({ where: { name: 'Espresso' }, update: {}, create: { name: 'Espresso', isAvailable: true } }),
    prisma.ingredient.upsert({ where: { name: 'Milk' }, update: {}, create: { name: 'Milk', isAvailable: true } }),
    prisma.ingredient.upsert({ where: { name: 'Oat Milk' }, update: {}, create: { name: 'Oat Milk', isAvailable: true } }),
    prisma.ingredient.upsert({ where: { name: 'Almond Milk' }, update: {}, create: { name: 'Almond Milk', isAvailable: true } }),
    prisma.ingredient.upsert({ where: { name: 'Soy Milk' }, update: {}, create: { name: 'Soy Milk', isAvailable: true } }),
    prisma.ingredient.upsert({ where: { name: 'Vanilla Syrup' }, update: {}, create: { name: 'Vanilla Syrup', isAvailable: true } }),
    prisma.ingredient.upsert({ where: { name: 'Caramel Syrup' }, update: {}, create: { name: 'Caramel Syrup', isAvailable: true } }),
    prisma.ingredient.upsert({ where: { name: 'Hazelnut Syrup' }, update: {}, create: { name: 'Hazelnut Syrup', isAvailable: true } }),
    prisma.ingredient.upsert({ where: { name: 'Chocolate Syrup' }, update: {}, create: { name: 'Chocolate Syrup', isAvailable: true } }),
    prisma.ingredient.upsert({ where: { name: 'Whipped Cream' }, update: {}, create: { name: 'Whipped Cream', isAvailable: true } }),
    prisma.ingredient.upsert({ where: { name: 'Ice' }, update: {}, create: { name: 'Ice', isAvailable: true } }),
    prisma.ingredient.upsert({ where: { name: 'Water' }, update: {}, create: { name: 'Water', isAvailable: true } }),
    prisma.ingredient.upsert({ where: { name: 'Chai Tea' }, update: {}, create: { name: 'Chai Tea', isAvailable: true } }),
    prisma.ingredient.upsert({ where: { name: 'Matcha Powder' }, update: {}, create: { name: 'Matcha Powder', isAvailable: true } }),
    prisma.ingredient.upsert({ where: { name: 'Cocoa Powder' }, update: {}, create: { name: 'Cocoa Powder', isAvailable: true } }),
  ]);

  const ingredientMap = Object.fromEntries(ingredients.map(i => [i.name, i.id]));

  console.log('Ingredients created:', ingredients.length);

  // Create drink categories
  const categories = await Promise.all([
    prisma.drinkCategory.upsert({ where: { name: 'Espresso Drinks' }, update: {}, create: { name: 'Espresso Drinks', sortOrder: 1 } }),
    prisma.drinkCategory.upsert({ where: { name: 'Iced Drinks' }, update: {}, create: { name: 'Iced Drinks', sortOrder: 2 } }),
    prisma.drinkCategory.upsert({ where: { name: 'Specialty Drinks' }, update: {}, create: { name: 'Specialty Drinks', sortOrder: 3 } }),
    prisma.drinkCategory.upsert({ where: { name: 'Tea' }, update: {}, create: { name: 'Tea', sortOrder: 4 } }),
  ]);

  const categoryMap = Object.fromEntries(categories.map(c => [c.name, c.id]));

  console.log('Categories created:', categories.length);

  // Create modifier groups
  const sizeGroup = await prisma.modifierGroup.upsert({
    where: { id: 'size-group' },
    update: {},
    create: { id: 'size-group', name: 'Size', minSelections: 1, maxSelections: 1, isRequired: true, sortOrder: 1 },
  });

  const milkGroup = await prisma.modifierGroup.upsert({
    where: { id: 'milk-group' },
    update: {},
    create: { id: 'milk-group', name: 'Milk Type', minSelections: 0, maxSelections: 1, isRequired: false, sortOrder: 2 },
  });

  const syrupGroup = await prisma.modifierGroup.upsert({
    where: { id: 'syrup-group' },
    update: {},
    create: { id: 'syrup-group', name: 'Syrup', minSelections: 0, maxSelections: 3, isRequired: false, sortOrder: 3 },
  });

  const sugarGroup = await prisma.modifierGroup.upsert({
    where: { id: 'sugar-group' },
    update: {},
    create: { id: 'sugar-group', name: 'Sugar Level', minSelections: 0, maxSelections: 1, isRequired: false, sortOrder: 4 },
  });

  const extrasGroup = await prisma.modifierGroup.upsert({
    where: { id: 'extras-group' },
    update: {},
    create: { id: 'extras-group', name: 'Extras', minSelections: 0, maxSelections: 3, isRequired: false, sortOrder: 5 },
  });

  console.log('Modifier groups created');

  // Create modifier options for Size
  const sizeSmall = await prisma.modifierOption.upsert({
    where: { id: 'size-small' },
    update: { priceAdjustment: 0 },
    create: { id: 'size-small', name: 'Small', priceAdjustment: 0, groupId: sizeGroup.id, sortOrder: 1 },
  });

  const sizeMedium = await prisma.modifierOption.upsert({
    where: { id: 'size-medium' },
    update: { priceAdjustment: 200 },
    create: { id: 'size-medium', name: 'Medium', priceAdjustment: 200, groupId: sizeGroup.id, sortOrder: 2 },
  });

  const sizeLarge = await prisma.modifierOption.upsert({
    where: { id: 'size-large' },
    update: { priceAdjustment: 400 },
    create: { id: 'size-large', name: 'Large', priceAdjustment: 400, groupId: sizeGroup.id, sortOrder: 3 },
  });

  // Create modifier options for Milk
  await prisma.modifierOption.upsert({
    where: { id: 'milk-regular' },
    update: { priceAdjustment: 0 },
    create: { id: 'milk-regular', name: 'Regular Milk', priceAdjustment: 0, groupId: milkGroup.id, sortOrder: 1 },
  });

  const milkOat = await prisma.modifierOption.upsert({
    where: { id: 'milk-oat' },
    update: { priceAdjustment: 350 },
    create: { id: 'milk-oat', name: 'Oat Milk', priceAdjustment: 350, groupId: milkGroup.id, sortOrder: 2 },
  });

  const milkAlmond = await prisma.modifierOption.upsert({
    where: { id: 'milk-almond' },
    update: { priceAdjustment: 350 },
    create: { id: 'milk-almond', name: 'Almond Milk', priceAdjustment: 350, groupId: milkGroup.id, sortOrder: 3 },
  });

  const milkSoy = await prisma.modifierOption.upsert({
    where: { id: 'milk-soy' },
    update: { priceAdjustment: 300 },
    create: { id: 'milk-soy', name: 'Soy Milk', priceAdjustment: 300, groupId: milkGroup.id, sortOrder: 4 },
  });

  // Link milk options to ingredients
  await prisma.modifierOptionIngredient.upsert({
    where: { optionId_ingredientId: { optionId: milkOat.id, ingredientId: ingredientMap['Oat Milk'] } },
    update: {},
    create: { optionId: milkOat.id, ingredientId: ingredientMap['Oat Milk'] },
  });

  await prisma.modifierOptionIngredient.upsert({
    where: { optionId_ingredientId: { optionId: milkAlmond.id, ingredientId: ingredientMap['Almond Milk'] } },
    update: {},
    create: { optionId: milkAlmond.id, ingredientId: ingredientMap['Almond Milk'] },
  });

  await prisma.modifierOptionIngredient.upsert({
    where: { optionId_ingredientId: { optionId: milkSoy.id, ingredientId: ingredientMap['Soy Milk'] } },
    update: {},
    create: { optionId: milkSoy.id, ingredientId: ingredientMap['Soy Milk'] },
  });

  // Create modifier options for Syrup
  const syrupVanilla = await prisma.modifierOption.upsert({
    where: { id: 'syrup-vanilla' },
    update: { priceAdjustment: 200 },
    create: { id: 'syrup-vanilla', name: 'Vanilla', priceAdjustment: 200, groupId: syrupGroup.id, sortOrder: 1 },
  });

  const syrupCaramel = await prisma.modifierOption.upsert({
    where: { id: 'syrup-caramel' },
    update: { priceAdjustment: 200 },
    create: { id: 'syrup-caramel', name: 'Caramel', priceAdjustment: 200, groupId: syrupGroup.id, sortOrder: 2 },
  });

  const syrupHazelnut = await prisma.modifierOption.upsert({
    where: { id: 'syrup-hazelnut' },
    update: { priceAdjustment: 200 },
    create: { id: 'syrup-hazelnut', name: 'Hazelnut', priceAdjustment: 200, groupId: syrupGroup.id, sortOrder: 3 },
  });

  // Link syrups to ingredients
  await prisma.modifierOptionIngredient.upsert({
    where: { optionId_ingredientId: { optionId: syrupVanilla.id, ingredientId: ingredientMap['Vanilla Syrup'] } },
    update: {},
    create: { optionId: syrupVanilla.id, ingredientId: ingredientMap['Vanilla Syrup'] },
  });

  await prisma.modifierOptionIngredient.upsert({
    where: { optionId_ingredientId: { optionId: syrupCaramel.id, ingredientId: ingredientMap['Caramel Syrup'] } },
    update: {},
    create: { optionId: syrupCaramel.id, ingredientId: ingredientMap['Caramel Syrup'] },
  });

  await prisma.modifierOptionIngredient.upsert({
    where: { optionId_ingredientId: { optionId: syrupHazelnut.id, ingredientId: ingredientMap['Hazelnut Syrup'] } },
    update: {},
    create: { optionId: syrupHazelnut.id, ingredientId: ingredientMap['Hazelnut Syrup'] },
  });

  // Create modifier options for Sugar Level
  await prisma.modifierOption.upsert({
    where: { id: 'sugar-none' },
    update: { priceAdjustment: 0 },
    create: { id: 'sugar-none', name: 'No Sugar', priceAdjustment: 0, groupId: sugarGroup.id, sortOrder: 1 },
  });

  await prisma.modifierOption.upsert({
    where: { id: 'sugar-light' },
    update: { priceAdjustment: 0 },
    create: { id: 'sugar-light', name: 'Light Sugar', priceAdjustment: 0, groupId: sugarGroup.id, sortOrder: 2 },
  });

  await prisma.modifierOption.upsert({
    where: { id: 'sugar-normal' },
    update: { priceAdjustment: 0 },
    create: { id: 'sugar-normal', name: 'Normal Sugar', priceAdjustment: 0, groupId: sugarGroup.id, sortOrder: 3 },
  });

  // Create modifier options for Extras
  const extraShot = await prisma.modifierOption.upsert({
    where: { id: 'extra-shot' },
    update: { priceAdjustment: 350 },
    create: { id: 'extra-shot', name: 'Extra Shot', priceAdjustment: 350, groupId: extrasGroup.id, sortOrder: 1 },
  });

  const extraWhipped = await prisma.modifierOption.upsert({
    where: { id: 'extra-whipped' },
    update: { priceAdjustment: 250 },
    create: { id: 'extra-whipped', name: 'Whipped Cream', priceAdjustment: 250, groupId: extrasGroup.id, sortOrder: 2 },
  });

  // Link extras to ingredients
  await prisma.modifierOptionIngredient.upsert({
    where: { optionId_ingredientId: { optionId: extraShot.id, ingredientId: ingredientMap['Espresso'] } },
    update: {},
    create: { optionId: extraShot.id, ingredientId: ingredientMap['Espresso'] },
  });

  await prisma.modifierOptionIngredient.upsert({
    where: { optionId_ingredientId: { optionId: extraWhipped.id, ingredientId: ingredientMap['Whipped Cream'] } },
    update: {},
    create: { optionId: extraWhipped.id, ingredientId: ingredientMap['Whipped Cream'] },
  });

  console.log('Modifier options created');

  // Create drinks
  const drinks = [
    {
      id: 'drink-espresso',
      name: 'Espresso',
      description: 'Rich and bold espresso shot',
      price: 750.0,
      categoryId: categoryMap['Espresso Drinks'],
      sortOrder: 1,
      ingredients: ['Espresso'],
      modifierGroups: [sizeGroup.id],
    },
    {
      id: 'drink-americano',
      name: 'Americano',
      description: 'Espresso with hot water',
      price: 950.0,
      categoryId: categoryMap['Espresso Drinks'],
      sortOrder: 2,
      ingredients: ['Espresso', 'Water'],
      modifierGroups: [sizeGroup.id, extrasGroup.id],
    },
    {
      id: 'drink-latte',
      name: 'Latte',
      description: 'Espresso with steamed milk',
      price: 1350.0,
      categoryId: categoryMap['Espresso Drinks'],
      sortOrder: 3,
      ingredients: ['Espresso', 'Milk'],
      modifierGroups: [sizeGroup.id, milkGroup.id, syrupGroup.id, extrasGroup.id],
    },
    {
      id: 'drink-cappuccino',
      name: 'Cappuccino',
      description: 'Espresso with steamed milk and foam',
      price: 1350.0,
      categoryId: categoryMap['Espresso Drinks'],
      sortOrder: 4,
      ingredients: ['Espresso', 'Milk'],
      modifierGroups: [sizeGroup.id, milkGroup.id, syrupGroup.id, extrasGroup.id],
    },
    {
      id: 'drink-mocha',
      name: 'Mocha',
      description: 'Espresso with chocolate and steamed milk',
      price: 1550.0,
      categoryId: categoryMap['Espresso Drinks'],
      sortOrder: 5,
      ingredients: ['Espresso', 'Milk', 'Chocolate Syrup'],
      modifierGroups: [sizeGroup.id, milkGroup.id, extrasGroup.id],
    },
    {
      id: 'drink-flat-white',
      name: 'Flat White',
      description: 'Espresso with micro-foam milk',
      price: 1400.0,
      categoryId: categoryMap['Espresso Drinks'],
      sortOrder: 6,
      ingredients: ['Espresso', 'Milk'],
      modifierGroups: [sizeGroup.id, milkGroup.id, syrupGroup.id, extrasGroup.id],
    },
    {
      id: 'drink-iced-latte',
      name: 'Iced Latte',
      description: 'Espresso with cold milk over ice',
      price: 1450.0,
      categoryId: categoryMap['Iced Drinks'],
      sortOrder: 1,
      ingredients: ['Espresso', 'Milk', 'Ice'],
      modifierGroups: [sizeGroup.id, milkGroup.id, syrupGroup.id, extrasGroup.id],
    },
    {
      id: 'drink-iced-americano',
      name: 'Iced Americano',
      description: 'Espresso with cold water over ice',
      price: 1050.0,
      categoryId: categoryMap['Iced Drinks'],
      sortOrder: 2,
      ingredients: ['Espresso', 'Water', 'Ice'],
      modifierGroups: [sizeGroup.id, extrasGroup.id],
    },
    {
      id: 'drink-iced-mocha',
      name: 'Iced Mocha',
      description: 'Espresso with chocolate and cold milk over ice',
      price: 1650.0,
      categoryId: categoryMap['Iced Drinks'],
      sortOrder: 3,
      ingredients: ['Espresso', 'Milk', 'Chocolate Syrup', 'Ice'],
      modifierGroups: [sizeGroup.id, milkGroup.id, extrasGroup.id],
    },
    {
      id: 'drink-cold-brew',
      name: 'Cold Brew',
      description: 'Smooth cold-brewed coffee',
      price: 1250.0,
      categoryId: categoryMap['Iced Drinks'],
      sortOrder: 4,
      ingredients: ['Ice'],
      modifierGroups: [sizeGroup.id, milkGroup.id, syrupGroup.id],
    },
    {
      id: 'drink-chai-latte',
      name: 'Chai Latte',
      description: 'Spiced chai tea with steamed milk',
      price: 1200.0,
      categoryId: categoryMap['Specialty Drinks'],
      sortOrder: 1,
      ingredients: ['Chai Tea', 'Milk'],
      modifierGroups: [sizeGroup.id, milkGroup.id, sugarGroup.id],
    },
    {
      id: 'drink-matcha-latte',
      name: 'Matcha Latte',
      description: 'Japanese green tea with steamed milk',
      price: 1600.0,
      categoryId: categoryMap['Specialty Drinks'],
      sortOrder: 2,
      ingredients: ['Matcha Powder', 'Milk'],
      modifierGroups: [sizeGroup.id, milkGroup.id, sugarGroup.id],
    },
    {
      id: 'drink-hot-chocolate',
      name: 'Hot Chocolate',
      description: 'Rich chocolate with steamed milk',
      price: 1250.0,
      categoryId: categoryMap['Specialty Drinks'],
      sortOrder: 3,
      ingredients: ['Cocoa Powder', 'Milk', 'Chocolate Syrup'],
      modifierGroups: [sizeGroup.id, milkGroup.id, extrasGroup.id],
    },
    {
      id: 'drink-caramel-macchiato',
      name: 'Caramel Macchiato',
      description: 'Espresso with vanilla and caramel',
      price: 1600.0,
      categoryId: categoryMap['Specialty Drinks'],
      sortOrder: 4,
      ingredients: ['Espresso', 'Milk', 'Vanilla Syrup', 'Caramel Syrup'],
      modifierGroups: [sizeGroup.id, milkGroup.id, extrasGroup.id],
    },
    {
      id: 'drink-iced-chai',
      name: 'Iced Chai Latte',
      description: 'Spiced chai tea with cold milk over ice',
      price: 1300.0,
      categoryId: categoryMap['Tea'],
      sortOrder: 1,
      ingredients: ['Chai Tea', 'Milk', 'Ice'],
      modifierGroups: [sizeGroup.id, milkGroup.id, sugarGroup.id],
    },
    {
      id: 'drink-iced-matcha',
      name: 'Iced Matcha Latte',
      description: 'Japanese green tea with cold milk over ice',
      price: 1750.0,
      categoryId: categoryMap['Tea'],
      sortOrder: 2,
      ingredients: ['Matcha Powder', 'Milk', 'Ice'],
      modifierGroups: [sizeGroup.id, milkGroup.id, sugarGroup.id],
    },
  ];

  for (const drink of drinks) {
    const { ingredients: ingredientNames, modifierGroups, ...drinkData } = drink;

    const createdDrink = await prisma.drink.upsert({
      where: { id: drink.id },
      update: { price: drinkData.price },
      create: drinkData,
    });

    // Link ingredients
    for (const ingredientName of ingredientNames) {
      await prisma.drinkIngredient.upsert({
        where: { drinkId_ingredientId: { drinkId: createdDrink.id, ingredientId: ingredientMap[ingredientName] } },
        update: {},
        create: { drinkId: createdDrink.id, ingredientId: ingredientMap[ingredientName] },
      });
    }

    // Link modifier groups
    for (const modifierGroupId of modifierGroups) {
      await prisma.drinkModifierGroup.upsert({
        where: { drinkId_modifierGroupId: { drinkId: createdDrink.id, modifierGroupId } },
        update: {},
        create: { drinkId: createdDrink.id, modifierGroupId },
      });
    }
  }

  console.log('Drinks created:', drinks.length);
  console.log('Seed completed successfully!');
}

main()
  .catch((e) => {
    console.error('Seed error:', e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
