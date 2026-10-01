import { Injectable, BadRequestException, NotFoundException } from '@nestjs/common';
import { OrderStatus } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import { AvailabilityService } from '../availability/availability.service';
import { CreateOrderDto } from './dto/create-order.dto';
import { RealtimeGateway } from '../realtime/realtime.gateway';

@Injectable()
export class OrdersService {
  constructor(
    private prisma: PrismaService,
    private availabilityService: AvailabilityService,
    private realtimeGateway: RealtimeGateway,
  ) {}

  private readonly VALID_TRANSITIONS: Record<OrderStatus, OrderStatus[]> = {
    RECEIVED: ['PREPARING'],
    PREPARING: ['READY_FOR_PICKUP'],
    READY_FOR_PICKUP: ['COLLECTED'],
    COLLECTED: [],
  };

  async create(createOrderDto: CreateOrderDto) {
    // Validate each drink and its modifiers
    for (const item of createOrderDto.items) {
      const isDrinkAvailable = await this.availabilityService.isDrinkAvailable(item.drinkId);
      if (!isDrinkAvailable) {
        throw new BadRequestException(`Drink ${item.drinkId} is not available`);
      }

      if (item.modifierOptionIds && item.modifierOptionIds.length > 0) {
        const modifierValidation = await this.availabilityService.validateModifierSelection(
          item.drinkId,
          item.modifierOptionIds,
        );

        if (!modifierValidation.valid) {
          throw new BadRequestException(
            `Some modifiers are unavailable: ${modifierValidation.unavailableOptions.join(', ')}`,
          );
        }
      }
    }

    // Fetch full drink and modifier details for snapshot and price calculation
    const itemsWithDetails = await Promise.all(
      createOrderDto.items.map(async (item) => {
        const drink = await this.prisma.drink.findUnique({
          where: { id: item.drinkId },
        });

        if (!drink) {
          throw new NotFoundException(`Drink ${item.drinkId} not found`);
        }

        let modifiers: any[] = [];
        if (item.modifierOptionIds && item.modifierOptionIds.length > 0) {
          modifiers = await this.prisma.modifierOption.findMany({
            where: { id: { in: item.modifierOptionIds } },
          });
        }

        const modifierTotal = modifiers.reduce(
          (sum, mod) => sum + Number(mod.priceAdjustment),
          0,
        );

        const itemTotal = (Number(drink.price) + modifierTotal) * item.quantity;

        return {
          drink,
          modifiers,
          quantity: item.quantity,
          itemTotal,
        };
      }),
    );

    const total = itemsWithDetails.reduce((sum, item) => sum + item.itemTotal, 0);

    // Create order as PENDING — NOT dispatched to barista yet
    const order = await this.prisma.order.create({
      data: {
        total,
        status: 'RECEIVED',
        diningOption: createOrderDto.diningOption,
        customerName: createOrderDto.customerName,
        paymentStatus: 'PENDING',
        paymentMethod: 'SANDBOX',
        items: {
          create: itemsWithDetails.map((item) => ({
            drinkId: item.drink.id,
            drinkName: item.drink.name,
            drinkPrice: item.drink.price,
            quantity: item.quantity,
            modifiers: {
              create: item.modifiers.map((mod) => ({
                optionId: mod.id,
                optionName: mod.name,
                priceAdjustment: mod.priceAdjustment,
              })),
            },
          })),
        },
        statusHistory: {
          create: {
            status: 'RECEIVED',
          },
        },
      },
      include: {
        items: {
          include: {
            modifiers: true,
          },
        },
      },
    });

    // Mint the tracking token up front so the QR exists as soon as the customer
    // returns from PayHere. This does NOT activate the order: the barista board
    // dispatch and the PAID transition still happen only in markOrderPaid, i.e.
    // only after a verified notify callback.
    const token = await this.issueTrackingToken(order.id);

    // Return minimal pending order info so frontend proceeds to payment
    return {
      id: order.id,
      orderNumber: order.orderNumber,
      total: order.total,
      status: order.status,
      paymentStatus: order.paymentStatus,
      trackingToken: token,
    };
  }

  /**
   * Creates the public tracking token for an order, or returns the existing one.
   * Idempotent so repeated calls never mint a second token.
   *
   * Public so PaymentsService can read it when building PayHere return_url,
   * which embeds the token in the URL path so the kiosk can render the QR
   * immediately on return.
   */
  async issueTrackingToken(orderId: string): Promise<string> {
    const existing = await this.prisma.orderTrackingToken.findUnique({
      where: { orderId },
      select: { tokenHash: true },
    });

    if (existing) {
      return existing.tokenHash;
    }

    const tokenHash = this.generateSecureToken();
    const expiresAt = new Date();
    expiresAt.setHours(
      expiresAt.getHours() + parseInt(process.env.TRACKING_TOKEN_EXPIRES_HOURS || '24'),
    );

    await this.prisma.orderTrackingToken.create({
      data: { orderId, tokenHash, expiresAt },
    });

    return tokenHash;
  }

