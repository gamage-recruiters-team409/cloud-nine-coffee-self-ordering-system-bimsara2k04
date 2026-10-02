import { Test, TestingModule } from '@nestjs/testing';
import { BadRequestException, NotFoundException } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { DrinksService } from './drinks.service';
import { PrismaService } from '../prisma/prisma.service';
import { RealtimeGateway } from '../realtime/realtime.gateway';

describe('DrinksService', () => {
  let service: DrinksService;

  const drinkFixture = {
    id: 'drink-latte',
    name: 'Latte',
    description: 'Espresso with steamed milk',
    price: new Prisma.Decimal('450.00'),
    isAvailable: true,
    sortOrder: 1,
    categoryId: 'cat-1',
    category: { id: 'cat-1', name: 'Espresso Drinks', sortOrder: 0 },
    ingredients: [],
    modifierGroups: [],
  };

  let mockPrisma: {
    drink: {
      findMany: jest.Mock;
      findUnique: jest.Mock;
      create: jest.Mock;
      update: jest.Mock;
      aggregate: jest.Mock;
    };
    drinkCategory: { findUnique: jest.Mock };
  };

  let mockGateway: { emitMenuAvailabilityChanged: jest.Mock };

  beforeEach(async () => {
    mockPrisma = {
      drink: {
        findMany: jest.fn(),
        findUnique: jest.fn(),
        create: jest.fn(),
        update: jest.fn(),
        aggregate: jest.fn(),
      },
      drinkCategory: { findUnique: jest.fn() },
    };

    mockGateway = { emitMenuAvailabilityChanged: jest.fn() };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        DrinksService,
        { provide: PrismaService, useValue: mockPrisma },
        { provide: RealtimeGateway, useValue: mockGateway },
      ],
    }).compile();

    service = module.get<DrinksService>(DrinksService);
  });

  describe('update', () => {
    it('updates only the price and leaves other fields untouched', async () => {
      mockPrisma.drink.findUnique.mockResolvedValue({ id: 'drink-latte' });
      mockPrisma.drink.update.mockResolvedValue(drinkFixture);

      const result = await service.update('drink-latte', { price: 520 });

      const data = mockPrisma.drink.update.mock.calls[0][0].data;
      expect(Object.keys(data)).toEqual(['price']);
      expect(data.price.toString()).toBe('520');
      expect(Number(data.price)).toBe(520);

      // Prisma Decimal normalises trailing zeros, so compare numerically.
      expect(Number(result.price)).toBe(450);
      expect(mockGateway.emitMenuAvailabilityChanged).toHaveBeenCalledTimes(1);
    });

    it('converts the price to a Decimal so it is stored exactly', async () => {
      mockPrisma.drink.findUnique.mockResolvedValue({ id: 'drink-latte' });
      mockPrisma.drink.update.mockResolvedValue(drinkFixture);

      await service.update('drink-latte', { price: 499.5 });

      const { price } = mockPrisma.drink.update.mock.calls[0][0].data;
      expect(price).toBeInstanceOf(Prisma.Decimal);
      expect(price.toString()).toBe('499.5');
    });

    it('updates name and description when supplied', async () => {
      mockPrisma.drink.findUnique.mockResolvedValue({ id: 'drink-latte' });
      mockPrisma.drink.update.mockResolvedValue(drinkFixture);

      await service.update('drink-latte', {
        name: '  Iced Latte  ',
        description: '   ',
      });

      const data = mockPrisma.drink.update.mock.calls[0][0].data;
      expect(data.name).toBe('Iced Latte');
      // Blank description is normalised to null rather than stored as ''.
      expect(data.description).toBeNull();
    });

    it('toggles availability', async () => {
      mockPrisma.drink.findUnique.mockResolvedValue({ id: 'drink-latte' });
      mockPrisma.drink.update.mockResolvedValue({ ...drinkFixture, isAvailable: false });

      const result = await service.update('drink-latte', { isAvailable: false });

      expect(mockPrisma.drink.update.mock.calls[0][0].data.isAvailable).toBe(false);
      expect(result.isAvailable).toBe(false);
    });

    it('throws NotFound when the drink does not exist', async () => {
      mockPrisma.drink.findUnique.mockResolvedValue(null);

      await expect(service.update('drink-ghost', { price: 100 })).rejects.toThrow(
        NotFoundException,
      );
      expect(mockPrisma.drink.update).not.toHaveBeenCalled();
    });

    it('rejects a negative price before touching the database', async () => {
      mockPrisma.drink.findUnique.mockResolvedValue({ id: 'drink-latte' });

      await expect(service.update('drink-latte', { price: -5 })).rejects.toThrow(
        BadRequestException,
      );
      expect(mockPrisma.drink.update).not.toHaveBeenCalled();
    });

    it('rejects a non-finite price', async () => {
      mockPrisma.drink.findUnique.mockResolvedValue({ id: 'drink-latte' });

      await expect(
        service.update('drink-latte', { price: Number.NaN }),
      ).rejects.toThrow(BadRequestException);
      expect(mockPrisma.drink.update).not.toHaveBeenCalled();
    });
  });

  describe('create', () => {
    it('creates a drink and defaults it to available', async () => {
      mockPrisma.drinkCategory.findUnique.mockResolvedValue({ id: 'cat-1' });
      mockPrisma.drink.aggregate.mockResolvedValue({ _max: { sortOrder: 4 } });
      mockPrisma.drink.create.mockResolvedValue(drinkFixture);

      await service.create({
        name: '  Flat White ',
        description: '  Double shot  ',
        price: 480,
        categoryId: 'cat-1',
      });

      const data = mockPrisma.drink.create.mock.calls[0][0].data;
      expect(data.name).toBe('Flat White');
      expect(data.description).toBe('Double shot');
      expect(data.isAvailable).toBe(true);
      // Appended after the highest existing sortOrder in that category.
      expect(data.sortOrder).toBe(5);
      expect(Number(data.price)).toBe(480);
    });

    it('uses the first position when the category is empty', async () => {
      mockPrisma.drinkCategory.findUnique.mockResolvedValue({ id: 'cat-1' });
      mockPrisma.drink.aggregate.mockResolvedValue({ _max: { sortOrder: null } });
      mockPrisma.drink.create.mockResolvedValue(drinkFixture);

      await service.create({ name: 'First Item', price: 100, categoryId: 'cat-1' });

      expect(mockPrisma.drink.create.mock.calls[0][0].data.sortOrder).toBe(0);
    });

    it('honours an explicit sortOrder', async () => {
      mockPrisma.drinkCategory.findUnique.mockResolvedValue({ id: 'cat-1' });
      mockPrisma.drink.create.mockResolvedValue(drinkFixture);

      await service.create({ name: 'Pinned', price: 100, categoryId: 'cat-1', sortOrder: 0 });

      expect(mockPrisma.drink.create.mock.calls[0][0].data.sortOrder).toBe(0);
      expect(mockPrisma.drink.aggregate).not.toHaveBeenCalled();
    });

    it('normalises a missing description to null', async () => {
      mockPrisma.drinkCategory.findUnique.mockResolvedValue({ id: 'cat-1' });
      mockPrisma.drink.aggregate.mockResolvedValue({ _max: { sortOrder: 0 } });
      mockPrisma.drink.create.mockResolvedValue(drinkFixture);

      await service.create({ name: 'No Desc', price: 100, categoryId: 'cat-1' });

      expect(mockPrisma.drink.create.mock.calls[0][0].data.description).toBeNull();
    });

    it('rejects an unknown category', async () => {
      mockPrisma.drinkCategory.findUnique.mockResolvedValue(null);

      await expect(
        service.create({ name: 'Orphan', price: 100, categoryId: 'nope' }),
      ).rejects.toThrow(BadRequestException);
      expect(mockPrisma.drink.create).not.toHaveBeenCalled();
    });

    it('broadcasts so open kiosks refresh', async () => {
      mockPrisma.drinkCategory.findUnique.mockResolvedValue({ id: 'cat-1' });
      mockPrisma.drink.aggregate.mockResolvedValue({ _max: { sortOrder: 0 } });
      mockPrisma.drink.create.mockResolvedValue(drinkFixture);

      await service.create({ name: 'Broadcast', price: 100, categoryId: 'cat-1' });

      expect(mockGateway.emitMenuAvailabilityChanged).toHaveBeenCalledTimes(1);
    });
  });

  describe('availability derivation', () => {
    it('reports a drink with an out-of-stock ingredient as not orderable', async () => {
      mockPrisma.drink.findMany.mockResolvedValue([
        {
          ...drinkFixture,
          ingredients: [{ ingredient: { id: 'i1', isAvailable: false } }],
        },
      ]);

      const [drink] = await service.findAll();

      // Ingredient stock is sellability, not menu visibility, so it must not
      // overwrite the admin-controlled flag.
      expect(drink.isOrderable).toBe(false);
      expect(drink.isAvailable).toBe(true);
    });

    it('round-trips the Hide/Show toggle for a drink with an out-of-stock ingredient', async () => {
      // Regression: the toggle used to be unclickable for these drinks. The
      // stored flag flipped to true while the response still reported the
      // combined value, so the button stayed on "Show" forever.
      mockPrisma.drink.findUnique.mockResolvedValue({ id: drinkFixture.id });
      mockPrisma.drink.update.mockResolvedValue({
        ...drinkFixture,
        isAvailable: true,
        ingredients: [{ ingredient: { id: 'i1', isAvailable: false } }],
      });

      const updated = await service.update(drinkFixture.id, { isAvailable: true });

      expect(mockPrisma.drink.update).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({ isAvailable: true }),
        }),
      );
      // The admin sees "available", so the control flips to Hide.
      expect(updated.isAvailable).toBe(true);
      expect(updated.isOrderable).toBe(false);
    });

    it('reports a drink hidden by the admin as unavailable and not orderable', async () => {
      mockPrisma.drink.findMany.mockResolvedValue([
        {
          ...drinkFixture,
          isAvailable: false,
          ingredients: [{ ingredient: { id: 'i1', isAvailable: true } }],
        },
      ]);

      const [drink] = await service.findAll();

      expect(drink.isAvailable).toBe(false);
      expect(drink.isOrderable).toBe(false);
    });

    it('keeps a drink available when all ingredients are in stock', async () => {
      mockPrisma.drink.findMany.mockResolvedValue([
        {
          ...drinkFixture,
          ingredients: [{ ingredient: { id: 'i1', isAvailable: true } }],
        },
      ]);

      const [drink] = await service.findAll();

      expect(drink.isAvailable).toBe(true);
    });

    it('returns null for a missing drink rather than throwing', async () => {
      mockPrisma.drink.findUnique.mockResolvedValue(null);

      await expect(service.findOne('nope')).resolves.toBeNull();
    });
  });
});