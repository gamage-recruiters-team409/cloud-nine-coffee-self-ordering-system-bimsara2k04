import { IsArray, IsEnum, IsInt, IsOptional, IsString, Min, ValidateNested } from 'class-validator';
import { Type } from 'class-transformer';
import { DiningOption } from '@prisma/client';

class CreateOrderItemDto {
  /**
   * String ID of the drink — accepts seeded slug IDs (e.g. "drink-espresso") or UUID format.
   * Not enforced as UUID because seeded records use human-readable slug strings.
   */
  @IsString()
  drinkId: string;

  @IsInt()
  @Min(1)
  quantity: number;

  /**
   * Optional — omit or pass an empty array for items with no modifiers.
   */
  @IsOptional()
  @IsArray()
  @IsString({ each: true })
  modifierOptionIds?: string[];
}

export class CreateOrderDto {
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => CreateOrderItemDto)
  items: CreateOrderItemDto[];

  @IsEnum(DiningOption)
  diningOption: DiningOption;

  @IsOptional()
  @IsString()
  customerName?: string;
}
