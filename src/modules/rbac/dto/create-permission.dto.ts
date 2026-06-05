import { IsString, IsNotEmpty, IsOptional, IsUUID } from 'class-validator';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';

export class CreatePermissionDto {
  @ApiProperty({ example: 'expense.departments.create' })
  @IsString()
  @IsNotEmpty()
  code: string;

  @ApiProperty({ example: 'expense' })
  @IsString()
  @IsNotEmpty()
  service: string;

  @ApiPropertyOptional({ example: 'uuid' })
  @IsUUID()
  @IsOptional()
  parent_id?: string;

  @ApiPropertyOptional()
  @IsString()
  @IsOptional()
  description?: string;
}
