import { Injectable } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';

@Injectable()
export class AvailabilityService {
  constructor(private prisma: PrismaService) {}

  /**
   * Determine if a drink is orderable based on:
   * 1. Drink's own isAvailable flag
   * 2. All required ingredients must be available
   */
  async isDrinkAvailable(drinkId: string): Promise<boolean> {
    const drink = await this.prisma.drink.findUnique({
      where: { id: drinkId },
      include: {
        ingredients: {
          include: {
            ingredient: true,
          },
        },
      },
    });

    if (!drink || !drink.isAvailable) {
      return false;
    }

    // Check if all drink ingredients are available
    const allIngredientsAvailable = drink.ingredients.every(
      (di) => di.ingredient.isAvailable,
    );

    return allIngredientsAvailable;
  }

  /**
   * Determine if a modifier option is selectable based on:
   * 1. Option's own isAvailable flag
   * 2. All required ingredients for that option must be available
   */
  async isModifierOptionAvailable(optionId: string): Promise<boolean> {
    const option = await this.prisma.modifierOption.findUnique({
      where: { id: optionId },
      include: {
        ingredients: {
          include: {
            ingredient: true,
          },
        },
      },
    });

    if (!option || !option.isAvailable) {
      return false;
    }

    // If no ingredients are linked, option is available
    if (option.ingredients.length === 0) {
      return true;
    }

    // All linked ingredients must be available
    const allIngredientsAvailable = option.ingredients.every(
      (oi) => oi.ingredient.isAvailable,
    );

    return allIngredientsAvailable;
  }

  /**
   * Get all available drinks with resolved availability
   */
  async getAvailableDrinks() {
    const drinks = await this.prisma.drink.findMany({
      include: {
        category: true,
        ingredients: {
          include: {
            ingredient: true,
          },
        },
      },
    });

    const availabilityResults = await Promise.all(
      drinks.map(async (drink) => ({
        ...drink,
        isOrderable: await this.isDrinkAvailable(drink.id),
      })),
    );

    return availabilityResults.filter((d) => d.isOrderable);
  }

  /**
   * Get availability status for all modifier options in a group
   */
  async getModifierGroupAvailability(groupId: string) {
    const options = await this.prisma.modifierOption.findMany({
      where: { groupId },
      include: {
        ingredients: {
          include: {
            ingredient: true,
          },
        },
      },
      orderBy: { sortOrder: 'asc' },
    });

    return Promise.all(
      options.map(async (option) => ({
        ...option,
        isSelectable: await this.isModifierOptionAvailable(option.id),
      })),
    );
  }

  /**
   * Validate that all selected modifiers for a drink are available
   */
  async validateModifierSelection(
    drinkId: string,
    selectedOptionIds: string[],
  ): Promise<{ valid: boolean; unavailableOptions: string[] }> {
    const unavailableOptions: string[] = [];

    for (const optionId of selectedOptionIds) {
      const isAvailable = await this.isModifierOptionAvailable(optionId);
      if (!isAvailable) {
        unavailableOptions.push(optionId);
      }
    }

    return {
      valid: unavailableOptions.length === 0,
      unavailableOptions,
    };
  }
}
