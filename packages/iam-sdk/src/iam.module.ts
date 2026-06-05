import { DynamicModule, Module, Global } from '@nestjs/common';
import { IamClientService } from './iam-client.service';
import { IamAuthzService } from './iam-authz.service';

export interface IamModuleOptions {
  iamUrl: string;
  redisUrl: string;
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
        {
          provide: 'REDIS_URL',
          useValue: options.redisUrl,
        },
        IamClientService,
        IamAuthzService,
      ],
      exports: [IamClientService, IamAuthzService, 'IAM_URL'],
    };
  }
}
