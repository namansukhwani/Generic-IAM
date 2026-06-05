import type { JwtPayload } from '../../common/interfaces/jwt-payload.interface';
import { Controller, Get, Patch, Body, Param, UseGuards } from '@nestjs/common';
import { PermissionService } from './permission.service';
import { UpdateRolePermissionsDto } from './dto/update-role-permissions.dto';
import { CurrentUser } from '@iam/nestjs-sdk';

import { RequirePermissions } from '@iam/nestjs-sdk';
import { SYSTEM_PERMISSIONS } from '../../common/constants/system-permissions.constant';
import { IamAclGuard } from '../../common/guards/iam-acl.guard';
import { IamPermissionGuard } from '../../common/guards/iam-permission.guard';

@Controller()
@UseGuards(IamPermissionGuard, IamAclGuard)
export class PermissionController {
  constructor(private readonly permissionService: PermissionService) {}

  @Get('permissions')
  @RequirePermissions(SYSTEM_PERMISSIONS.ROLE.READ)
  async getSystemPermissions() {
    return this.permissionService.findAllGlobal();
  }

  @Patch('roles/:id/permissions')
  @RequirePermissions(SYSTEM_PERMISSIONS.ROLE.WRITE)
  async assignPermissions(
    @Param('id') roleId: string,
    @Body() dto: UpdateRolePermissionsDto,
    @CurrentUser() user: JwtPayload,
  ) {
    await this.permissionService.updateRolePermissions(
      roleId,
      user.tenant_id as string,
      dto,
      user.sub,
    );
    return { success: true };
  }
}
