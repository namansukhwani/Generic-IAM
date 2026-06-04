import { IsNotEmpty, IsOptional, IsString, MaxLength } from 'class-validator';

export class CreatePermissionDto {
  @IsString()
  @IsNotEmpty()
  @MaxLength(100)
  resource: string;

  @IsString()
  @IsNotEmpty()
  @MaxLength(100)
  action: string;

  @IsString()
  @IsOptional()
  @MaxLength(500)
  description?: string;
}
