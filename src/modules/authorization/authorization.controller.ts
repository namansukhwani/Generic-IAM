import { Controller, Post, Body, HttpCode, HttpStatus } from '@nestjs/common';
import { AuthorizationService } from './authorization.service';
import { CheckAuthzDto } from './dto/check-authz.dto';
import { CheckAuthzBatchDto } from './dto/check-authz-batch.dto';
import { Public } from '@iam/nestjs-sdk';

@Controller('authorization')
@Public()
export class AuthorizationController {
  constructor(private readonly authorizationService: AuthorizationService) {}

  @Post('check')
  @HttpCode(HttpStatus.OK)
  async check(@Body() dto: CheckAuthzDto) {
    // Note: Can be called with user JWT or internal network trust. No guard for now,
    // assuming network level security or a specific service guard handles this.
    return this.authorizationService.check(dto);
  }

  @Post('check-batch')
  @HttpCode(HttpStatus.OK)
  async checkBatch(@Body() dto: CheckAuthzBatchDto) {
    return this.authorizationService.checkBatch(dto.checks);
  }
}
