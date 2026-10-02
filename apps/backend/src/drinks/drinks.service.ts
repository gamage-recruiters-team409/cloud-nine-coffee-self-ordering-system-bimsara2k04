import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import { RealtimeGateway } from '../realtime/realtime.gateway';
import { CreateDrinkDto } from './dto/create-drink.dto';
import { UpdateDrinkDto } from './dto/update-drink.dto';

/**
 * Include tree shared by findAll, findOne and both mutations, so a drink is
 * always returned in the same shape the kiosk and admin UIs expect.
 */
const DRINK_INCLUDE = {
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
            orderBy: { sortOrder: 'asc' as const },
          },
        },
      },
    },
  },
};

@Injectable()
export class DrinksService {
  constructor(
    private prisma: PrismaService,
    private realtimeGateway: RealtimeGateway,
  ) {}

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
      // `isAvailable` stays the admin-controlled menu flag so the Hide/Show
      // toggle round-trips. It used to be overwritten with the combined
      // value, which made a drink with an out-of-stock ingredient impossible
      // to switch back on: the stored flag flipped to true while the response
      // still read false, so the button always looked unclickable.
      isAvailable: Boolean(drink.isAvailable),
      // Sellability stays available separately for anyone who needs it.
      isOrderable: isDrinkAvailable,
      modifierGroups,
    };
  }

  async findAll() {
    const drinks = await this.prisma.drink.findMany({
      include: DRINK_INCLUDE,
      orderBy: [{ category: { sortOrder: 'asc' } }, { sortOrder: 'asc' }],
    });

    return drinks.map((d) => this.resolveDrinkAvailability(d));
  }

  async findOne(id: string) {
    const drink = await this.prisma.drink.findUnique({
      where: { id },
      include: DRINK_INCLUDE,
    });

    if (!drink) return null;
    return this.resolveDrinkAvailability(drink);
  }

  /**
   * Creates a new menu item.
   *
   * The category is verified up front so a bad id produces a clear 400 instead
   * of a raw Prisma foreign-key error. When no sort order is given the item is
   * appended to the end of its category rather than jumping to the front.
   */
  async create(dto: CreateDrinkDto) {
    const category = await this.prisma.drinkCategory.findUnique({
      where: { id: dto.categoryId },
      select: { id: true },
    });

    if (!category) {
      throw new BadRequestException(`Unknown category: ${dto.categoryId}`);
    }

    const sortOrder =
      dto.sortOrder ??
      ((
        await this.prisma.drink.aggregate({
          where: { categoryId: dto.categoryId },
          _max: { sortOrder: true },
        })
      )._max.sortOrder ?? -1) +
        1;

    const drink = await this.prisma.drink.create({
      data: {
        name: dto.name.trim(),
        description: dto.description?.trim() || null,
        price: new Prisma.Decimal(dto.price),
        categoryId: dto.categoryId,
        sortOrder,
        isAvailable: dto.isAvailable ?? true,
      },
      include: DRINK_INCLUDE,
    });

    this.realtimeGateway.emitMenuAvailabilityChanged();

    return this.resolveDrinkAvailability(drink);
  }

  /**
   * Updates a menu item. Only the fields actually supplied are written, so a
   * price change cannot accidentally clear the name or description.
   *
   * Price is validated to be finite and non-negative here as well as in the DTO,
   * because a hand-written request could otherwise reach Prisma with NaN.
   */
  async update(id: string, dto: UpdateDrinkDto) {
    const existing = await this.prisma.drink.findUnique({
      where: { id },
      select: { id: true },
    });

    if (!existing) {
      throw new NotFoundException(`Drink not found: ${id}`);
    }

    const data: Record<string, unknown> = {};

    if (dto.name !== undefined) data.name = dto.name.trim();
    if (dto.description !== undefined) data.description = dto.description.trim() || null;
    if (dto.sortOrder !== undefined) data.sortOrder = dto.sortOrder;
    if (dto.isAvailable !== undefined) data.isAvailable = dto.isAvailable;

    if (dto.price !== undefined) {
      if (!Number.isFinite(dto.price) || dto.price < 0) {
        throw new BadRequestException('Price must be a non-negative number');
      }
      data.price = new Prisma.Decimal(dto.price);
    }

    const drink = await this.prisma.drink.update({
      where: { id },
      data,
      include: DRINK_INCLUDE,
    });

    // Tell any kiosk with the menu open that prices and availability changed.
    this.realtimeGateway.emitMenuAvailabilityChanged();

    return this.resolveDrinkAvailability(drink);
  }
}
