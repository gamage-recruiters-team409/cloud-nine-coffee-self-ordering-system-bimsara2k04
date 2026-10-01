import { Test, TestingModule } from '@nestjs/testing';
import { OrdersService } from './orders.service';
import { PrismaService } from '../prisma/prisma.service';
import { AvailabilityService } from '../availability/availability.service';
import { RealtimeGateway } from '../realtime/realtime.gateway';
import { BadRequestException, NotFoundException } from '@nestjs/common';

describe('OrdersService', () => {
  let service: OrdersService;
  let prisma: PrismaService;
  let availability: AvailabilityService;
  let realtime: RealtimeGateway;

  const mockPrisma = {
    order: {
      create: jest.fn(),
      findMany: jest.fn(),
      findUnique: jest.fn(),
      update: jest.fn(),
    },
    drink: {
      findUnique: jest.fn(),
    },
    modifierOption: {
      findMany: jest.fn(),
    },
    orderTrackingToken: {
      findUnique: jest.fn(),
      create: jest.fn(),
    },
  };

  const mockAvailability = {
    isDrinkAvailable: jest.fn(),
    validateModifierSelection: jest.fn(),
  };

  const mockRealtime = {
    emitOrderCreated: jest.fn(),
    emitOrderStatusChanged: jest.fn(),
  };

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        OrdersService,
        { provide: PrismaService, useValue: mockPrisma },
        { provide: AvailabilityService, useValue: mockAvailability },
        { provide: RealtimeGateway, useValue: mockRealtime },
      ],
    }).compile();

    service = module.get<OrdersService>(OrdersService);
    prisma = module.get<PrismaService>(PrismaService);
    availability = module.get<AvailabilityService>(AvailabilityService);
    realtime = module.get<RealtimeGateway>(RealtimeGateway);
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  describe('create', () => {
    it('should reject order with unavailable drink', async () => {
      mockAvailability.isDrinkAvailable.mockResolvedValue(false);

      const dto = {
        items: [{ drinkId: 'drink-1', quantity: 1 }],
        diningOption: 'DINE_IN' as const,
      };

      await expect(service.create(dto)).rejects.toThrow(BadRequestException);
      expect(mockAvailability.isDrinkAvailable).toHaveBeenCalledWith('drink-1');
    });

    it('should reject order with unavailable modifiers', async () => {
      mockAvailability.isDrinkAvailable.mockResolvedValue(true);
      mockAvailability.validateModifierSelection.mockResolvedValue({
        valid: false,
        unavailableOptions: ['mod-1'],
      });

      const dto = {
        items: [{ drinkId: 'drink-1', quantity: 1, modifierOptionIds: ['mod-1'] }],
        diningOption: 'DINE_IN' as const,
      };

      await expect(service.create(dto)).rejects.toThrow(BadRequestException);
    });

    it('should create a PENDING order without emitting to barista or generating token', async () => {
      mockAvailability.isDrinkAvailable.mockResolvedValue(true);
      mockPrisma.drink.findUnique.mockResolvedValue({
        id: 'drink-espresso',
        name: 'Espresso',
        price: 3.0,
      });
      mockPrisma.modifierOption.findMany.mockResolvedValue([]);
      mockPrisma.order.create.mockResolvedValue({
        id: 'order-1',
        orderNumber: 1,
        status: 'RECEIVED',
        paymentStatus: 'PENDING',
        total: 3.0,
        items: [],
      });

      const dto = {
        items: [{ drinkId: 'drink-espresso', quantity: 1 }],
        diningOption: 'DINE_IN' as const,
      };

      const result = await service.create(dto);

      expect(result.id).toBe('order-1');
      expect(result.paymentStatus).toBe('PENDING');
      // A tracking token IS minted up front so the kiosk can show the QR on
      // return from PayHere without waiting for the notify callback.
      expect(result.trackingToken).toBeTruthy();
      expect(mockPrisma.orderTrackingToken.create).toHaveBeenCalled();
      // Barista must NOT be notified until payment confirmed
      expect(mockRealtime.emitOrderCreated).not.toHaveBeenCalled();
      // And the order must NOT be marked paid by the browser
      expect(mockPrisma.order.update).not.toHaveBeenCalled();
    });

    it('reuses an existing tracking token rather than minting a second one', async () => {
      mockPrisma.order.create.mockResolvedValue({
        id: 'order-1',
        orderNumber: 1,
        status: 'RECEIVED',
        paymentStatus: 'PENDING',
        total: 3.0,
        items: [],
      });
      mockPrisma.orderTrackingToken.findUnique.mockResolvedValue({
        tokenHash: 'existing-token',
      });

      const result = await service.create({
        items: [{ drinkId: 'drink-espresso', quantity: 1 }],
        diningOption: 'DINE_IN',
      });

      expect(result.trackingToken).toBe('existing-token');
      expect(mockPrisma.orderTrackingToken.create).not.toHaveBeenCalled();
    });
  });

  describe('markOrderPaid', () => {
    it('should reject if order not found', async () => {
      mockPrisma.order.findUnique.mockResolvedValue(null);

      await expect(service.markOrderPaid('order-x')).rejects.toThrow(NotFoundException);
    });

    it('should be idempotent and not re-notify the barista on a duplicate callback', async () => {
      mockPrisma.order.findUnique.mockResolvedValue({
        id: 'order-1',
        paymentStatus: 'PAID',
        items: [],
        trackingToken: { tokenHash: 'existing-token' },
      });

      const result = await service.markOrderPaid('order-1');

      expect(result.trackingToken).toBe('existing-token');
      expect(result.alreadyProcessed).toBe(true);
      expect(mockPrisma.order.update).not.toHaveBeenCalled();
      expect(mockRealtime.emitOrderCreated).not.toHaveBeenCalled();
    });

    it('should mark order PAID, create tracking token, and notify barista', async () => {
      mockPrisma.order.findUnique.mockResolvedValue({
        id: 'order-1',
        paymentStatus: 'PENDING',
        items: [],
        trackingToken: null,
      });
      mockPrisma.order.update.mockResolvedValue({
        id: 'order-1',
        orderNumber: 1,
        status: 'RECEIVED',
        paymentStatus: 'PAID',
        total: 3.0,
        items: [],
        statusHistory: [],
      });
      mockPrisma.orderTrackingToken.findUnique.mockResolvedValue(null);
      mockPrisma.orderTrackingToken.create.mockResolvedValue({});

      const result = await service.markOrderPaid('order-1');

      expect(result.paymentStatus).toBe('PAID');
      expect(result.trackingToken).toBeDefined();
      expect(result.alreadyProcessed).toBe(false);
      expect(mockPrisma.orderTrackingToken.create).toHaveBeenCalled();
      expect(mockRealtime.emitOrderCreated).toHaveBeenCalled();
    });

    it('reuses the token minted at creation instead of issuing a second one', async () => {
      mockPrisma.order.findUnique.mockResolvedValue({
        id: 'order-1',
        orderNumber: 1,
        status: 'RECEIVED',
        paymentStatus: 'PENDING',
        total: 3.0,
        items: [],
        statusHistory: [],
        trackingToken: { tokenHash: 'token-from-create' },
      });
      mockPrisma.orderTrackingToken.findUnique.mockResolvedValue({
        tokenHash: 'token-from-create',
      });

      const result = await service.markOrderPaid('order-1');

      expect(result.trackingToken).toBe('token-from-create');
      expect(mockPrisma.orderTrackingToken.create).not.toHaveBeenCalled();
      // Activation still only happens here, never in create()
      expect(mockRealtime.emitOrderCreated).toHaveBeenCalled();
    });
  });

  describe('markOrderFailed', () => {
    it('should mark a pending order as FAILED without creating a token or notifying barista', async () => {
      mockPrisma.order.findUnique.mockResolvedValue({
        id: 'order-1',
        orderNumber: 1,
        paymentStatus: 'PENDING',
      });
      mockPrisma.order.update.mockResolvedValue({});

      await service.markOrderFailed('order-1');

      expect(mockPrisma.order.update).toHaveBeenCalledWith(
        expect.objectContaining({
          where: { id: 'order-1' },
          data: { paymentStatus: 'FAILED' },
        }),
      );
      expect(mockPrisma.orderTrackingToken.create).not.toHaveBeenCalled();
      expect(mockRealtime.emitOrderCreated).not.toHaveBeenCalled();
    });

    it('should not downgrade an already paid order', async () => {
      mockPrisma.order.findUnique.mockResolvedValue({
        id: 'order-1',
        orderNumber: 1,
        paymentStatus: 'PAID',
      });

      await service.markOrderFailed('order-1');

      expect(mockPrisma.order.update).not.toHaveBeenCalled();
    });
  });

  describe('updateStatus', () => {
    it('should reject invalid status transition', async () => {
      mockPrisma.order.findUnique.mockResolvedValue({
        id: 'order-1',
        status: 'RECEIVED',
        paymentStatus: 'PAID',
        items: [],
        statusHistory: [],
      });

      await expect(service.updateStatus('order-1', 'COLLECTED' as any)).rejects.toThrow(
        BadRequestException,
      );
    });

    it('should reject status update on unpaid order', async () => {
      mockPrisma.order.findUnique.mockResolvedValue({
        id: 'order-1',
        status: 'RECEIVED',
        paymentStatus: 'PENDING',
        items: [],
        statusHistory: [],
      });

      await expect(service.updateStatus('order-1', 'PREPARING' as any)).rejects.toThrow(
        BadRequestException,
      );
    });

    it('should allow valid status transition on paid order', async () => {
      mockPrisma.order.findUnique.mockResolvedValue({
        id: 'order-1',
        status: 'RECEIVED',
        paymentStatus: 'PAID',
        items: [],
        statusHistory: [],
      });
      mockPrisma.order.update.mockResolvedValue({
        id: 'order-1',
        status: 'PREPARING',
        paymentStatus: 'PAID',
        items: [],
        statusHistory: [],
      });

      const result = await service.updateStatus('order-1', 'PREPARING' as any);

      expect(result.status).toBe('PREPARING');
      expect(mockRealtime.emitOrderStatusChanged).toHaveBeenCalled();
    });
  });
});

