import { DynamicModule, Module, Global } from '@nestjs/common';
import { IamClientService } from './iam-client.service';
import { IamAuthzService } from './iam-authz.service';

export interface IamModuleOptions {
  iamUrl: string;
  redisUrl: string;
  jwtSecret: string;
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
        {
          provide: 'JWT_SECRET',
          useValue: options.jwtSecret,
        },
        IamClientService,
        IamAuthzService,
      ],
      exports: [IamClientService, IamAuthzService, 'IAM_URL', 'JWT_SECRET'],
    };
  }
}
