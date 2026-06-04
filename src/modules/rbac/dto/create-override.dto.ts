import { IsIn, IsNotEmpty, IsOptional, IsString, IsUUID } from 'class-validator';

export class CreateOverrideDto {
  @IsUUID()
  permission_id: string;

  @IsString()
  @IsIn(['GRANT', 'DENY'])
  override_type: 'GRANT' | 'DENY';

  @IsString()
  @IsOptional()
  reason?: string;
}
