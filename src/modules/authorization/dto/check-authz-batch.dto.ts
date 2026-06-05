import { IsArray, ValidateNested, ArrayMaxSize } from 'class-validator';
import { Type } from 'class-transformer';
import { CheckAuthzDto } from './check-authz.dto';

export class CheckAuthzBatchDto {
  @IsArray()
  @ArrayMaxSize(100)
  @ValidateNested({ each: true })
  @Type(() => CheckAuthzDto)
  checks: CheckAuthzDto[];
}
