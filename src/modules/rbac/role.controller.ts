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
import { CurrentUser } from '../../common/decorators/current-user.decorator';

@Controller('roles')
@UseGuards(AuthGuard('jwt'))
export class RoleController {
  constructor(private readonly roleService: RoleService) {}

  @Post()
  // @RequireTenantAdmin() -> To be implemented fully in Phase 6 with RBAC guard, but assuming logic allows it or manually checked
  async createRole(@Body() dto: CreateRoleDto, @CurrentUser() user: any) {
    // Requires Tenant_Admin logic will be handled by a global RBAC guard later,
    // but we have user.identityType or similar if we want.
    return this.roleService.createCustomRole(user.tenantId, dto, user.userId);
  }

  @Get()
  async getRoles(@CurrentUser() user: any) {
    return this.roleService.findAllForTenant(user.tenantId);
  }

  @Get(':id')
  async getRole(@Param('id') id: string, @CurrentUser() user: any) {
    return this.roleService.findOneForTenant(id, user.tenantId);
  }

  @Patch(':id')
  async updateRole(
    @Param('id') id: string,
    @Body() dto: Partial<CreateRoleDto>,
    @CurrentUser() user: any,
  ) {
    return this.roleService.updateCustomRole(
      id,
      user.tenantId,
      dto,
      user.userId,
    );
  }

  @Delete(':id')
  async deleteRole(@Param('id') id: string, @CurrentUser() user: any) {
    await this.roleService.deleteCustomRole(id, user.tenantId, user.userId);
    return { success: true };
  }
}
