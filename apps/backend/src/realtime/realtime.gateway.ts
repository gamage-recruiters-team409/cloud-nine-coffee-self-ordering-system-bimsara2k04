import {
  WebSocketGateway,
  WebSocketServer,
  SubscribeMessage,
  OnGatewayConnection,
  OnGatewayDisconnect,
} from '@nestjs/websockets';
import { Logger } from '@nestjs/common';
import { Server, Socket } from 'socket.io';
import { PrismaService } from '../prisma/prisma.service';
import { AuthService } from '../auth/auth.service';

/** Staff-only broadcast room. Customer sockets never join this. */
export const BARISTA_ROOM = 'barista';

/** Roles permitted to join the staff room. */
const STAFF_ROLES = ['ADMIN', 'BARISTA'];

/** Per-order room, derived server-side from a validated tracking token. */
export const orderRoom = (orderId: string) => `order:${orderId}`;

const allowedWsOrigins = (process.env.CORS_ORIGIN || 'http://localhost:3000')
  .split(',')
  .map((o) => o.trim())
  .filter(Boolean);

@WebSocketGateway({
  cors: {
    origin: allowedWsOrigins,
    credentials: true,
  },
})
export class RealtimeGateway implements OnGatewayConnection, OnGatewayDisconnect {
  @WebSocketServer()
  server: Server;

  private readonly logger = new Logger(RealtimeGateway.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly authService: AuthService,
  ) {}

  handleConnection(client: Socket) {
    this.logger.debug(`Client connected: ${client.id}`);
  }

  handleDisconnect(client: Socket) {
    this.logger.debug(`Client disconnected: ${client.id}`);
  }

  /**
   * Barista/admin subscribe to the shared staff room.
   *
   * Requires a valid staff access token from /auth/login. The room carries full
   * order records (customer names, totals, modifiers), so it must never be
   * reachable by an unauthenticated socket.
   */
  @SubscribeMessage('barista:subscribe')
  async handleBaristaSubscribe(client: Socket, payload: { token?: string }) {
    const token = payload?.token;

    if (!token || typeof token !== 'string') {
      return { ok: false, error: 'Authentication required' };
    }

    const user = await this.authService.verifyAccessToken(token);

    if (!user) {
      return { ok: false, error: 'Invalid or expired session' };
    }

    if (!STAFF_ROLES.includes(user.role)) {
      return { ok: false, error: 'Insufficient permissions' };
    }

    client.data.user = { id: user.sub, email: user.email, role: user.role };
    await client.join(BARISTA_ROOM);

    return { ok: true, role: user.role };
  }

  /**
   * Customer tracking subscribe.
   *
   * The token/order relation is validated against the database BEFORE the
   * socket is admitted to a room, so a client can never subscribe to an order
   * it does not own. Expired tokens are rejected the same way.
   */
  @SubscribeMessage('order:subscribe')
  async handleOrderSubscribe(client: Socket, payload: { token?: string }) {
    const token = payload?.token;

    if (!token || typeof token !== 'string') {
      return { ok: false, error: 'Invalid tracking token' };
    }

    const tracking = await this.prisma.orderTrackingToken.findUnique({
      where: { tokenHash: token },
      select: { orderId: true, expiresAt: true },
    });

    if (!tracking) {
      return { ok: false, error: 'Invalid tracking token' };
    }

    if (new Date() > tracking.expiresAt) {
      return { ok: false, error: 'Tracking token expired' };
    }

    // Leave any previously joined order room so a client tracks exactly one order.
    for (const room of client.rooms) {
      if (room.startsWith('order:')) {
        await client.leave(room);
      }
    }

    await client.join(orderRoom(tracking.orderId));
    return { ok: true };
  }

  /** Barista queue notification. Staff room only. */
  emitOrderCreated(order: any) {
    this.server?.to(BARISTA_ROOM).emit('order.created', order);
  }

  /**
   * Status change fan-out.
   * Staff get the full record for the queue; the customer gets a
   * minimal, pre-sanitized payload scoped to their own order room.
   */
  emitOrderStatusChanged(order: any) {
    if (!this.server) return;

    this.server.to(BARISTA_ROOM).emit('order.statusChanged', order);
    this.server
      .to(orderRoom(order.id))
      .emit('order.statusChanged', { status: order.status, updatedAt: order.updatedAt });
  }

  emitIngredientAvailabilityChanged(ingredient: any) {
    this.server?.emit('ingredient.availabilityChanged', ingredient);
  }

  emitMenuAvailabilityChanged() {
    this.server?.emit('menu.availabilityChanged');
  }
}
