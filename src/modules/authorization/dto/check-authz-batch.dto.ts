import { IsArray, ValidateNested } from 'class-validator';
import { Type } from 'class-transformer';
import { CheckAuthzDto } from './check-authz.dto';

export class CheckAuthzBatchDto {
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => CheckAuthzDto)
  checks: CheckAuthzDto[];
}
