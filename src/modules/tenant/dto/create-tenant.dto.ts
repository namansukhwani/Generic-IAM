import { IsString, IsNotEmpty, IsOptional, IsObject, ValidateNested, IsEmail, MinLength } from 'class-validator';
import { Type } from 'class-transformer';

class AdminUserDto {
  @IsEmail()
  email: string;

  @IsString()
  @MinLength(8)
  password: string;

  @IsString()
  @IsNotEmpty()
  first_name: string;

  @IsString()
  @IsNotEmpty()
  last_name: string;
}

export class CreateTenantDto {
  @IsString()
  @IsNotEmpty()
  name: string;

  @IsString()
  @IsNotEmpty()
  slug: string;

  @IsOptional()
  @IsObject()
  settings?: Record<string, any>;

  @ValidateNested()
  @Type(() => AdminUserDto)
  admin: AdminUserDto;
}
