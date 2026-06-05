import type { JwtPayload } from '../../common/interfaces/jwt-payload.interface';
import {
  Controller,
  Get,
  Post,
  Patch,
  Body,
  Param,
  UseGuards,
} from '@nestjs/common';
import { PermissionService } from './permission.service';
import { UpdateRolePermissionsDto } from './dto/update-role-permissions.dto';
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

  @Patch('roles/:id/permissions')
  async updateRolePermissions(
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
