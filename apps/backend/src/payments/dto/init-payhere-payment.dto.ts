import { IsEmail, IsOptional, IsString, MaxLength } from 'class-validator';

/**
 * Customer billing details required by the PayHere checkout form.
 * These are passed through to PayHere only — they are not persisted, because
 * the assignment schema has no customer contact table.
 */
export class InitPayHerePaymentDto {
  @IsOptional()
  @IsString()
  @MaxLength(60)
  firstName?: string;

  @IsOptional()
  @IsString()
  @MaxLength(60)
  lastName?: string;

  @IsOptional()
  @IsEmail()
  @MaxLength(120)
  email?: string;

  @IsOptional()
  @IsString()
  @MaxLength(20)
  phone?: string;

  @IsOptional()
  @IsString()
  @MaxLength(100)
  address?: string;

  @IsOptional()
  @IsString()
  @MaxLength(50)
  city?: string;

  @IsOptional()
  @IsString()
  @MaxLength(50)
  country?: string;
}
