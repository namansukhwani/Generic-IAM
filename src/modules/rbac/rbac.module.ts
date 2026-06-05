import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { RoleEntity } from './entities/role.entity';
import { PermissionEntity } from './entities/permission.entity';
import { RolePermissionEntity } from './entities/role-permission.entity';
import { UserRoleEntity } from './entities/user-role.entity';
import { UserPermissionOverrideEntity } from './entities/user-permission-override.entity';
import { UserEntity } from '../user/entities/user.entity';

import { RoleService } from './role.service';
import { PermissionService } from './permission.service';
import { AssignmentService } from './assignment.service';
import { OverrideService } from './override.service';

import { RoleController } from './role.controller';
import { PermissionController } from './permission.controller';
import { AssignmentController } from './assignment.controller';

import { EventModule } from '../../event/event.module';

@Module({
  imports: [
    TypeOrmModule.forFeature([
      RoleEntity,
      PermissionEntity,
      RolePermissionEntity,
      UserRoleEntity,
      UserPermissionOverrideEntity,
      UserEntity,
    ]),
    EventModule,
  ],
  controllers: [RoleController, PermissionController, AssignmentController],
  providers: [
    RoleService,
    PermissionService,
    AssignmentService,
    OverrideService,
  ],
  exports: [RoleService, PermissionService, AssignmentService, OverrideService],
})
export class RbacModule {}
