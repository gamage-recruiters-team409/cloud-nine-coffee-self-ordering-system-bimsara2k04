import {
  BadRequestException,
  ForbiddenException,
  Injectable,
  Logger,
  NotFoundException,
  ServiceUnavailableException,
  UnauthorizedException,
} from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { OrdersService } from '../orders/orders.service';
import { InitPayHerePaymentDto } from './dto/init-payhere-payment.dto';
import { PayHereNotifyPayload } from './dto/payhere-notify.dto';
import {
  formatAmount,
  generateCheckoutHash,
  generateNotifyHash,
  safeCompare,
} from './payhere.util';

const SANDBOX_CHECKOUT_URL = 'https://sandbox.payhere.lk/pay/checkout';
const LIVE_CHECKOUT_URL = 'https://www.payhere.lk/pay/checkout';

const CURRENCY = 'LKR';

/** PayHere status codes. */
const STATUS_SUCCESS = '2';
const STATUS_PENDING = '0';
const STATUS_CANCELLED = '-1';
const STATUS_FAILED = '-2';
const STATUS_CHARGEDBACK = '-3';

@Injectable()
export class PaymentsService {
  private readonly logger = new Logger(PaymentsService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly ordersService: OrdersService,
  ) {}

  private isSandbox(): boolean {
    return (process.env.PAYHERE_SANDBOX ?? 'true').toLowerCase() !== 'false';
  }

  private get merchantId(): string {
    return process.env.PAYHERE_MERCHANT_ID ?? '';
  }

  private get merchantSecret(): string {
    return process.env.PAYHERE_MERCHANT_SECRET ?? '';
  }

  private get frontendUrl(): string {
    return (process.env.PUBLIC_URL ?? 'http://localhost:3000').replace(/\/+$/, '');
  }

  private get backendUrl(): string {
    return (process.env.BACKEND_URL ?? 'http://localhost:3001').replace(/\/+$/, '');
  }

  private get checkoutUrl(): string {
    return this.isSandbox() ? SANDBOX_CHECKOUT_URL : LIVE_CHECKOUT_URL;
  }

  /** Fail fast with a clear message rather than sending a broken form to PayHere. */
  private assertConfigured() {
    if (!this.merchantId || !this.merchantSecret) {
      throw new ServiceUnavailableException(
        'PayHere is not configured. Set PAYHERE_MERCHANT_ID and PAYHERE_MERCHANT_SECRET.',
      );
    }
  }

  /**
   * PayHere posts the signed confirmation to `notify_url` from its own
   * servers, so that URL must be publicly reachable. In local development
   * `localhost` is unreachable, and the failure mode is silent: the customer
   * pays, the callback never arrives, and the order stays PENDING forever.
   * Reject checkout early with an actionable message instead.
   */
  private assertNotifyUrlReachable() {
    const url = this.backendUrl;

    let hostname: string;
    try {
      hostname = new URL(url).hostname;
    } catch {
      throw new ServiceUnavailableException(
        `BACKEND_URL is not a valid URL: "${url}".`,
      );
    }

    const isLoopback =
      ['localhost', '127.0.0.1', '0.0.0.0'].includes(hostname) ||
      // URL keeps IPv6 literals in brackets, so the hostname is "[::1]".
      hostname === '[::1]';

    if (isLoopback) {
      throw new ServiceUnavailableException(
        'BACKEND_URL points to localhost, which PayHere cannot reach. ' +
          'Start a public tunnel (for example: cloudflared tunnel --url http://localhost:3001) ' +
          'and set BACKEND_URL to the https://*.trycloudflare.com URL, then restart the backend.',
      );
    }
  }

