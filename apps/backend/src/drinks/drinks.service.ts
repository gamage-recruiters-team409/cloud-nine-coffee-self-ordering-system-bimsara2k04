import { Injectable } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';

@Injectable()
export class DrinksService {
  constructor(private prisma: PrismaService) {}

  private resolveDrinkAvailability(drink: any) {
    const isDrinkAvailable =
      Boolean(drink.isAvailable) &&
      (!drink.ingredients ||
        drink.ingredients.every((di: any) => di.ingredient?.isAvailable !== false));

    const modifierGroups = (drink.modifierGroups || []).map((mg: any) => {
      const options = (mg.modifierGroup?.options || []).map((opt: any) => {
        const isOptAvailable =
          Boolean(opt.isAvailable) &&
          (!opt.ingredients ||
            opt.ingredients.length === 0 ||
            opt.ingredients.every((oi: any) => oi.ingredient?.isAvailable !== false));

        return {
          ...opt,
          isAvailable: isOptAvailable,
        };
      });

      return {
        ...mg,
        modifierGroup: {
          ...mg.modifierGroup,
          options,
        },
      };
    });

    return {
      ...drink,
      isAvailable: isDrinkAvailable,
      modifierGroups,
    };
  }

  async findAll() {
    const drinks = await this.prisma.drink.findMany({
      include: {
        category: true,
        ingredients: {
          include: {
            ingredient: true,
          },
        },
        modifierGroups: {
          include: {
            modifierGroup: {
              include: {
                options: {
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
            },
          },
        },
      },
      orderBy: [{ category: { sortOrder: 'asc' } }, { sortOrder: 'asc' }],
    });

    return drinks.map((d) => this.resolveDrinkAvailability(d));
  }

  async findOne(id: string) {
    const drink = await this.prisma.drink.findUnique({
      where: { id },
      include: {
        category: true,
        ingredients: {
          include: {
            ingredient: true,
          },
        },
        modifierGroups: {
          include: {
            modifierGroup: {
              include: {
                options: {
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
            },
          },
        },
      },
    });

    if (!drink) return null;
    return this.resolveDrinkAvailability(drink);
  }
}
