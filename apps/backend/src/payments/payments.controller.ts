import {
  BadRequestException,
  Body,
  Controller,
  Get,
  HttpCode,
  Param,
  Post,
  Res,
  UnauthorizedException,
} from '@nestjs/common';
import type { Response } from 'express';
import { PaymentsService } from './payments.service';
import { InitPayHerePaymentDto } from './dto/init-payhere-payment.dto';
import { PayHereNotifyPayload } from './dto/payhere-notify.dto';

@Controller('payments')
export class PaymentsController {
  constructor(private readonly paymentsService: PaymentsService) {}

  /**
   * Returns every field PayHere needs to render the sandbox checkout form.
   * Public because the kiosk has no authenticated customer session.
   */
  @Post('payhere/init/:orderId')
  initPayHerePayment(
    @Param('orderId') orderId: string,
    @Body() dto: InitPayHerePaymentDto,
  ) {
    return this.paymentsService.initPayment(orderId, dto);
  }

  /**
   * Server-to-server payment confirmation. Public by necessity (PayHere calls
   * it), authenticated by the md5sig signature verified in the service.
   * Must answer with a plain "ok" body or PayHere treats the call as failed.
   */
  @Post('payhere/notify')
  @HttpCode(200)
  async payhereNotify(
    @Body() payload: PayHereNotifyPayload,
    @Res() res: Response,
  ): Promise<void> {
    try {
      await this.paymentsService.handleNotify(payload);
    } catch (error) {
      // Never leak failure details back to the gateway.
      if (error instanceof UnauthorizedException) {
        res.status(401).send('invalid signature');
        return;
      }
      if (error instanceof BadRequestException) {
        res.status(400).send('invalid request');
        return;
      }
      throw error;
    }

    res.status(200).send('ok');
  }

  /**
   * SANDBOX ONLY: approves an order the moment the customer returns from the
   * PayHere sandbox, without waiting for the notify callback.
   *
   * The kiosk return page calls this immediately on load so a demo never hangs
   * on a gateway webhook. It is hard-blocked when PAYHERE_SANDBOX is false, so
   * it can never approve a real payment. In sandbox no real money moves, and
   * the notify callback still runs and still produces the barista dispatch.
   */
  @Post('payhere/sandbox/approve/:token')
  @HttpCode(200)
  async sandboxApprove(@Param('token') token: string) {
    return this.paymentsService.sandboxApproveByToken(token);
  }

  /**
   * Recovery endpoint for when PayHere redirects back without any query params.
   * Must stay declared ABOVE the ':orderId' route so the literal path is not
   * swallowed by the parameterised one.
   */
  @Get('payhere/status/latest')
  getLatestPaymentStatus() {
    return this.paymentsService.getLatestPaymentStatus();
  }

  /**
   * Resolves the order behind a public tracking token.
   *
   * The return page receives its token as a URL path segment rather than an
   * order id, since PayHere's redirect does not reliably preserve query
   * strings. Read-only: it never marks an order paid.
   */
  @Get('payhere/status/by-token/:token')
  getPaymentStatusByToken(@Param('token') token: string) {
    return this.paymentsService.getPaymentStatusByToken(token);
  }

  /** Read-only status poll used by the return page while awaiting confirmation. */
  @Get('payhere/status/:orderId')
  getPaymentStatus(@Param('orderId') orderId: string) {
    return this.paymentsService.getPaymentStatus(orderId);
  }
}
