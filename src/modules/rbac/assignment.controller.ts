import type { JwtPayload } from '../../common/interfaces/jwt-payload.interface';
import {
  Controller,
  Get,
  Patch,
  Post,
  Delete,
  Param,
  Body,
  UseGuards,
} from '@nestjs/common';
import { AssignmentService } from './assignment.service';
import { OverrideService } from './override.service';

import { UpdateUserRolesDto } from './dto/update-user-roles.dto';
import { CreateOverrideDto } from './dto/create-override.dto';
import { AuthGuard } from '@nestjs/passport';
import { CurrentUser } from '@iam/nestjs-sdk';

@Controller('users/:userId')
@UseGuards(AuthGuard('jwt'))
export class AssignmentController {
  constructor(
    private readonly assignmentService: AssignmentService,
    private readonly overrideService: OverrideService,
  ) {}

  // Roles

  @Patch('roles')
  async updateUserRoles(
    @Param('userId') targetUserId: string,
    @Body() dto: UpdateUserRolesDto,
    @CurrentUser() user: JwtPayload,
  ) {
    await this.assignmentService.updateUserRoles(
      targetUserId,
      user.tenant_id as string,
      dto,
      user.sub,
    );
    return { success: true };
  }

  @Get('roles')
  async getUserRoles(
    @Param('userId') targetUserId: string,
    @CurrentUser() user: JwtPayload,
  ) {
    return this.assignmentService.getUserRoles(
      targetUserId,
      user.tenant_id as string,
    );
  }

  // Overrides

  @Post('permission-overrides')
  async addOverride(
    @Param('userId') targetUserId: string,
    @Body() dto: CreateOverrideDto,
    @CurrentUser() user: JwtPayload,
  ) {
    return this.overrideService.addOverride(
      targetUserId,
      user.tenant_id as string,
      dto,
      user.sub,
    );
  }

  @Get('permission-overrides')
  async getOverrides(
    @Param('userId') targetUserId: string,
    @CurrentUser() user: JwtPayload,
  ) {
    return this.overrideService.getOverridesForUser(
      targetUserId,
      user.tenant_id as string,
    );
  }

  @Delete('permission-overrides/:overrideId')
  async removeOverride(
    @Param('userId') targetUserId: string,
    @Param('overrideId') overrideId: string,
    @CurrentUser() user: JwtPayload,
  ) {
    await this.overrideService.removeOverride(
      overrideId,
      targetUserId,
      user.tenant_id as string,
      user.sub,
    );
    return { success: true };
  }

  @Get('effective-permissions')
  async getEffectivePermissions(
    @Param('userId') targetUserId: string,
    @CurrentUser() user: JwtPayload,
  ) {
    return this.overrideService.getEffectivePermissions(
      targetUserId,
      user.tenant_id as string,
    );
  }
}
