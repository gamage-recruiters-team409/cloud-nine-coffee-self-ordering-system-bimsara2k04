import { Body, Controller, Get, Param, Patch, Post, UseGuards } from '@nestjs/common';
import { DrinksService } from './drinks.service';
import { CreateDrinkDto } from './dto/create-drink.dto';
import { UpdateDrinkDto } from './dto/update-drink.dto';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { RolesGuard } from '../auth/guards/roles.guard';
import { Roles } from '../auth/decorators/roles.decorator';

@Controller('drinks')
export class DrinksController {
  constructor(private readonly drinksService: DrinksService) {}

  /**
   * Public: the kiosk menu needs this without credentials.
   */
  @Get()
  findAll() {
    return this.drinksService.findAll();
  }

  @Get(':id')
  findOne(@Param('id') id: string) {
    return this.drinksService.findOne(id);
  }

  /**
   * ADMIN only. Creates a menu item.
   *
   * Guards are declared per route rather than on the controller, because the
   * read endpoints above must stay public for the kiosk.
   */
  @Post()
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles('ADMIN')
  create(@Body() dto: CreateDrinkDto) {
    return this.drinksService.create(dto);
  }

  /**
   * ADMIN only. Updates price, name, description, sort order or availability.
   */
  @Patch(':id')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles('ADMIN')
  update(@Param('id') id: string, @Body() dto: UpdateDrinkDto) {
    return this.drinksService.update(id, dto);
  }
}