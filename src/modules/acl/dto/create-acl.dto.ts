import { IsNotEmpty, IsString, IsUUID } from 'class-validator';

export class CreateAclDto {
  @IsUUID()
  user_id: string;

  @IsString()
  @IsNotEmpty()
  resource_type: string;

  @IsString()
  @IsNotEmpty()
  resource_id: string;

  @IsString()
  @IsNotEmpty()
  permission: string;
}
