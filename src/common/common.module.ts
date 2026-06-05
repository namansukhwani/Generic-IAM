import { Module, Global } from '@nestjs/common';
import { APP_GUARD, APP_INTERCEPTOR, APP_FILTER, APP_PIPE } from '@nestjs/core';
import { JwtAuthGuard, IdentityTypeGuard } from '@iam/nestjs-sdk';
import { IamPermissionGuard } from './guards/iam-permission.guard';
import { IamAclGuard } from './guards/iam-acl.guard';
import { CorrelationIdInterceptor } from './interceptors/correlation-id.interceptor';
import { ResponseTransformInterceptor } from './interceptors/response-transform.interceptor';
import { LoggingInterceptor } from './interceptors/logging.interceptor';
import { GlobalExceptionFilter } from './filters/global-exception.filter';
import { TenantValidationPipe } from './pipes/tenant-validation.pipe';

import { AuthorizationModule } from '../modules/authorization/authorization.module';

@Global()
@Module({
  imports: [AuthorizationModule],
  providers: [
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
    {
      provide: APP_PIPE,
      useClass: TenantValidationPipe,
    },
  ],
  exports: [], // The APP_* providers automatically register globally
})
export class CommonModule {}
