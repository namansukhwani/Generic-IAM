import { Module, Global } from '@nestjs/common';
import { APP_GUARD, APP_INTERCEPTOR, APP_FILTER, APP_PIPE } from '@nestjs/core';
import { JwtAuthGuard } from './guards/jwt-auth.guard';
import { IdentityTypeGuard } from './guards/identity-type.guard';
import { PermissionGuard } from './guards/permission.guard';
import { AclGuard } from './guards/acl.guard';
import { CorrelationIdInterceptor } from './interceptors/correlation-id.interceptor';
import { ResponseTransformInterceptor } from './interceptors/response-transform.interceptor';
import { GlobalExceptionFilter } from './filters/global-exception.filter';
import { TenantValidationPipe } from './pipes/tenant-validation.pipe';

@Global()
@Module({
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
      useClass: PermissionGuard,
    },
    {
      provide: APP_GUARD,
      useClass: AclGuard,
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
