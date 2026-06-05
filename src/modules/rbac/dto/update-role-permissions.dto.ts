import { IsArray, IsOptional, IsUUID } from 'class-validator';
import { ApiPropertyOptional } from '@nestjs/swagger';

export class UpdateRolePermissionsDto {
  @ApiPropertyOptional({ type: [String], description: 'Permission IDs to add' })
  @IsOptional()
  @IsArray()
  @IsUUID('4', { each: true })
  add?: string[];

  @ApiPropertyOptional({
    type: [String],
    description: 'Permission IDs to remove',
  })
  @IsOptional()
  @IsArray()
  @IsUUID('4', { each: true })
  remove?: string[];
}
