import { Module } from '@nestjs/common';
import { DrinksService } from './drinks.service';
import { DrinksController } from './drinks.controller';

@Module({
  controllers: [DrinksController],
  providers: [DrinksService],
})
export class DrinksModule {}
