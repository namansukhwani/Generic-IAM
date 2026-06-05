import {
  Controller,
  Get,
  Post,
  Body,
  Patch,
  Param,
  Delete,
  ParseUUIDPipe,
  Query,
} from '@nestjs/common';
import { ApiTags, ApiBearerAuth, ApiOperation } from '@nestjs/swagger';
import { TenantService } from './tenant.service';
import { CreateTenantDto } from './dto/create-tenant.dto';
import { UpdateTenantDto } from './dto/update-tenant.dto';
import { IdentityTypes } from '@iam/nestjs-sdk';
import { IdentityType } from '../../common/constants/identity-types.constant';
import { RequirePermissions } from '@iam/nestjs-sdk';
import { SYSTEM_PERMISSIONS } from '../../common/constants/system-permissions.constant';
import { CurrentUser } from '@iam/nestjs-sdk';
import type { JwtPayload } from '../../common/interfaces/jwt-payload.interface';

import { AuditService } from '../audit/audit.service';
import { AuditQueryDto } from '../audit/dto/audit-query.dto';
import { ForbiddenException } from '@nestjs/common';

@ApiTags('Tenants')
@ApiBearerAuth()
@Controller('tenants')
export class TenantController {
  constructor(
    private readonly tenantService: TenantService,
    private readonly auditService: AuditService,
  ) {}

  @Post()
  @ApiOperation({ summary: 'Create a new tenant with initial admin user' })
  @IdentityTypes(IdentityType.SUPER_ADMIN)
  async create(
    @Body() createTenantDto: CreateTenantDto,
    @CurrentUser() user: JwtPayload,
  ) {
    return this.tenantService.createTenantWithAdmin(createTenantDto, user.sub);
  }

  @Get()
  @ApiOperation({ summary: 'List all tenants' })
  @IdentityTypes(IdentityType.SUPER_ADMIN)
  async findAllTenants(@Query('page') page = 1, @Query('limit') limit = 10) {
    return this.tenantService.findAll({
      skip: (page - 1) * limit,
      take: limit,
      order: { created_at: 'DESC' },
    });
  }

  @Get(':id')
  @ApiOperation({ summary: 'Get tenant details' })
  @IdentityTypes(IdentityType.SUPER_ADMIN, IdentityType.USER)
  @RequirePermissions(SYSTEM_PERMISSIONS.TENANT.READ)
  async findOne(@Param('id', ParseUUIDPipe) id: string) {
    return this.tenantService.findOne({ where: { id } });
  }

  @Patch(':id')
  @ApiOperation({ summary: 'Update tenant settings' })
  @IdentityTypes(IdentityType.SUPER_ADMIN, IdentityType.USER)
  @RequirePermissions(SYSTEM_PERMISSIONS.TENANT.WRITE)
  async update(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() updateTenantDto: UpdateTenantDto,
    @CurrentUser() user: JwtPayload,
  ) {
    return this.tenantService.updateTenant(id, updateTenantDto, user.sub);
  }

  @Delete(':id')
  @ApiOperation({ summary: 'Deactivate tenant' })
  @IdentityTypes(IdentityType.SUPER_ADMIN)
  async remove(
    @Param('id', ParseUUIDPipe) id: string,
    @CurrentUser() user: JwtPayload,
  ) {
    await this.tenantService.deactivateTenant(id, user.sub);
    return { success: true };
  }

  @Get(':id/audit-logs')
  @ApiOperation({ summary: 'Get audit logs for a tenant' })
  @IdentityTypes(IdentityType.SUPER_ADMIN, IdentityType.USER)
  @RequirePermissions(SYSTEM_PERMISSIONS.AUDIT.READ)
  async getAuditLogs(
    @Param('id', ParseUUIDPipe) id: string,
    @Query() query: AuditQueryDto,
    @CurrentUser() user: JwtPayload,
  ) {
    if (
      user.identity_type !== (IdentityType.SUPER_ADMIN as string) &&
      user.tenant_id !== id
    ) {
      throw new ForbiddenException(
        'Cannot access audit logs of another tenant',
      );
    }

    query.tenant_id = id;
    return this.auditService.queryLogs(query);
  }
}
