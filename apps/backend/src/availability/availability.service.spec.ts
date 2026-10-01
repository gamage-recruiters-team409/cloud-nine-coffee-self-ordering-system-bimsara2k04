import { Test, TestingModule } from '@nestjs/testing';
import { AvailabilityService } from './availability.service';
import { PrismaService } from '../prisma/prisma.service';

describe('AvailabilityService', () => {
  let service: AvailabilityService;
  let prisma: PrismaService;

  const mockPrisma = {
    drink: {
      findUnique: jest.fn(),
    },
    modifierOption: {
      findUnique: jest.fn(),
    },
  };

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [AvailabilityService, { provide: PrismaService, useValue: mockPrisma }],
    }).compile();

    service = module.get<AvailabilityService>(AvailabilityService);
    prisma = module.get<PrismaService>(PrismaService);
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  describe('isDrinkAvailable', () => {
    it('should return false if drink is not available', async () => {
      mockPrisma.drink.findUnique.mockResolvedValue({
        id: 'drink-1',
        isAvailable: false,
        ingredients: [],
      });

      const result = await service.isDrinkAvailable('drink-1');
      expect(result).toBe(false);
    });

    it('should return false if any ingredient is unavailable', async () => {
      mockPrisma.drink.findUnique.mockResolvedValue({
        id: 'drink-1',
        isAvailable: true,
        ingredients: [
          { ingredient: { isAvailable: true } },
          { ingredient: { isAvailable: false } },
        ],
      });

      const result = await service.isDrinkAvailable('drink-1');
      expect(result).toBe(false);
    });

    it('should return true if drink and all ingredients are available', async () => {
      mockPrisma.drink.findUnique.mockResolvedValue({
        id: 'drink-1',
        isAvailable: true,
        ingredients: [
          { ingredient: { isAvailable: true } },
          { ingredient: { isAvailable: true } },
        ],
      });

      const result = await service.isDrinkAvailable('drink-1');
      expect(result).toBe(true);
    });
  });

  describe('isModifierOptionAvailable', () => {
    it('should return false if option is not available', async () => {
      mockPrisma.modifierOption.findUnique.mockResolvedValue({
        id: 'opt-1',
        isAvailable: false,
        ingredients: [],
      });

      const result = await service.isModifierOptionAvailable('opt-1');
      expect(result).toBe(false);
    });

    it('should return true if option is available and has no ingredients', async () => {
      mockPrisma.modifierOption.findUnique.mockResolvedValue({
        id: 'opt-1',
        isAvailable: true,
        ingredients: [],
      });

      const result = await service.isModifierOptionAvailable('opt-1');
      expect(result).toBe(true);
    });

    it('should return false if any linked ingredient is unavailable', async () => {
      mockPrisma.modifierOption.findUnique.mockResolvedValue({
        id: 'opt-1',
        isAvailable: true,
        ingredients: [
          { ingredient: { isAvailable: true } },
          { ingredient: { isAvailable: false } },
        ],
      });

      const result = await service.isModifierOptionAvailable('opt-1');
      expect(result).toBe(false);
    });

    it('should return true if option and all linked ingredients are available', async () => {
      mockPrisma.modifierOption.findUnique.mockResolvedValue({
        id: 'opt-1',
        isAvailable: true,
        ingredients: [{ ingredient: { isAvailable: true } }],
      });

      const result = await service.isModifierOptionAvailable('opt-1');
      expect(result).toBe(true);
    });
  });
});
