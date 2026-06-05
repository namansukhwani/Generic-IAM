import { IsArray, IsOptional, IsUUID, ValidateNested, IsDateString } from 'class-validator';
import { Type } from 'class-transformer';
import { ApiPropertyOptional } from '@nestjs/swagger';

export class AssignRoleItemDto {
  @IsUUID('4')
  role_id: string;

  @IsOptional()
  @IsDateString()
  expires_at?: Date;
}

export class UpdateUserRolesDto {
  @ApiPropertyOptional({ type: [AssignRoleItemDto], description: 'Roles to assign' })
  @IsOptional()
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => AssignRoleItemDto)
  add?: AssignRoleItemDto[];

  @ApiPropertyOptional({ type: [String], description: 'Role IDs to remove' })
  @IsOptional()
  @IsArray()
  @IsUUID('4', { each: true })
  remove?: string[];
}
