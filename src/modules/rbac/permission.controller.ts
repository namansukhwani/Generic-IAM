import { Controller, Get, Post, Delete, Param, UseGuards } from '@nestjs/common';
import { PermissionService } from './permission.service';
import { AuthGuard } from '@nestjs/passport';
import { CurrentUser } from '../../common/decorators/current-user.decorator';

@Controller()
@UseGuards(AuthGuard('jwt'))
export class PermissionController {
  constructor(private readonly permissionService: PermissionService) {}

  @Get('permissions')
  async getGlobalPermissions() {
    return this.permissionService.findAllGlobal();
  }

  @Post('roles/:roleId/permissions/:permissionId')
  async assignPermissionToRole(
    @Param('roleId') roleId: string,
    @Param('permissionId') permissionId: string,
    @CurrentUser() user: any
  ) {
    return this.permissionService.assignToRole(roleId, user.tenantId, permissionId, user.userId);
  }

  @Delete('roles/:roleId/permissions/:permissionId')
  async removePermissionFromRole(
    @Param('roleId') roleId: string,
    @Param('permissionId') permissionId: string,
    @CurrentUser() user: any
  ) {
    await this.permissionService.removeFromRole(roleId, user.tenantId, permissionId, user.userId);
    return { success: true };
  }
}
