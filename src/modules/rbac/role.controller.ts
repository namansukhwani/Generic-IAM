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
} from '@nestjs/common';
import { RoleService } from './role.service';
import { CreateRoleDto } from './dto/create-role.dto';
import { AuthGuard } from '@nestjs/passport';
import { CurrentUser  } from '@iam/nestjs-sdk';

@Controller('roles')
@UseGuards(AuthGuard('jwt'))
export class RoleController {
  constructor(private readonly roleService: RoleService) {}

  @Post()
  // @RequireTenantAdmin() -> To be implemented fully in Phase 6 with RBAC guard, but assuming logic allows it or manually checked
  async createRole(@Body() dto: CreateRoleDto, @CurrentUser() user: JwtPayload) {
    // Requires Tenant_Admin logic will be handled by a global RBAC guard later,
    // but we have user.identityType or similar if we want.
    return this.roleService.createCustomRole((user.tenant_id as string), dto, user.sub);
  }

  @Get()
  async getRoles(@CurrentUser() user: JwtPayload) {
    return this.roleService.findAllForTenant((user.tenant_id as string));
  }

  @Get(':id')
  async getRole(@Param('id') id: string, @CurrentUser() user: JwtPayload) {
    return this.roleService.findOneForTenant(id, (user.tenant_id as string));
  }

  @Patch(':id')
  async updateRole(
    @Param('id') id: string,
    @Body() dto: Partial<CreateRoleDto>,
    @CurrentUser() user: JwtPayload,
  ) {
    return this.roleService.updateCustomRole(
      id,
      (user.tenant_id as string),
      dto,
      user.sub,
    );
  }

  @Delete(':id')
  async deleteRole(@Param('id') id: string, @CurrentUser() user: JwtPayload) {
    await this.roleService.deleteCustomRole(id, (user.tenant_id as string), user.sub);
    return { success: true };
  }
}
