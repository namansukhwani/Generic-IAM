import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { ScheduleModule } from '@nestjs/schedule';

import appConfig from './config/app.config';
import databaseConfig from './config/database.config';
import jwtConfig from './config/jwt.config';
import redisConfig from './config/redis.config';
import kafkaConfig from './config/kafka.config';

import { DatabaseModule } from './database/database.module';
import { TenantTransactionInterceptor } from './common/interceptors/tenant-transaction.interceptor';
import { APP_INTERCEPTOR } from '@nestjs/core';
import { CommonModule } from './common/common.module';
import { CacheModule } from './cache/cache.module';
import { EventModule } from './event/event.module';
import { TenantModule } from './modules/tenant/tenant.module';
import { UserModule } from './modules/user/user.module';
import { AuthModule } from './modules/auth/auth.module';
import { RbacModule } from './modules/rbac/rbac.module';
import { AclModule } from './modules/acl/acl.module';
import { AuthorizationModule } from './modules/authorization/authorization.module';
import { SuperAdminModule } from './modules/super-admin/super-admin.module';
import { AuditModule } from './modules/audit/audit.module';
import { HealthModule } from './health/health.module';

@Module({
  imports: [
    ConfigModule.forRoot({
      isGlobal: true,
      load: [appConfig, databaseConfig, jwtConfig, redisConfig, kafkaConfig],
    }),
    ScheduleModule.forRoot(),
    DatabaseModule,
    CommonModule,
    CacheModule,
    EventModule,
    TenantModule,
    UserModule,
    AuthModule,
    RbacModule,
    AclModule,
    AuthorizationModule,
    SuperAdminModule,
    AuditModule,
    HealthModule,
  ],
  controllers: [],
  providers: [
    {
      provide: APP_INTERCEPTOR,
      useClass: TenantTransactionInterceptor,
    },
  ],
})
export class AppModule {}
