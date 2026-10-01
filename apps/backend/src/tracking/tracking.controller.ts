import { Controller, Get, Param } from '@nestjs/common';
import { TrackingService } from './tracking.service';

@Controller('tracking')
export class TrackingController {
  constructor(private readonly trackingService: TrackingService) {}

  @Get(':token')
  findOrderByToken(@Param('token') token: string) {
    return this.trackingService.findOrderByToken(token);
  }

  @Get(':token/qr')
  async getQRCode(@Param('token') token: string) {
    const qrDataUrl = await this.trackingService.generateQRCode(token);
    return { qrCode: qrDataUrl };
  }
}
