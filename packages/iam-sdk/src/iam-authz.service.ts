import {
  Injectable,
  Inject,
  OnModuleDestroy,
  OnModuleInit,
} from '@nestjs/common';
import { Redis } from 'ioredis';
import { IamClientService } from './iam-client.service';

@Injectable()
export class IamAuthzService implements OnModuleInit, OnModuleDestroy {
  private redisClient: Redis;

  constructor(
    @Inject('REDIS_URL') private readonly redisUrl: string,
    private readonly iamClient: IamClientService,
  ) {}

  onModuleInit() {
    this.redisClient = new Redis(this.redisUrl);
  }

  onModuleDestroy() {
    this.redisClient.quit();
  }

  private getCacheKey(
    userId: string,
    tenantId: string,
    permission: string,
    resourceType?: string,
    resourceId?: string,
  ) {
    return `authz:${tenantId}:${userId}:${permission}:${resourceType || '*'}:${resourceId || '*'}`;
  }

  async isAllowed(
    userId: string,
    tenantId: string,
    permission: string,
    resourceType?: string,
    resourceId?: string,
  ): Promise<boolean> {
    const cacheKey = this.getCacheKey(
      userId,
      tenantId,
      permission,
      resourceType,
      resourceId,
    );

    // Check Redis cache directly (Read-only)
    const cached = await this.redisClient.get(cacheKey);
    if (cached !== null) {
      return cached === 'true';
    }

    // Call IAM Service if not in cache
    const result = await this.iamClient.checkAuthorization(
      userId,
      tenantId,
      permission,
      resourceType,
      resourceId,
    );

    // We DO NOT write back to cache here. The IAM service is responsible for cache hydration.
    return result.allowed;
  }
}
