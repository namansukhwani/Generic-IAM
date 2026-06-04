import { Module, MiddlewareConsumer, RequestMethod } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { AppController } from './app.controller';
import { AppService } from './app.service';

import appConfig from './config/app.config';
import databaseConfig from './config/database.config';
import jwtConfig from './config/jwt.config';
import redisConfig from './config/redis.config';
import kafkaConfig from './config/kafka.config';

import { DatabaseModule } from './database/database.module';
import { TenantContextMiddleware } from './common/middleware/tenant-context.middleware';
import { CommonModule } from './common/common.module';
import { CacheModule } from './cache/cache.module';
import { EventModule } from './event/event.module';
import { TenantModule } from './modules/tenant/tenant.module';
import { UserModule } from './modules/user/user.module';
import { AuthModule } from './modules/auth/auth.module';
import { RbacModule } from './modules/rbac/rbac.module';
import { AclModule } from './modules/acl/acl.module';

@Module({
  imports: [
    ConfigModule.forRoot({
      isGlobal: true,
      load: [appConfig, databaseConfig, jwtConfig, redisConfig, kafkaConfig],
    }),
    DatabaseModule,
    CommonModule,
    CacheModule,
    EventModule,
    TenantModule,
    UserModule,
    AuthModule,
    RbacModule,
    AclModule,
  ],
  controllers: [AppController],
  providers: [AppService],
})
export class AppModule {
  configure(consumer: MiddlewareConsumer) {
    consumer
      .apply(TenantContextMiddleware)
      .exclude({ path: 'health/(.*)', method: RequestMethod.ALL })
      .forRoutes('*');
  }
}
