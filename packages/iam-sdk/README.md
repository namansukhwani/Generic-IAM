# IAM NestJS SDK

A thin authz client for IAM service. It checks Redis directly for authorization and falls back to HTTP calls if not cached.

## Local Development Workflow

```bash
# In SDK directory
cd packages/iam-sdk
npm run build
npm link

# In consumer microservice
npm link @iam/nestjs-sdk

# In consumer app.module.ts
import { IamModule } from '@iam/nestjs-sdk';

IamModule.forRoot({
  iamUrl: 'http://localhost:3000',
  redisUrl: 'redis://localhost:6379'
})
```
