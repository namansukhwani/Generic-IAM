import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { ResourceAclEntity } from './entities/resource-acl.entity';
import { AclService } from './acl.service';
import { AclController } from './acl.controller';
import { EventModule } from '../../event/event.module';
import { CacheModule } from '../../cache/cache.module';

@Module({
  imports: [TypeOrmModule.forFeature([ResourceAclEntity]), EventModule, CacheModule],
  controllers: [AclController],
  providers: [AclService],
  exports: [AclService],
})
export class AclModule {}
