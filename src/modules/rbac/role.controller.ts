import type { JwtPayload } from '../../common/interfaces/jwt-payload.interface';
import {
  Controller,
  Post,
  Get,
  Patch,
  Delete,
  Param,
  Body,
  UseGuards,
  ParseUUIDPipe,
} from '@nestjs/common';
import { RoleService } from './role.service';
import { CreateRoleDto } from './dto/create-role.dto';
import { RequirePermissions, CurrentUser } from '@iam/nestjs-sdk';
import { SYSTEM_PERMISSIONS } from '../../common/constants/system-permissions.constant';
import { IamPermissionGuard } from '../../common/guards/iam-permission.guard';
import { IamAclGuard } from '../../common/guards/iam-acl.guard';

@Controller('roles')
@UseGuards(IamPermissionGuard, IamAclGuard)
export class RoleController {
  constructor(private readonly roleService: RoleService) {}

  @Post()
  @RequirePermissions(SYSTEM_PERMISSIONS.ROLE.WRITE)
  async createRole(
    @Body() dto: CreateRoleDto,
    @CurrentUser() user: JwtPayload,
  ) {
    // Requires Tenant_Admin logic will be handled by a global RBAC guard later,
    // but we have user.identityType or similar if we want.
    return this.roleService.createCustomRole(
      user.tenant_id as string,
      dto,
      user.sub,
    );
  }

  @Get()
  @RequirePermissions(SYSTEM_PERMISSIONS.ROLE.READ)
  async getRoles(@CurrentUser() user: JwtPayload) {
    return this.roleService.findAllForTenant(user.tenant_id as string);
  }

  @Get(':id')
  @RequirePermissions(SYSTEM_PERMISSIONS.ROLE.READ)
  async getRole(
    @Param('id', ParseUUIDPipe) id: string,
    @CurrentUser() user: JwtPayload,
  ) {
    return this.roleService.findOneForTenant(id, user.tenant_id as string);
  }

  @Patch(':id')
  @RequirePermissions(SYSTEM_PERMISSIONS.ROLE.WRITE)
  async updateRole(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: Partial<CreateRoleDto>,
    @CurrentUser() user: JwtPayload,
  ) {
    return this.roleService.updateCustomRole(
      id,
      user.tenant_id as string,
      dto,
      user.sub,
    );
  }

  @Delete(':id')
  @RequirePermissions(SYSTEM_PERMISSIONS.ROLE.WRITE)
  async deleteRole(
    @Param('id', ParseUUIDPipe) id: string,
    @CurrentUser() user: JwtPayload,
  ) {
    await this.roleService.deleteCustomRole(
      id,
      user.tenant_id as string,
      user.sub,
    );
    return { success: true };
  }
}
