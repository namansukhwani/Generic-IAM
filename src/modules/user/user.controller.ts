import {
  Controller,
  Get,
  Post,
  Body,
  Patch,
  Param,
  ParseUUIDPipe,
  Query,
} from '@nestjs/common';
import { ApiTags, ApiBearerAuth, ApiOperation } from '@nestjs/swagger';
import { UserService } from './user.service';
import { CreateUserDto } from './dto/create-user.dto';
import { UpdateUserDto } from './dto/update-user.dto';
import { UpdateUserStatusDto } from './dto/update-user-status.dto';
import { UserResponseDto } from './dto/user-response.dto';
import { IdentityTypes } from '@iam/nestjs-sdk';
import { IdentityType } from '../../common/constants/identity-types.constant';
import { RequirePermissions } from '@iam/nestjs-sdk';
import { SYSTEM_PERMISSIONS } from '../../common/constants/system-permissions.constant';
import { CurrentUser } from '@iam/nestjs-sdk';
import type { JwtPayload } from '../../common/interfaces/jwt-payload.interface';

import { AuthorizationService } from '../authorization/authorization.service';
import { ForbiddenException } from '@nestjs/common';

@ApiTags('Users')
@ApiBearerAuth()
@Controller('users')
export class UserController {
  constructor(
    private readonly userService: UserService,
    private readonly authzService: AuthorizationService,
  ) {}

  @Post()
  @ApiOperation({ summary: 'Create user in current tenant' })
  @IdentityTypes(IdentityType.USER, IdentityType.SUPER_ADMIN)
  @RequirePermissions(SYSTEM_PERMISSIONS.USER.WRITE)
  async create(
    @Body() createUserDto: CreateUserDto,
    @CurrentUser() user: JwtPayload,
  ) {
    const created = await this.userService.createUser(
      user.tenant_id || '',
      createUserDto,
      user.sub,
    );
    return new UserResponseDto(created);
  }

  @Get()
  @ApiOperation({ summary: 'List users in current tenant' })
  @IdentityTypes(IdentityType.USER, IdentityType.SUPER_ADMIN)
  @RequirePermissions(SYSTEM_PERMISSIONS.USER.READ)
  async findAll(
    @CurrentUser() user: JwtPayload,
    @Query('page') page = 1,
    @Query('limit') limit = 10,
  ) {
    const result = await this.userService.findPaginated(page, limit, {
      where: { tenant_id: user.tenant_id || '' },
      order: { created_at: 'DESC' },
    });
    return {
      data: result.data.map((u) => new UserResponseDto(u)),
      total: result.total,
      page,
      limit,
    };
  }

  @Get(':id')
  @ApiOperation({ summary: 'Get user details' })
  @IdentityTypes(IdentityType.USER, IdentityType.SUPER_ADMIN)
  async findOne(
    @Param('id', ParseUUIDPipe) id: string,
    @CurrentUser() user: JwtPayload,
  ) {
    // If self, allow without permission
    if (user.sub !== id) {
      const authz = await this.authzService.check({
        tenant_id: user.tenant_id as string,
        user_id: user.sub,
        permission: SYSTEM_PERMISSIONS.USER.READ,
      });
      if (!authz.allowed) {
        throw new ForbiddenException('Insufficient permissions');
      }
    }
    const target = await this.userService.findOne({ where: { id } });
    if (target.tenant_id !== user.tenant_id) {
      throw new Error('Not found'); // Keep generic to avoid leaking info
    }
    return new UserResponseDto(target);
  }

  @Patch(':id')
  @ApiOperation({ summary: 'Update user' })
  @IdentityTypes(IdentityType.USER, IdentityType.SUPER_ADMIN)
  async update(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() updateUserDto: UpdateUserDto,
    @CurrentUser() user: JwtPayload,
  ) {
    const updated = await this.userService.updateUser(
      id,
      updateUserDto,
      user.tenant_id || '',
      user.sub,
    );
    return new UserResponseDto(updated);
  }

  @Patch(':id/status')
  @ApiOperation({ summary: 'Update user status' })
  @IdentityTypes(IdentityType.USER, IdentityType.SUPER_ADMIN)
  @RequirePermissions(SYSTEM_PERMISSIONS.USER.WRITE)
  async updateStatus(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: UpdateUserStatusDto,
    @CurrentUser() user: JwtPayload,
  ) {
    await this.userService.setActivation(
      id,
      user.tenant_id || '',
      dto.is_active,
      user.sub,
    );
    return { success: true };
  }

  @Get(':id/hierarchy')
  @ApiOperation({ summary: 'Get user hierarchy' })
  @IdentityTypes(IdentityType.USER, IdentityType.SUPER_ADMIN)
  @RequirePermissions(SYSTEM_PERMISSIONS.USER.READ)
  async getHierarchy(
    @Param('id', ParseUUIDPipe) id: string,
    @CurrentUser() user: JwtPayload,
  ) {
    return this.userService.getHierarchy(id, user.tenant_id || '');
  }
}
