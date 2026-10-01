import { Injectable } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { RealtimeGateway } from '../realtime/realtime.gateway';

@Injectable()
export class IngredientsService {
  constructor(
    private prisma: PrismaService,
    private realtimeGateway: RealtimeGateway,
  ) {}

  async findAll() {
    return this.prisma.ingredient.findMany({
      orderBy: { name: 'asc' },
    });
  }

  async updateAvailability(id: string, isAvailable: boolean) {
    const ingredient = await this.prisma.ingredient.update({
      where: { id },
      data: { isAvailable },
    });

    // Broadcast availability change
    this.realtimeGateway.emitIngredientAvailabilityChanged(ingredient);
    this.realtimeGateway.emitMenuAvailabilityChanged();

    return ingredient;
  }
}
