import {
  Injectable,
  Inject,
  Logger,
  OnModuleInit,
  OnModuleDestroy,
} from '@nestjs/common';
import { CACHE_MANAGER } from '@nestjs/cache-manager';
import type { Cache } from 'cache-manager';
import { createClient, RedisClientType } from 'redis';
import { ConfigService } from '@nestjs/config';

@Injectable()
export class CacheService implements OnModuleInit, OnModuleDestroy {
  private readonly logger = new Logger(CacheService.name);
  private readonly ttlMs: number;
  private scanClient: RedisClientType;

  constructor(
    @Inject(CACHE_MANAGER) private cacheManager: Cache,
    @Inject('CACHE_REDIS_URL') private readonly redisUrl: string,
    private readonly configService: ConfigService,
  ) {
    this.ttlMs = this.configService.get<number>('redis.ttlMs', 300000);
  }

  async onModuleInit() {
    this.scanClient = createClient({ url: this.redisUrl }) as RedisClientType;
    await this.scanClient.connect();
  }

  async onModuleDestroy() {
    await this.scanClient.quit();
  }

  async get<T>(key: string): Promise<T | undefined> {
    const val = await this.cacheManager.get<T>(key);
    this.logger.log(
      `Cache GET | key=${key} hit=${val !== undefined && val !== null}`,
    );
    return val;
  }

  async set(key: string, value: any, ttlSeconds?: number): Promise<void> {
    const ttl = ttlSeconds !== undefined ? ttlSeconds * 1000 : undefined;
    this.logger.log(`Cache SET | key=${key} ttlMs=${ttl ?? this.ttlMs}`);
    await this.cacheManager.set(key, value, ttl);
  }

  // ── Permission set cache (perms:{tenantId}:{userId}) ──────────────────────

  async getPermissions(
    tenantId: string,
    userId: string,
  ): Promise<Set<string> | null> {
    const key = `perms:${tenantId}:${userId}`;
    const data = await this.cacheManager.get<string[]>(key);
    this.logger.log(`Cache getPermissions | key=${key} hit=${!!data}`);
    return data ? new Set(data) : null;
  }

  async setPermissions(
    tenantId: string,
    userId: string,
    permissions: Set<string>,
  ): Promise<void> {
    const key = `perms:${tenantId}:${userId}`;
    this.logger.log(
      `Cache setPermissions | key=${key} size=${permissions.size} ttlMs=${this.ttlMs}`,
    );
    await this.cacheManager.set(key, Array.from(permissions), this.ttlMs);
  }

  // ── Invalidation helpers ──────────────────────────────────────────────────

  async invalidateAclCache(
    tenantId: string,
    userId: string,
    resourceType: string,
    resourceId: string,
    permission: string,
  ): Promise<void> {
    const key = `acl:${tenantId}:${userId}:${resourceType}:${resourceId}:${permission}`;
    this.logger.log(`Cache invalidateAclCache | key=${key}`);
    await this.cacheManager.del(key);
  }

  /**
   * Clears the full permission set AND all individual authz: decisions for a
   * single user. Call after any per-user permission change (role assignment,
   * override add/remove).
   */
  async invalidateUserPermissionCache(
    tenantId: string,
    userId: string,
  ): Promise<void> {
    this.logger.log(
      `Cache invalidateUserPermissionCache | tenantId=${tenantId} userId=${userId}`,
    );
    await this.cacheManager.del(`perms:${tenantId}:${userId}`);
    await this.scanAndDelete(`authz:${tenantId}:${userId}:*`);
  }

  /**
   * Clears ALL permission caches for every user in a tenant. Call after a
   * role-level permission change (affects all users holding that role).
   */
  async invalidateTenantPermissionCache(tenantId: string): Promise<void> {
    this.logger.log(
      `Cache invalidateTenantPermissionCache | tenantId=${tenantId}`,
    );
    await this.scanAndDelete(`perms:${tenantId}:*`);
    await this.scanAndDelete(`authz:${tenantId}:*`);
  }

  /**
   * Clears the single authz: decision entry written by AuthorizationService.
   * Call after an ACL grant is created or revoked.
   */
  async invalidateAuthzDecision(
    tenantId: string,
    userId: string,
    permission: string,
    resourceType: string,
    resourceId: string,
  ): Promise<void> {
    const key = `authz:${tenantId}:${userId}:${permission}:${resourceType}:${resourceId}`;
    this.logger.log(`Cache invalidateAuthzDecision | key=${key}`);
    await this.cacheManager.del(key);
  }

  // ── Internal ──────────────────────────────────────────────────────────────

  private async scanAndDelete(pattern: string): Promise<void> {
    this.logger.log(`Cache scanAndDelete | pattern=${pattern}`);
    const keys: string[] = [];
    for await (const batch of this.scanClient.scanIterator({
      MATCH: pattern,
      COUNT: 100,
    })) {
      // scanIterator yields individual keys in newer @redis/client versions
      // and string arrays in older ones — handle both shapes.
      if (Array.isArray(batch)) {
        keys.push(...(batch as string[]));
      } else {
        keys.push(batch as string);
      }
    }
    this.logger.log(
      `Cache scanAndDelete keys found | count=${keys.length} keys=[${keys.join(', ')}]`,
    );
    if (keys.length > 0) {
      await this.scanClient.del(keys as [string, ...string[]]);
    }
  }
}
