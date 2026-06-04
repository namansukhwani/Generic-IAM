import { IsNotEmpty, IsOptional, IsString, IsUUID } from 'class-validator';

export class CheckAuthzDto {
  @IsUUID()
  user_id: string;

  @IsUUID()
  tenant_id: string;

  @IsString()
  @IsNotEmpty()
  permission: string;

  @IsString()
  @IsOptional()
  resource_type?: string;

  @IsString()
  @IsOptional()
  resource_id?: string;
}
