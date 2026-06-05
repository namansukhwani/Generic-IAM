import { Module, Global } from '@nestjs/common';
import { APP_GUARD, APP_INTERCEPTOR, APP_FILTER } from '@nestjs/core';
import { ConfigService } from '@nestjs/config';
import { JwtAuthGuard, IdentityTypeGuard } from '@iam/nestjs-sdk';
import { IamPermissionGuard } from './guards/iam-permission.guard';
import { IamAclGuard } from './guards/iam-acl.guard';
import { CorrelationIdInterceptor } from './interceptors/correlation-id.interceptor';
import { ResponseTransformInterceptor } from './interceptors/response-transform.interceptor';
import { LoggingInterceptor } from './interceptors/logging.interceptor';
import { GlobalExceptionFilter } from './filters/global-exception.filter';

import { AuthorizationModule } from '../modules/authorization/authorization.module';
import { TenantModule } from '../modules/tenant/tenant.module';

@Global()
@Module({
  imports: [AuthorizationModule, TenantModule],
  providers: [
    {
      // JwtAuthGuard (from @iam/nestjs-sdk) injects JWT_SECRET by token rather
      // than consuming JwtModule, so we bridge ConfigService → string token here.
      provide: 'JWT_SECRET',
      useFactory: (config: ConfigService) => config.get<string>('jwt.secret'),
      inject: [ConfigService],
    },
    {
      provide: APP_GUARD,
      useClass: JwtAuthGuard,
    },
    {
      provide: APP_GUARD,
      useClass: IdentityTypeGuard,
    },
    {
      provide: APP_GUARD,
      useClass: IamPermissionGuard,
    },
    {
      provide: APP_GUARD,
      useClass: IamAclGuard,
    },
    {
      provide: APP_INTERCEPTOR,
      useClass: CorrelationIdInterceptor,
    },
    {
      provide: APP_INTERCEPTOR,
      useClass: ResponseTransformInterceptor,
    },
    {
      provide: APP_INTERCEPTOR,
      useClass: LoggingInterceptor,
    },
    {
      provide: APP_FILTER,
      useClass: GlobalExceptionFilter,
    },
  ],
  exports: [], // The APP_* providers automatically register globally
})
export class CommonModule {}
