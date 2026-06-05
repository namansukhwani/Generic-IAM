import { Injectable, Inject } from '@nestjs/common';
import { CACHE_MANAGER } from '@nestjs/cache-manager';
import type { Cache } from 'cache-manager';

@Injectable()
export class CacheService {
  private readonly TTL_SECONDS = 300;

  constructor(@Inject(CACHE_MANAGER) private cacheManager: Cache) {}

  async get<T>(key: string): Promise<T | undefined> {
    return this.cacheManager.get<T>(key);
  }

  async set(key: string, value: any, ttlSeconds?: number): Promise<void> {
    // cache-manager set can take TTL in milliseconds
    const ttl = ttlSeconds !== undefined ? ttlSeconds * 1000 : undefined;
    await this.cacheManager.set(key, value, ttl);
  }

  async getPermissions(
    tenantId: string,
    userId: string,
  ): Promise<Set<string> | null> {
    const key = `perms:${tenantId}:${userId}`;
    const data = await this.cacheManager.get<string[]>(key);
    return data ? new Set(data) : null;
  }

  async setPermissions(
    tenantId: string,
    userId: string,
    permissions: Set<string>,
  ): Promise<void> {
    const key = `perms:${tenantId}:${userId}`;
    // Convert set to array for JSON serialization
    await this.cacheManager.set(
      key,
      Array.from(permissions),
      this.TTL_SECONDS * 1000,
    );
  }

  async invalidatePermissions(tenantId: string, userId: string): Promise<void> {
    const key = `perms:${tenantId}:${userId}`;
    await this.cacheManager.del(key);
  }

  async getAcl(
    tenantId: string,
    userId: string,
    resourceType: string,
    resourceId: string,
  ): Promise<boolean | null> {
    const key = `acl:${tenantId}:${userId}:${resourceType}:${resourceId}`;
    return (await this.cacheManager.get<boolean>(key)) ?? null;
  }

  async setAcl(
    tenantId: string,
    userId: string,
    resourceType: string,
    resourceId: string,
    allowed: boolean,
  ): Promise<void> {
    const key = `acl:${tenantId}:${userId}:${resourceType}:${resourceId}`;
    await this.cacheManager.set(key, allowed, this.TTL_SECONDS * 1000);
  }

  async invalidateAcl(
    tenantId: string,
    userId: string,
    resourceType: string,
    resourceId: string,
  ): Promise<void> {
    const key = `acl:${tenantId}:${userId}:${resourceType}:${resourceId}`;
    await this.cacheManager.del(key);
  }
}
