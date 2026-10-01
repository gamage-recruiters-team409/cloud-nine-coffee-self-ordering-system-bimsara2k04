import { Module } from '@nestjs/common';
import { PrismaModule } from './prisma/prisma.module';
import { AuthModule } from './auth/auth.module';
import { UsersModule } from './users/users.module';
import { DrinksModule } from './drinks/drinks.module';
import { CategoriesModule } from './categories/categories.module';
import { ModifiersModule } from './modifiers/modifiers.module';
import { IngredientsModule } from './ingredients/ingredients.module';
import { OrdersModule } from './orders/orders.module';
import { PaymentsModule } from './payments/payments.module';
import { TrackingModule } from './tracking/tracking.module';
import { ReportsModule } from './reports/reports.module';
import { RealtimeModule } from './realtime/realtime.module';
import { AvailabilityModule } from './availability/availability.module';

@Module({
  imports: [
    PrismaModule,
    AuthModule,
    UsersModule,
    DrinksModule,
    CategoriesModule,
    ModifiersModule,
    IngredientsModule,
    OrdersModule,
    PaymentsModule,
    TrackingModule,
    ReportsModule,
    RealtimeModule,
    AvailabilityModule,
  ],
})
export class AppModule {}
