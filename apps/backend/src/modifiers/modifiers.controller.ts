import { Controller, Get } from '@nestjs/common';
import { ModifiersService } from './modifiers.service';

@Controller('modifiers')
export class ModifiersController {
  constructor(private readonly modifiersService: ModifiersService) {}

  @Get()
  findAll() {
    return this.modifiersService.findAll();
  }
}
