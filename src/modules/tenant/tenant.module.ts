import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { TenantService } from './tenant.service';
import { TenantController } from './tenant.controller';
import { TenantEntity } from './entities/tenant.entity';
import { UserEntity } from '../user/entities/user.entity';
import { RoleEntity } from '../rbac/entities/role.entity';
import { UserRoleEntity } from '../rbac/entities/user-role.entity';
import { AuditModule } from '../audit/audit.module';

@Module({
  imports: [
    TypeOrmModule.forFeature([
      TenantEntity,
      UserEntity,
      RoleEntity,
      UserRoleEntity,
    ]),
    AuditModule,
  ],
  controllers: [TenantController],
  providers: [TenantService],
  exports: [TenantService],
})
export class TenantModule {}
