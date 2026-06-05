import { IsDateString, IsOptional, IsString, IsUUID } from 'class-validator';

export class AuditQueryDto {
  @IsOptional()
  @IsUUID()
  tenant_id?: string;

  @IsOptional()
  @IsUUID()
  actor_id?: string;

  @IsOptional()
  @IsString()
  event_type?: string;

  @IsOptional()
  @IsString()
  resource_type?: string;

  @IsOptional()
  @IsDateString()
  date_from?: string;

  @IsOptional()
  @IsDateString()
  date_to?: string;

  @IsOptional()
  @IsString()
  correlation_id?: string;

  @IsOptional()
  page?: number;

  @IsOptional()
  limit?: number;
}
