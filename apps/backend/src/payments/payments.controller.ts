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

  /** Read-only status poll used by the return page while awaiting confirmation. */
  @Get('payhere/status/:orderId')
  getPaymentStatus(@Param('orderId') orderId: string) {
    return this.paymentsService.getPaymentStatus(orderId);
  }
}
