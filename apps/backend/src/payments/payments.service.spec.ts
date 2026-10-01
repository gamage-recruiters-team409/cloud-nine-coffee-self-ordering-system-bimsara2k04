import { Test, TestingModule } from '@nestjs/testing';
import {
  BadRequestException,
  ServiceUnavailableException,
  UnauthorizedException,
} from '@nestjs/common';
import { PaymentsService } from './payments.service';
import { PrismaService } from '../prisma/prisma.service';
import { OrdersService } from '../orders/orders.service';
import { generateNotifyHash } from './payhere.util';

describe('PaymentsService', () => {
  let service: PaymentsService;
  let markOrderPaid: jest.Mock;
  let markOrderFailed: jest.Mock;
  let mockOrders: {
    markOrderPaid: jest.Mock;
    markOrderFailed: jest.Mock;
    issueTrackingToken: jest.Mock;
  };

  const MERCHANT_ID = '1234567';
  const SECRET = 'TEST_SECRET_KEY';

  const mockPrisma = {
    order: {
      findUnique: jest.fn(),
      findFirst: jest.fn(),
      update: jest.fn(),
    },
    orderTrackingToken: {
      findUnique: jest.fn(),
      create: jest.fn(),
    },
  };

  const buildNotify = (overrides: Record<string, string> = {}) => {
    const base = {
      merchant_id: MERCHANT_ID,
      order_id: 'order-1',
      payhere_amount: '100.00',
      payhere_currency: 'LKR',
      status_code: '2',
      ...overrides,
    };

    return {
      ...base,
      md5sig:
        overrides.md5sig ??
        generateNotifyHash(
          base.merchant_id,
          base.order_id,
          base.payhere_amount,
          base.payhere_currency,
          base.status_code,
          SECRET,
        ),
    };
  };

  beforeEach(async () => {
    markOrderPaid = jest.fn().mockResolvedValue({});
    markOrderFailed = jest.fn().mockResolvedValue(undefined);
    mockOrders = {
      markOrderPaid,
      markOrderFailed,
      issueTrackingToken: jest.fn().mockResolvedValue('minted-token'),
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        PaymentsService,
        { provide: PrismaService, useValue: mockPrisma },
        { provide: OrdersService, useValue: mockOrders },
      ],
    }).compile();

    service = module.get<PaymentsService>(PaymentsService);

    process.env.PAYHERE_MERCHANT_ID = MERCHANT_ID;
    process.env.PAYHERE_MERCHANT_SECRET = SECRET;
    process.env.PAYHERE_SANDBOX = 'true';
    process.env.BACKEND_URL = 'https://tunnel-example.trycloudflare.com';

    // Default: order exists with a matching total of 100.00
    mockPrisma.order.findUnique.mockResolvedValue({
      id: 'order-1',
      orderNumber: 7,
      total: 100,
    });
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  describe('handleNotify', () => {
    it('activates the order on a verified success callback (status_code 2)', async () => {
      await service.handleNotify(buildNotify());

      expect(markOrderPaid).toHaveBeenCalledWith('order-1');
      expect(markOrderFailed).not.toHaveBeenCalled();
    });

    it('rejects a callback with an invalid md5sig', async () => {
      await expect(
        service.handleNotify(buildNotify({ md5sig: 'DEADBEEFDEADBEEFDEADBEEFDEADBEEF' })),
      ).rejects.toThrow(UnauthorizedException);

      expect(markOrderPaid).not.toHaveBeenCalled();
      expect(markOrderFailed).not.toHaveBeenCalled();
    });

    it('rejects a validly-signed callback whose amount does not match the order total', async () => {
      mockPrisma.order.findUnique.mockResolvedValue({
        id: 'order-1',
        orderNumber: 7,
        total: 100,
      });

      await expect(
        service.handleNotify(buildNotify({ payhere_amount: '1.00' })),
      ).rejects.toThrow(BadRequestException);

      expect(markOrderPaid).not.toHaveBeenCalled();
    });

    it('activates the order when the signed amount matches the order total', async () => {
      mockPrisma.order.findUnique.mockResolvedValue({
        id: 'order-1',
        orderNumber: 7,
        total: 100,
      });

      await service.handleNotify(buildNotify());

      expect(markOrderPaid).toHaveBeenCalledWith('order-1');
    });

    it('rejects a callback from an unknown merchant', async () => {
      const payload = buildNotify({ merchant_id: '9999999' });

      await expect(service.handleNotify(payload)).rejects.toThrow(UnauthorizedException);
    });

    it('rejects a payload missing required fields', async () => {
      await expect(
        service.handleNotify({ merchant_id: MERCHANT_ID, order_id: 'order-1' }),
      ).rejects.toThrow(BadRequestException);
    });

    it('leaves the order PENDING for status_code 0', async () => {
      await service.handleNotify(buildNotify({ status_code: '0' }));

      expect(markOrderPaid).not.toHaveBeenCalled();
      expect(markOrderFailed).not.toHaveBeenCalled();
    });

    it.each(['-1', '-2', '-3'])(
      'marks the order FAILED for status_code %s',
      async (statusCode) => {
        await service.handleNotify(buildNotify({ status_code: statusCode }));

        expect(markOrderFailed).toHaveBeenCalledWith('order-1');
        expect(markOrderPaid).not.toHaveBeenCalled();
      },
    );
  });

  describe('initPayment', () => {
    it('fails fast when merchant credentials are missing', async () => {
      process.env.PAYHERE_MERCHANT_ID = '';

      await expect(service.initPayment('order-1', {})).rejects.toThrow(
        ServiceUnavailableException,
      );
    });

    it('returns a signed sandbox checkout payload and never exposes the secret', async () => {
      mockPrisma.order.findUnique.mockResolvedValue({
        id: 'order-1',
        orderNumber: 7,
        total: 100,
        paymentStatus: 'PENDING',
        customerName: 'Nimal Perera',
        items: [{ quantity: 2, drinkName: 'Cappuccino' }],
      });

      mockPrisma.orderTrackingToken.findUnique.mockResolvedValue({
        tokenHash: 'token-abc',
      });

      const result = await service.initPayment('order-1', {});

      expect(result.action).toBe('https://sandbox.payhere.lk/pay/checkout');
      expect(result.method).toBe('POST');
      expect(result.fields.merchant_id).toBe(MERCHANT_ID);
      expect(result.fields.order_id).toBe('order-1');
      expect(result.fields.amount).toBe('100.00');
      expect(result.fields.currency).toBe('LKR');
      expect(result.fields.items).toBe('2 x Cappuccino');
      expect(result.fields.hash).toMatch(/^[0-9A-F]{32}$/);
      expect(result.fields.notify_url).toContain('/payments/payhere/notify');
      expect(JSON.stringify(result)).not.toContain(SECRET);
    });

    it('carries the tracking token in the return_url path so the QR survives the redirect', async () => {
      // PayHere can drop the query string, and the kiosk may be on a different
      // origin than PUBLIC_URL, which breaks sessionStorage. The path survives
      // both, so the return page can always render the QR.
      mockPrisma.order.findUnique.mockResolvedValue({
        id: 'order-1',
        orderNumber: 7,
        total: 100,
        paymentStatus: 'PENDING',
        items: [],
      });
      mockPrisma.orderTrackingToken.findUnique.mockResolvedValue({
        tokenHash: 'token-abc',
      });

      const result = await service.initPayment('order-1', {});

      // Asserted structurally so it holds regardless of PUBLIC_URL in .env.
      expect(result.fields.return_url).toMatch(
        /^https?:\/\/.+\/kiosk\/success\/token-abc$/,
      );
    });

    it('mints a tracking token if the order somehow has none yet', async () => {
      mockPrisma.order.findUnique.mockResolvedValue({
        id: 'order-1',
        orderNumber: 7,
        total: 100,
        paymentStatus: 'PENDING',
        items: [],
      });
      mockPrisma.orderTrackingToken.findUnique.mockResolvedValue(null);
      mockOrders.issueTrackingToken.mockResolvedValue('freshly-minted');

      const result = await service.initPayment('order-1', {});

      expect(mockOrders.issueTrackingToken).toHaveBeenCalledWith('order-1');
      expect(result.fields.return_url).toContain('/kiosk/success/freshly-minted');
    });

    it('rejects an order that is already paid', async () => {
      mockPrisma.order.findUnique.mockResolvedValue({
        id: 'order-1',
        orderNumber: 7,
        total: 100,
        paymentStatus: 'PAID',
        items: [],
      });

      await expect(service.initPayment('order-1', {})).rejects.toThrow(BadRequestException);
    });

    it('refuses to issue checkout fields when BACKEND_URL points at localhost', async () => {
      // PayHere posts the confirmation to notify_url from its own servers, so
      // a loopback notify_url means the callback can never arrive and the
      // order would sit PENDING forever after a real charge.
      process.env.BACKEND_URL = 'http://localhost:3001';

      await expect(service.initPayment('order-1', {})).rejects.toThrow(
        /PayHere cannot reach/i,
      );
      expect(mockPrisma.order.findUnique).not.toHaveBeenCalled();
    });

    it.each(['http://127.0.0.1:3001', 'http://0.0.0.0:3001', 'http://[::1]:3001'])(
      'treats %s as unreachable',
      async (url) => {
        process.env.BACKEND_URL = url;

        await expect(service.initPayment('order-1', {})).rejects.toThrow(
          ServiceUnavailableException,
        );
      },
    );

    it('rejects a malformed BACKEND_URL', async () => {
      process.env.BACKEND_URL = 'not-a-url';

      await expect(service.initPayment('order-1', {})).rejects.toThrow(/not a valid URL/i);
    });
  });

  describe('getPaymentStatus', () => {
    it('still withholds confirmation while reporting the QR token', async () => {
      // The token is minted at creation so the kiosk can render the QR on
      // return from PayHere, but `paid` must stay false until the notify
      // callback confirms it.
      mockPrisma.order.findFirst.mockResolvedValue({
        id: 'order-1',
        orderNumber: 7,
        paymentStatus: 'PENDING',
        trackingToken: { tokenHash: 'secret-token' },
      });

      const result = await service.getPaymentStatus('order-1');

      expect(result.paid).toBe(false);
      expect(result.paymentStatus).toBe('PENDING');
      expect(result.trackingToken).toBe('secret-token');
    });

    it('exposes the tracking token once payment is confirmed', async () => {
      mockPrisma.order.findFirst.mockResolvedValue({
        id: 'order-1',
        orderNumber: 7,
        paymentStatus: 'PAID',
        trackingToken: { tokenHash: 'secret-token' },
      });

      const result = await service.getPaymentStatus('order-1');

      expect(result.paid).toBe(true);
      expect(result.trackingToken).toBe('secret-token');
    });

    it('resolves an order by its human order number as well as its uuid', async () => {
      // PayHe's redirect can drop the uuid, so the return page falls back to
      // the order number shown to the customer.
      mockPrisma.order.findFirst.mockResolvedValue({
        id: 'order-1',
        orderNumber: 7,
        paymentStatus: 'PAID',
        trackingToken: { tokenHash: 'secret-token' },
      });

      const result = await service.getPaymentStatus('7');

      expect(mockPrisma.order.findFirst).toHaveBeenCalledWith(
        expect.objectContaining({ where: { orderNumber: 7 } }),
      );
      expect(result.orderNumber).toBe(7);
    });

    it('treats a non-numeric identifier as a uuid lookup', async () => {
      mockPrisma.order.findFirst.mockResolvedValue({
        id: '212585d5-c95d-43f4-8dbd-66539ca570e7',
        orderNumber: 49,
        paymentStatus: 'PAID',
        trackingToken: { tokenHash: 'secret-token' },
      });

      await service.getPaymentStatus('212585d5-c95d-43f4-8dbd-66539ca570e7');

      expect(mockPrisma.order.findFirst).toHaveBeenCalledWith(
        expect.objectContaining({
          where: { id: '212585d5-c95d-43f4-8dbd-66539ca570e7' },
        }),
      );
    });
  });

  describe('getLatestPaymentStatus', () => {
    it('returns the most recent unpaid order without marking it paid', async () => {
      mockPrisma.order.findFirst.mockResolvedValue({
        id: 'order-9',
        orderNumber: 9,
        paymentStatus: 'PENDING',
        trackingToken: null,
      });

      const result = await service.getLatestPaymentStatus();

      expect(mockPrisma.order.findFirst).toHaveBeenCalledWith(
        expect.objectContaining({
          where: { paymentStatus: { in: ['PENDING', 'PAID'] } },
          orderBy: { orderNumber: 'desc' },
        }),
      );
      expect(result.paid).toBe(false);
      expect(result.trackingToken).toBeNull();
    });

    it('recovers the QR for an unpaid order without claiming it was paid', async () => {
      // The kiosk shows the QR on return from PayHere, so /latest must be able
      // to hand back a token for an order the notify callback has not confirmed.
      mockPrisma.order.findFirst.mockResolvedValue({
        id: 'order-9',
        orderNumber: 9,
        paymentStatus: 'PENDING',
        trackingToken: { tokenHash: 'early-token' },
      });

      const result = await service.getLatestPaymentStatus();

      expect(result.trackingToken).toBe('early-token');
      expect(result.paid).toBe(false);
      expect(result.paymentStatus).toBe('PENDING');
    });

    it('recovers the QR when PayHere redirects back with no query string', async () => {
      mockPrisma.order.findFirst.mockResolvedValue({
        id: 'order-9',
        orderNumber: 9,
        paymentStatus: 'PAID',
        trackingToken: { tokenHash: 'recovered-token' },
      });

      const result = await service.getLatestPaymentStatus();

      expect(result.paid).toBe(true);
      expect(result.trackingToken).toBe('recovered-token');
    });
  });
});
