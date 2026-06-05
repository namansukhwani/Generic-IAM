import { DynamicModule, Module, Global } from '@nestjs/common';
import { IamClientService } from './iam-client.service';
import { PermissionCacheService } from './permission-cache.service';
import { CacheInvalidationConsumer } from './cache-invalidation.consumer';

export interface IamModuleOptions {
  iamUrl: string;
}

@Global()
@Module({})
export class IamModule {
  static forRoot(options: IamModuleOptions): DynamicModule {
    return {
      module: IamModule,
      providers: [
        {
          provide: 'IAM_URL',
          useValue: options.iamUrl,
        },
        IamClientService,
        PermissionCacheService,
      ],
      controllers: [CacheInvalidationConsumer],
      exports: [IamClientService, PermissionCacheService, 'IAM_URL'],
    };
  }
}
