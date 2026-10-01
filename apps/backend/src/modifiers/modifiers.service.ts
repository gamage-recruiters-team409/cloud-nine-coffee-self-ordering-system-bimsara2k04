import { Injectable } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';

@Injectable()
export class ModifiersService {
  constructor(private prisma: PrismaService) {}

  async findAll() {
    return this.prisma.modifierGroup.findMany({
      include: {
        options: {
          include: {
            ingredients: {
              include: {
                ingredient: true,
              },
            },
          },
          orderBy: { sortOrder: 'asc' },
        },
      },
      orderBy: { sortOrder: 'asc' },
    });
  }
}
