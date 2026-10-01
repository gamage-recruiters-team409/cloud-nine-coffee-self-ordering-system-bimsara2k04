import { Test, TestingModule } from '@nestjs/testing';
import { RealtimeGateway, BARISTA_ROOM, orderRoom } from './realtime.gateway';
import { PrismaService } from '../prisma/prisma.service';
import { AuthService } from '../auth/auth.service';

const makeClient = (rooms: string[] = []) => {
  const joined: string[] = [];
  return {
    data: {} as Record<string, unknown>,
    rooms: new Set(rooms),
    join: jest.fn((room: string) => {
      joined.push(room);
    }),
    leave: jest.fn(),
    joined,
  } as any;
};

describe('RealtimeGateway', () => {
  let gateway: RealtimeGateway;
  let verifyAccessToken: jest.Mock;

  const mockPrisma = {
    orderTrackingToken: { findUnique: jest.fn() },
  };

  beforeEach(async () => {
    verifyAccessToken = jest.fn();

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        RealtimeGateway,
        { provide: PrismaService, useValue: mockPrisma },
        { provide: AuthService, useValue: { verifyAccessToken } },
      ],
    }).compile();

    gateway = module.get<RealtimeGateway>(RealtimeGateway);
  });

  afterEach(() => jest.clearAllMocks());

  describe('barista:subscribe', () => {
    it.each(['ADMIN', 'BARISTA'])('admits a valid %s token to the staff room', async (role) => {
      verifyAccessToken.mockResolvedValue({ sub: 'user-1', email: 'a@b.com', role });
      const client = makeClient();

      const ack = await gateway.handleBaristaSubscribe(client, { token: 'valid-token' });

      expect(ack).toEqual({ ok: true, role });
      expect(client.join).toHaveBeenCalledWith(BARISTA_ROOM);
      expect(client.data.user).toEqual({ id: 'user-1', email: 'a@b.com', role });
    });

    it('rejects a missing token without joining the room', async () => {
      const client = makeClient();

      const ack = await gateway.handleBaristaSubscribe(client, {});

      expect(ack).toEqual({ ok: false, error: 'Authentication required' });
      expect(client.join).not.toHaveBeenCalled();
      expect(verifyAccessToken).not.toHaveBeenCalled();
    });

    it('rejects an invalid or expired token without joining the room', async () => {
      verifyAccessToken.mockResolvedValue(null);
      const client = makeClient();

      const ack = await gateway.handleBaristaSubscribe(client, { token: 'expired-token' });

      expect(ack).toEqual({ ok: false, error: 'Invalid or expired session' });
      expect(client.join).not.toHaveBeenCalled();
    });

    it('rejects a valid token whose role is not staff', async () => {
      verifyAccessToken.mockResolvedValue({ sub: 'u1', email: 'c@d.com', role: 'CUSTOMER' });
      const client = makeClient();

      const ack = await gateway.handleBaristaSubscribe(client, { token: 'valid-token' });

      expect(ack).toEqual({ ok: false, error: 'Insufficient permissions' });
      expect(client.join).not.toHaveBeenCalled();
    });
  });

  describe('order:subscribe', () => {
    it('joins the per-order room derived from a valid tracking token', async () => {
      mockPrisma.orderTrackingToken.findUnique.mockResolvedValue({
        orderId: 'order-1',
        expiresAt: new Date(Date.now() + 60_000),
      });
      const client = makeClient();

      const ack = await gateway.handleOrderSubscribe(client, { token: 'valid-token' });

      expect(ack).toEqual({ ok: true });
      expect(client.join).toHaveBeenCalledWith(orderRoom('order-1'));
    });

    it('rejects an unknown token', async () => {
      mockPrisma.orderTrackingToken.findUnique.mockResolvedValue(null);
      const client = makeClient();

      const ack = await gateway.handleOrderSubscribe(client, { token: 'nope' });

      expect(ack).toEqual({ ok: false, error: 'Invalid tracking token' });
      expect(client.join).not.toHaveBeenCalled();
    });

    it('rejects an expired token', async () => {
      mockPrisma.orderTrackingToken.findUnique.mockResolvedValue({
        orderId: 'order-1',
        expiresAt: new Date(Date.now() - 1000),
      });
      const client = makeClient();

      const ack = await gateway.handleOrderSubscribe(client, { token: 'expired' });

      expect(ack).toEqual({ ok: false, error: 'Tracking token expired' });
      expect(client.join).not.toHaveBeenCalled();
    });

    it('leaves a previously joined order room so a client tracks exactly one order', async () => {
      mockPrisma.orderTrackingToken.findUnique.mockResolvedValue({
        orderId: 'order-2',
        expiresAt: new Date(Date.now() + 60_000),
      });
      const client = makeClient([orderRoom('order-1'), 'socket-id']);

      await gateway.handleOrderSubscribe(client, { token: 'valid-token' });

      expect(client.leave).toHaveBeenCalledWith(orderRoom('order-1'));
      expect(client.leave).not.toHaveBeenCalledWith('socket-id');
      expect(client.join).toHaveBeenCalledWith(orderRoom('order-2'));
    });
  });

  describe('emit fan-out', () => {
    it('sends order.created to the staff room only, never globally', () => {
      const to = jest.fn().mockReturnValue({ emit: jest.fn() });
      gateway.server = { emit: jest.fn(), to } as any;

      gateway.emitOrderCreated({ id: 'order-1' });

      expect(to).toHaveBeenCalledWith(BARISTA_ROOM);
      expect(gateway.server.emit).not.toHaveBeenCalled();
    });

    it('gives staff the full record but the customer room a minimal payload', () => {
      const staffEmit = jest.fn();
      const customerEmit = jest.fn();
      const to = jest.fn((room: string) => ({
        emit: room === BARISTA_ROOM ? staffEmit : customerEmit,
      }));
      gateway.server = { emit: jest.fn(), to } as any;

      const order = { id: 'order-1', status: 'PREPARING', total: '9.00', customerName: 'Nimal' };
      gateway.emitOrderStatusChanged(order);

      expect(staffEmit).toHaveBeenCalledWith('order.statusChanged', order);
      expect(customerEmit).toHaveBeenCalledWith('order.statusChanged', {
        status: 'PREPARING',
        updatedAt: undefined,
      });
      expect(gateway.server.emit).not.toHaveBeenCalled();
    });
  });
});
