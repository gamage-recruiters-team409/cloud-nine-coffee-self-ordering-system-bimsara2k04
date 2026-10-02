import { Type } from 'class-transformer';
import { IsBoolean, IsNumber, IsOptional, IsString, Max, Min, MinLength } from 'class-validator';

/**
 * Partial update of a menu item. Every field is optional, so an admin can
 * change only the price without sending the rest back.
 *
 * Only fields present on the DTO are applied by the service, which keeps an
 * unrelated edit from blanking a description.
 *
 * Note: historical orders are unaffected because OrderItem snapshots
 * `drinkName` and `drinkPrice` at checkout time.
 */
export class UpdateDrinkDto {
  @IsOptional()
  @IsString()
  @MinLength(2)
  name?: string;

  @IsOptional()
  @IsString()
  description?: string;

  @IsOptional()
  @Type(() => Number)
  @IsNumber({ maxDecimalPlaces: 2 })
  @Min(0)
  @Max(99999999.99)
  price?: number;

  @IsOptional()
  @Type(() => Number)
  @IsNumber()
  @Min(0)
  sortOrder?: number;

  @IsOptional()
  @IsBoolean()
  isAvailable?: boolean;
}