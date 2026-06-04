import { Module } from '@nestjs/common';
import { AuthorizationService } from './authorization.service';
import { AuthorizationController } from './authorization.controller';
import { RbacModule } from '../rbac/rbac.module';
import { AclModule } from '../acl/acl.module';
import { EventModule } from '../../event/event.module';

@Module({
  imports: [RbacModule, AclModule, EventModule],
  controllers: [AuthorizationController],
  providers: [AuthorizationService],
  exports: [AuthorizationService],
})
export class AuthorizationModule {}