  /**
   * Builds the complete set of PayHere form fields for an existing PENDING order.
   * The secret never leaves the backend — only the resulting `hash` is returned.
   */
  async initPayment(orderId: string, dto: InitPayHerePaymentDto) {
    this.assertConfigured();
    this.assertNotifyUrlReachable();

    const order = await this.prisma.order.findUnique({
      where: { id: orderId },
      include: { items: true },
    });

    if (!order) {
      throw new NotFoundException(`Order ${orderId} not found`);
    }

    if (order.paymentStatus === 'PAID') {
      throw new BadRequestException('This order has already been paid');
    }

    if (order.paymentStatus === 'FAILED') {
      throw new BadRequestException(
        'This order payment already failed. Please place a new order.',
      );
    }

    const amount = formatAmount(Number(order.total));
    const hash = generateCheckoutHash(
      this.merchantId,
      order.id,
      amount,
      CURRENCY,
      this.merchantSecret,
    );

    const firstName = dto.firstName?.trim() || order.customerName?.trim() || 'Customer';
    const [nameFirst, ...nameRest] = firstName.split(/\s+/);
    const lastName = dto.lastName?.trim() || nameRest.join(' ') || 'Kiosk';

    // Mark the intent to pay so the order no longer looks abandoned in admin.
    await this.prisma.order.update({
      where: { id: order.id },
      data: { paymentMethod: 'PAYHERE_SANDBOX' },
    });

    // The tracking token is minted at order creation; this only reads it so it can
    // be embedded in return_url as a PATH segment. PayHe's redirect has been
    // observed to drop query strings, and the kiosk may be browsing a different
    // origin than PUBLIC_URL, which makes sessionStorage unusable as a handoff.
    // The path survives both, so the return page can always render the QR.
    const existingToken = await this.prisma.orderTrackingToken.findUnique({
      where: { orderId: order.id },
      select: { tokenHash: true },
    });
    const token = existingToken?.tokenHash ?? (await this.ordersService.issueTrackingToken(order.id));

    return {
      action: this.checkoutUrl,
      method: 'POST' as const,
      mode: this.isSandbox() ? ('sandbox' as const) : ('live' as const),
      fields: {
        merchant_id: this.merchantId,
        return_url: `${this.frontendUrl}/kiosk/success/${token}`,
        cancel_url: `${this.frontendUrl}/kiosk/payment-cancelled?orderNumber=${order.orderNumber}&orderId=${order.id}`,
        notify_url: `${this.backendUrl}/payments/payhere/notify`,
        first_name: nameFirst,
        last_name: lastName,
        email: dto.email?.trim() || 'customer@kiosk.local',
        phone: dto.phone?.trim() || '0000000000',
        address: dto.address?.trim() || 'Cloud Nine Coffee Bar',
        city: dto.city?.trim() || 'Colombo',
        country: dto.country?.trim() || 'Sri Lanka',
        order_id: order.id,
        items: this.buildItemsSummary(order),
        currency: CURRENCY,
        amount,
        hash,
      },
    };
  }

  /** e.g. "2 x Cappuccino, 1 x Latte" — names and quantities only, no prices. */
  private buildItemsSummary(order: { items: Array<{ quantity: number; drinkName: string }> }): string {
    const summary = order.items
      .map((item) => `${item.quantity} x ${item.drinkName}`)
      .join(', ');
    return summary.length > 200 ? `${summary.slice(0, 197)}...` : summary;
  }

  /**
   * Trusted server-to-server payment confirmation path.
   * This is the ONLY place an order is ever activated, never the browser return_url.
   */
  async handleNotify(payload: PayHereNotifyPayload): Promise<void> {
    const merchantId = payload.merchant_id;
    const orderId = payload.order_id;
    const amount = payload.payhere_amount;
    const currency = payload.payhere_currency;
    const statusCode = payload.status_code;
    const signature = payload.md5sig;

    if (!merchantId || !orderId || !amount || !currency || !statusCode || !signature) {
      this.logger.warn('PayHere notify rejected: missing required fields');
      throw new BadRequestException('Incomplete PayHere notification');
    }

    if (!this.merchantSecret || !safeCompare(merchantId, this.merchantId)) {
      this.logger.warn('PayHere notify rejected: merchant mismatch');
      throw new UnauthorizedException('Invalid merchant');
    }

    // Verify request integrity: the signature can only be produced with the secret.
    const expected = generateNotifyHash(
      merchantId,
      orderId,
      amount,
      currency,
      statusCode,
      this.merchantSecret,
    );

    if (!safeCompare(signature.toUpperCase(), expected)) {
      this.logger.warn(`PayHere notify rejected: bad md5sig for order ${orderId}`);
      throw new UnauthorizedException('Invalid PayHere signature');
    }

    if (statusCode === STATUS_SUCCESS) {
      // The signature proves the callback came from PayHere, but it does not
      // prove the amount matches what this order was actually created for.
      // Guard against a misconfigured checkout amount before activating.
      const order = await this.prisma.order.findUnique({
        where: { id: orderId },
        select: { id: true, total: true, orderNumber: true },
      });

      if (!order) {
        this.logger.warn(`PayHere notify: order ${orderId} not found`);
        throw new NotFoundException(`Order ${orderId} not found`);
      }

      const expectedAmount = formatAmount(Number(order.total));
      if (expectedAmount !== amount) {
        this.logger.error(
          `PayHere notify: amount mismatch for order ${orderId} (expected ${expectedAmount}, got ${amount})`,
        );
        throw new BadRequestException('Payment amount does not match the order total');
      }

      await this.ordersService.markOrderPaid(orderId);
      return;
    }

    if (statusCode === STATUS_PENDING) {
      // Keep the order PENDING; PayHere will notify again when it settles.
      this.logger.log(`PayHere notify: order ${orderId} still pending`);
      return;
    }

    // -1 cancelled, -2 failed, -3 charged back
    const reason =
      statusCode === STATUS_CANCELLED
        ? 'cancelled'
        : statusCode === STATUS_CHARGEDBACK
          ? 'charged back'
          : 'failed';

    this.logger.log(`PayHere notify: order ${orderId} payment ${reason}`);
    await this.ordersService.markOrderFailed(orderId);
  }

