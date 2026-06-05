import type { JwtPayload } from '../../common/interfaces/jwt-payload.interface';
import { Controller, Get, Patch, Body, Param, UseGuards } from '@nestjs/common';
import { PermissionService } from './permission.service';
import { UpdateRolePermissionsDto } from './dto/update-role-permissions.dto';
import { AuthGuard } from '@nestjs/passport';
import { CurrentUser } from '@iam/nestjs-sdk';

import { RequirePermissions } from '@iam/nestjs-sdk';
import { SYSTEM_PERMISSIONS } from '../../common/constants/system-permissions.constant';

@Controller()
@UseGuards(AuthGuard('jwt'))
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
