import { Controller, Get, Patch, Param, Body, UseGuards } from '@nestjs/common';
import { IngredientsService } from './ingredients.service';
import { UpdateAvailabilityDto } from './dto/update-availability.dto';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { RolesGuard } from '../auth/guards/roles.guard';
import { Roles } from '../auth/decorators/roles.decorator';

@Controller('ingredients')
export class IngredientsController {
  constructor(private readonly ingredientsService: IngredientsService) {}

  @Get()
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles('ADMIN', 'BARISTA')
  findAll() {
    return this.ingredientsService.findAll();
  }

  @Patch(':id/availability')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles('ADMIN', 'BARISTA')
  updateAvailability(@Param('id') id: string, @Body() dto: UpdateAvailabilityDto) {
    return this.ingredientsService.updateAvailability(id, dto.isAvailable);
  }
}
