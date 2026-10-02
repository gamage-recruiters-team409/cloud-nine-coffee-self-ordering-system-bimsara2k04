import { Injectable } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';

@Injectable()
export class CategoriesService {
  constructor(private prisma: PrismaService) {}

  async findAll() {
    const categories = await this.prisma.drinkCategory.findMany({
      include: {
        drinks: {
          include: {
            ingredients: {
              include: {
                ingredient: true,
              },
            },
          },
          orderBy: { sortOrder: 'asc' },
        },
      },
      orderBy: { sortOrder: 'asc' },
    });

    return categories.map((cat) => ({
      ...cat,
      drinks: cat.drinks.map((drink) => ({
        ...drink,
        // Menu visibility only — see DrinksService.resolveDrinkAvailability
        // for why this must not fold in ingredient stock.
        isAvailable: Boolean(drink.isAvailable),
        isOrderable:
          Boolean(drink.isAvailable) &&
          (!drink.ingredients ||
            drink.ingredients.every((di) => di.ingredient?.isAvailable !== false)),
      })),
    }));
  }
}