  /**
   * Read-only payment state for the browser return page.
   * It deliberately cannot mark an order paid — it only reports what the
   * server-side notify callback has already confirmed.
   */
  /**
   * Read-only status poll for the return page. Accepts either the order UUID or
   * its human-facing order number, because PayHe's redirect back to
   * return_url does not reliably preserve our own query string.
   */
  async getPaymentStatus(orderIdOrNumber: string) {
    const asNumber = Number(orderIdOrNumber);
    const isOrderNumber =
      Number.isInteger(asNumber) && String(asNumber) === orderIdOrNumber.trim();

    const order = await this.prisma.order.findFirst({
      where: isOrderNumber
        ? { orderNumber: asNumber }
        : { id: orderIdOrNumber },
      include: { trackingToken: true },
    });

    if (!order) {
      throw new NotFoundException(`Order ${orderIdOrNumber} not found`);
    }

    const confirmed = order.paymentStatus === 'PAID';

    return {
      orderId: order.id,
      orderNumber: order.orderNumber,
      paymentStatus: order.paymentStatus,
      paid: confirmed,
      // Minted at order creation so the kiosk can render the QR on return from
      // PayHere without waiting for the notify callback.
      trackingToken: order.trackingToken?.tokenHash ?? null,
    };
  }

  /**
   * SANDBOX ONLY: activates the order behind a tracking token immediately.
   *
   * The kiosk return page calls this on load so a demo never blocks on the
   * gateway webhook. Guarded by PAYHERE_SANDBOX so it is impossible to reach
   * in live mode. When a real notify arrives later it is idempotent and simply
   * returns the same token.
   */
  async sandboxApproveByToken(token: string) {
    if (!this.isSandbox()) {
      throw new ForbiddenException(
        'Sandbox auto-approval is disabled. Set PAYHERE_SANDBOX=true to enable it.',
      );
    }

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

    const settled = await this.ordersService.markOrderPaid(tracking.orderId);

    return {
      orderId: settled.id,
      orderNumber: settled.orderNumber,
      paymentStatus: settled.paymentStatus,
      paid: true,
      trackingToken: settled.trackingToken ?? token,
      sandboxApproved: true,
    };
  }

  /**
   * Resolves the order behind a public tracking token.
   *
   * The PayHere return page carries its token in the URL path, so it can label
   * the confirmation banner without knowing an internal order id. Expiry is
   * enforced so a leaked token cannot poll an order indefinitely.
   */
  async getPaymentStatusByToken(token: string) {
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

    const order = await this.prisma.order.findUnique({
      where: { id: tracking.orderId },
      select: { id: true, orderNumber: true, paymentStatus: true },
    });

    if (!order) {
      throw new NotFoundException('Order not found for this tracking token');
    }

    const confirmed = order.paymentStatus === 'PAID';

    return {
      orderId: order.id,
      orderNumber: order.orderNumber,
      paymentStatus: order.paymentStatus,
      paid: confirmed,
      // The token came from the URL itself, so echoing it adds no exposure.
      trackingToken: token,
    };
  }

  /**
   * Recovery lookup used when PayHere redirects back with no query string.
   *
   * Picks the most recent order that is still awaiting confirmation, falling
   * back to the most recently paid one, so a kiosk that lost `orderId` can
   * still reach the QR. Read-only: this never marks anything paid.
   */
  async getLatestPaymentStatus() {
    const order = await this.prisma.order.findFirst({
      where: { paymentStatus: { in: ['PENDING', 'PAID'] } },
      orderBy: { orderNumber: 'desc' },
      include: { trackingToken: true },
    });

    if (!order) {
      throw new NotFoundException('No order awaiting payment confirmation');
    }

    const confirmed = order.paymentStatus === 'PAID';

    return {
      orderId: order.id,
      orderNumber: order.orderNumber,
      paymentStatus: order.paymentStatus,
      paid: confirmed,
      trackingToken: order.trackingToken?.tokenHash ?? null,
    };
  }
}
