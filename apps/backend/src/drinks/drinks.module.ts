import { Module } from '@nestjs/common';
import { DrinksService } from './drinks.service';
import { DrinksController } from './drinks.controller';
import { RealtimeModule } from '../realtime/realtime.module';

@Module({
  controllers: [DrinksController],
  providers: [DrinksService],
  // Needed so a price or availability change can push a refresh to open kiosks.
  imports: [RealtimeModule],
})
export class DrinksModule {}