import { IsDateString, IsOptional, IsUUID } from 'class-validator';

export class AssignRoleDto {
  @IsUUID()
  role_id: string;

  @IsOptional()
  @IsDateString()
  expires_at?: Date;
}
