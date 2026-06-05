import {
  Controller,
  Get,
  Post,
  Delete,
  Param,
  Body,
  UseGuards,
} from '@nestjs/common';
import { AssignmentService } from './assignment.service';
import { OverrideService } from './override.service';
import { AssignRoleDto } from './dto/assign-role.dto';
import { CreateOverrideDto } from './dto/create-override.dto';
import { AuthGuard } from '@nestjs/passport';
import { CurrentUser } from '../../common/decorators/current-user.decorator';

@Controller('users/:userId')
@UseGuards(AuthGuard('jwt'))
export class AssignmentController {
  constructor(
    private readonly assignmentService: AssignmentService,
    private readonly overrideService: OverrideService,
  ) {}

  // Roles

  @Post('roles')
  async assignRole(
    @Param('userId') targetUserId: string,
    @Body() dto: AssignRoleDto,
    @CurrentUser() user: any,
  ) {
    return this.assignmentService.assignToUser(
      targetUserId,
      user.tenantId,
      dto,
      user.userId,
    );
  }

  @Delete('roles/:roleId')
  async revokeRole(
    @Param('userId') targetUserId: string,
    @Param('roleId') roleId: string,
    @CurrentUser() user: any,
  ) {
    await this.assignmentService.revokeFromUser(
      targetUserId,
      roleId,
      user.tenantId,
      user.userId,
    );
    return { success: true };
  }

  @Get('roles')
  async getUserRoles(
    @Param('userId') targetUserId: string,
    @CurrentUser() user: any,
  ) {
    return this.assignmentService.getUserRoles(targetUserId, user.tenantId);
  }

  // Overrides

  @Post('permission-overrides')
  async addOverride(
    @Param('userId') targetUserId: string,
    @Body() dto: CreateOverrideDto,
    @CurrentUser() user: any,
  ) {
    return this.overrideService.addOverride(
      targetUserId,
      user.tenantId,
      dto,
      user.userId,
    );
  }

  @Get('permission-overrides')
  async getOverrides(
    @Param('userId') targetUserId: string,
    @CurrentUser() user: any,
  ) {
    return this.overrideService.getOverridesForUser(
      targetUserId,
      user.tenantId,
    );
  }

  @Delete('permission-overrides/:overrideId')
  async removeOverride(
    @Param('userId') targetUserId: string,
    @Param('overrideId') overrideId: string,
    @CurrentUser() user: any,
  ) {
    await this.overrideService.removeOverride(
      overrideId,
      targetUserId,
      user.tenantId,
      user.userId,
    );
    return { success: true };
  }

  @Get('effective-permissions')
  async getEffectivePermissions(
    @Param('userId') targetUserId: string,
    @CurrentUser() user: any,
  ) {
    return this.overrideService.getEffectivePermissions(
      targetUserId,
      user.tenantId,
    );
  }
}
