import { Injectable, NotFoundException } from '@nestjs/common';
import { OrderStatus } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import * as QRCode from 'qrcode';

/** Customer-facing status copy. Never expose raw enum values or internal notes. */
const STATUS_LABELS: Record<OrderStatus, string> = {
  RECEIVED: 'Order Received',
  PREPARING: 'Preparing Your Order',
  READY_FOR_PICKUP: 'Ready for Pickup',
  COLLECTED: 'Collected',
};

const STATUS_MESSAGES: Record<OrderStatus, string> = {
  RECEIVED: 'We have received your order and payment.',
  PREPARING: 'Our barista team is preparing your order now.',
  READY_FOR_PICKUP: 'Your order is ready. Please collect it at the counter.',
  COLLECTED: 'Order collected. Thank you for visiting Cloud Nine!',
};

/** Keep only the first name so a public link never exposes a full identity. */
const firstNameOnly = (fullName?: string | null): string | null => {
  if (!fullName) return null;
  const [first] = fullName.trim().split(/\s+/);
  return first || null;
};

@Injectable()
export class TrackingService {
  constructor(private prisma: PrismaService) {}

  /**
   * Resolves a tracking token to its order, enforcing expiry.
   * Shared by the public REST endpoint and the realtime subscribe handler.
   */
  async resolveToken(token: string) {
    const tracking = await this.prisma.orderTrackingToken.findUnique({
      where: { tokenHash: token },
      select: { orderId: true, expiresAt: true },
    });

    if (!tracking) {
      throw new NotFoundException('Invalid tracking token');
    }

    if (new Date() > tracking.expiresAt) {
      throw new NotFoundException('Tracking token expired');
    }

    return tracking;
  }

  /**
   * Public tracking payload.
   *
   * Intentionally excludes: internal order/item ids, prices and totals,
   * payment details, staff identities, and modifier details.
   */
  async findOrderByToken(token: string) {
    const { orderId } = await this.resolveToken(token);

    const order = await this.prisma.order.findUnique({
      where: { id: orderId },
      select: {
        orderNumber: true,
        status: true,
        diningOption: true,
        customerName: true,
        createdAt: true,
        updatedAt: true,
        items: {
          select: {
            drinkName: true,
            quantity: true,
          },
        },
      },
    });

    if (!order) {
      throw new NotFoundException('Order not found for this tracking token');
    }

    return {
      orderNumber: order.orderNumber,
      status: order.status,
      statusLabel: STATUS_LABELS[order.status],
      statusMessage: STATUS_MESSAGES[order.status],
      diningOption: order.diningOption,
      customerName: firstNameOnly(order.customerName),
      items: order.items.map((item) => ({
        name: item.drinkName,
        quantity: item.quantity,
      })),
      createdAt: order.createdAt,
      updatedAt: order.updatedAt,
    };
  }

  async generateQRCode(token: string): Promise<string> {
    // Validate before generating so an invalid token cannot mint a QR code.
    await this.resolveToken(token);

    const publicUrl = (process.env.PUBLIC_URL || 'http://localhost:3000').replace(/\/+$/, '');
    const trackingUrl = `${publicUrl}/tracking/${token}`;

    try {
      return await QRCode.toDataURL(trackingUrl, {
        width: 300,
        margin: 2,
        color: {
          dark: '#000000',
          light: '#FFFFFF',
        },
      });
    } catch (error) {
      throw new Error(`Failed to generate QR code: ${(error as Error).message}`);
    }
  }
}
