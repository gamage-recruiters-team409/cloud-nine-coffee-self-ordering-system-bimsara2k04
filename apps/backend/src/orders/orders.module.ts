import { Module } from '@nestjs/common';
import { OrdersService } from './orders.service';
import { OrdersController } from './orders.controller';
import { AvailabilityModule } from '../availability/availability.module';
import { RealtimeModule } from '../realtime/realtime.module';

@Module({
  imports: [AvailabilityModule, RealtimeModule],
  controllers: [OrdersController],
  providers: [OrdersService],
  exports: [OrdersService],
})
export class OrdersModule {}
