import { IsNotEmpty, IsString } from 'class-validator';

export class ServiceAuthDto {
  @IsString()
  @IsNotEmpty()
  client_id: string;

  @IsString()
  @IsNotEmpty()
  client_secret: string;
}
