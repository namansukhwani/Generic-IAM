import { Injectable, Inject } from '@nestjs/common';
import { CACHE_MANAGER } from '@nestjs/cache-manager';
import type { Cache } from 'cache-manager';
import { IamClientService } from './iam-client.service';

@Injectable()
export class PermissionCacheService {
  constructor(
    @Inject(CACHE_MANAGER) private cacheManager: Cache,
    private readonly iamClient: IamClientService
  ) {}

  private getCacheKey(userId: string, tenantId: string, permission: string, resourceType?: string, resourceId?: string) {
    return `authz:${tenantId}:${userId}:${permission}:${resourceType || '*'}:${resourceId || '*'}`;
  }

  async isAllowed(userId: string, tenantId: string, permission: string, resourceType?: string, resourceId?: string): Promise<boolean> {
    const cacheKey = this.getCacheKey(userId, tenantId, permission, resourceType, resourceId);
    
    // Check local Redis cache
    const cached = await this.cacheManager.get<boolean>(cacheKey);
    if (cached !== undefined && cached !== null) {
      return cached;
    }

    // Call IAM Service
    const result = await this.iamClient.checkAuthorization(userId, tenantId, permission, resourceType, resourceId);
    
    // Cache result
    await this.cacheManager.set(cacheKey, result.allowed, 300000); // 5 mins

    return result.allowed;
  }
}
