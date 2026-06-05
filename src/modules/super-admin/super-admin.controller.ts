export interface AuditLogFilterDto {
  [key: string]: string;
}
import type { JwtPayload } from '../../common/interfaces/jwt-payload.interface';
import {
  Controller,
  Post,
  Get,
  Param,
  Body,
  UseGuards,
  Query,
  HttpCode,
  HttpStatus,
} from '@nestjs/common';
import { SuperAdminService } from './super-admin.service';
import { ImpersonateDto } from './dto/impersonate.dto';
import { AuthGuard } from '@nestjs/passport';
import { CurrentUser, IdentityTypes } from '@iam/nestjs-sdk';
import { IdentityType } from '../../common/constants/identity-types.constant';

@Controller('super-admin')
@UseGuards(AuthGuard('jwt'))
@IdentityTypes(IdentityType.SUPER_ADMIN)
export class SuperAdminController {
  constructor(private readonly superAdminService: SuperAdminService) {}

  @Post('impersonate')
  @HttpCode(HttpStatus.OK)
  async impersonate(
    @Body() dto: ImpersonateDto,
    @CurrentUser() user: JwtPayload,
  ) {
    // Note: Requires SuperAdmin Guard
    return this.superAdminService.impersonate(dto, user.sub);
  }

  @Get('tenants')
  async getTenants() {
    // Note: Requires SuperAdmin Guard
    return this.superAdminService.getTenants();
  }

  @Get('tenants/:id/users')
  async getTenantUsers(@Param('id') tenantId: string) {
    // Note: Requires SuperAdmin Guard
    return this.superAdminService.getTenantUsers(tenantId);
  }

  @Get('audit-logs')
  async getAuditLogs(@Query() filters: AuditLogFilterDto) {
    // Note: Requires SuperAdmin Guard
    return this.superAdminService.getAuditLogs(filters);
  }
}
