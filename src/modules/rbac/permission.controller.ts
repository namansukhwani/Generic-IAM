import type { JwtPayload } from '../../common/interfaces/jwt-payload.interface';
import {
  Controller,
  Get,
  Post,
  Delete,
  Param,
  UseGuards,
} from '@nestjs/common';
import { PermissionService } from './permission.service';
import { AuthGuard } from '@nestjs/passport';
import { CurrentUser  } from '@iam/nestjs-sdk';

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
    @CurrentUser() user: JwtPayload,
  ) {
    return this.permissionService.assignToRole(
      roleId,
      (user.tenant_id as string),
      permissionId,
      user.sub,
    );
  }

  @Delete('roles/:roleId/permissions/:permissionId')
  async removePermissionFromRole(
    @Param('roleId') roleId: string,
    @Param('permissionId') permissionId: string,
    @CurrentUser() user: JwtPayload,
  ) {
    await this.permissionService.removeFromRole(
      roleId,
      (user.tenant_id as string),
      permissionId,
      user.sub,
    );
    return { success: true };
  }
}