  /**
   * Activates a server-confirmed paid order.
   *
   * Called ONLY from PaymentsService after a verified PayHere notify callback
   * (status_code = 2). Never from a public/customer-facing endpoint.
   *
   * This is the only place that:
   *  1. Marks the order as PAID
   *  2. Emits order.created to the barista board
   *
   * The tracking token itself is minted when the order is created so the kiosk
   * can show a QR immediately on return from PayHere. Activation is what waits
   * for the verified callback, not the token.
   *
   * Idempotent: a duplicate notify callback returns the existing token instead
   * of creating a second one or re-notifying the barista.
   */
  async markOrderPaid(orderId: string) {
    const order = await this.prisma.order.findUnique({
      where: { id: orderId },
      include: {
        items: { include: { modifiers: true } },
        trackingToken: true,
      },
    });

    if (!order) {
      throw new NotFoundException(`Order ${orderId} not found`);
    }

    // Already settled — PayHere retries notifications, so this is expected.
    if (order.paymentStatus === 'PAID') {
      return {
        id: order.id,
        orderNumber: order.orderNumber,
        paymentStatus: order.paymentStatus,
        trackingToken: order.trackingToken?.tokenHash ?? null,
        alreadyProcessed: true,
      };
    }

    const paid = await this.prisma.order.update({
      where: { id: orderId },
      data: {
        paymentStatus: 'PAID',
        paidAt: new Date(),
      },
      include: {
        items: { include: { modifiers: true } },
        statusHistory: { orderBy: { changedAt: 'desc' } },
      },
    });

    // Tracking token — already minted at order creation so the QR exists before the
    // customer returns from PayHere. Reuse it rather than minting a second one.
    const tokenHash = await this.issueTrackingToken(order.id);

    // Dispatch to barista board only now — payment confirmed.
    this.realtimeGateway.emitOrderCreated(paid);

    return {
      id: paid.id,
      orderNumber: paid.orderNumber,
      paymentStatus: paid.paymentStatus,
      trackingToken: tokenHash,
      alreadyProcessed: false,
    };
  }

  /**
   * Records a failed/cancelled payment. Never dispatches to the barista and
   * never creates a tracking token.
   */
  async markOrderFailed(orderId: string) {
    const order = await this.prisma.order.findUnique({
      where: { id: orderId },
      select: { id: true, paymentStatus: true, orderNumber: true },
    });

    if (!order) {
      throw new NotFoundException(`Order ${orderId} not found`);
    }

    if (order.paymentStatus === 'PAID') {
      // A late failure callback must not undo a settled payment.
      return;
    }

    await this.prisma.order.update({
      where: { id: orderId },
      data: { paymentStatus: 'FAILED' },
    });
  }

  /**
   * Barista queue — only returns PAID orders.
   */
  async findAll(status?: OrderStatus) {
    const where: any = { paymentStatus: 'PAID' };
    if (status) {
      where.status = status;
    }

    return this.prisma.order.findMany({
      where,
      include: {
        items: { include: { modifiers: true } },
        statusHistory: {
          include: {
            changedBy: {
              select: {
                id: true,
                email: true,
                role: true,
              },
            },
          },
          orderBy: { changedAt: 'desc' },
        },
      },
      orderBy: { createdAt: 'desc' },
    });
  }

  async findOne(id: string) {
    const order = await this.prisma.order.findUnique({
      where: { id },
      include: {
        items: { include: { modifiers: true } },
        statusHistory: {
          include: {
            changedBy: {
              select: {
                id: true,
                email: true,
                role: true,
              },
            },
          },
          orderBy: { changedAt: 'desc' },
        },
      },
    });

    if (!order) {
      throw new NotFoundException(`Order ${id} not found`);
    }

    return order;
  }

  async updateStatus(id: string, newStatus: OrderStatus, userId?: string) {
    const order = await this.findOne(id);

    if (order.paymentStatus !== 'PAID') {
      throw new BadRequestException('Cannot update status of an unpaid order');
    }

    const allowedTransitions = this.VALID_TRANSITIONS[order.status];
    if (!allowedTransitions.includes(newStatus)) {
      throw new BadRequestException(
        `Invalid status transition from ${order.status} to ${newStatus}`,
      );
    }

    const updated = await this.prisma.order.update({
      where: { id },
      data: {
        status: newStatus,
        statusHistory: {
          create: {
            status: newStatus,
            changedById: userId || null,
          },
        },
      },
      include: {
        items: { include: { modifiers: true } },
        statusHistory: {
          include: {
            changedBy: {
              select: {
                id: true,
                email: true,
                role: true,
              },
            },
          },
          orderBy: { changedAt: 'desc' },
        },
      },
    });

    this.realtimeGateway.emitOrderStatusChanged(updated);

    return updated;
  }

  private generateSecureToken(): string {
    const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789';
    let token = '';
    const array = new Uint8Array(32);
    crypto.getRandomValues(array);
    for (let i = 0; i < 32; i++) {
      token += chars[array[i] % chars.length];
    }
    return token;
  }
}
