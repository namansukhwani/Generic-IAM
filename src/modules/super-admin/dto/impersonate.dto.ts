import { IsNotEmpty, IsString, IsUUID } from 'class-validator';

export class ImpersonateDto {
  @IsUUID()
  user_id: string;

  @IsUUID()
  tenant_id: string;

  @IsString()
  @IsNotEmpty()
  reason: string;
}
