import { Type } from 'class-transformer';
import { IsNumber, IsOptional, IsString, Max, Min, MinLength } from 'class-validator';

/**
 * Payload for an admin creating a new menu item.
 *
 * `price` arrives as a number from the admin form. `@Type(() => Number)` is
 * required because the global ValidationPipe runs with `transform: true`, which
 * only coerces a numeric string when a `@Type` is declared, and `@IsNumber()`
 * would otherwise reject `"750"` outright.
 */
export class CreateDrinkDto {
  @IsString()
  @MinLength(2)
  name: string;

  @IsOptional()
  @IsString()
  description?: string;

  /**
   * Base price before any modifier adjustments. Decimal(10,2) in the database,
   * so the upper bound keeps it inside the column.
   */
  @Type(() => Number)
  @IsNumber({ maxDecimalPlaces: 2 })
  @Min(0)
  @Max(99999999.99)
  price: number;

  @IsString()
  categoryId: string;

  /** Defaults to the end of its category when omitted. */
  @IsOptional()
  @Type(() => Number)
  @IsNumber()
  @Min(0)
  sortOrder?: number;

  /** Defaults to true, so a new item is immediately orderable. */
  @IsOptional()
  isAvailable?: boolean;
}