import {
  Injectable,
  Inject,
  Logger,
  OnModuleDestroy,
  OnModuleInit,
} from '@nestjs/common';
import { Redis } from 'ioredis';
import { IamClientService } from './iam-client.service';
import { hasPermission } from './utils/permission-matcher.util';

@Injectable()
export class IamAuthzService implements OnModuleInit, OnModuleDestroy {
  private readonly logger = new Logger(IamAuthzService.name);
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

  private getPermsKey(userId: string, tenantId: string): string {
    return `perms:${tenantId}:${userId}`;
  }

  private getAuthzKey(
    userId: string,
    tenantId: string,
    permission: string,
    resourceType?: string,
    resourceId?: string,
  ): string {
    return `authz:${tenantId}:${userId}:${permission}:${resourceType || '*'}:${resourceId || '*'}`;
  }

  async isAllowed(
    userId: string,
    tenantId: string,
    permission: string,
    resourceType?: string,
    resourceId?: string,
  ): Promise<boolean> {
    // Tier 1: full effective permission set — check locally without an HTTP call.
    // The IAM service populates this key on every authorization check and clears
    // it on every permission change, so it is always fresh when present.
    const permsRaw = await this.redisClient.get(
      this.getPermsKey(userId, tenantId),
    );
    if (permsRaw !== null) {
      const perms: string[] = JSON.parse(permsRaw);
      const allowed = hasPermission(new Set(perms), permission);
      this.logger.log(
        `perms cache hit (tier 1) | user_id=${userId} tenant_id=${tenantId} permission=${permission} allowed=${allowed}`,
      );
      // ACL check cannot be done locally — fall through to IAM only when
      // the RBAC set denies and a specific resource is involved.
      if (allowed || !resourceType || !resourceId) {
        return allowed;
      }
      // RBAC denied + resource specified: fall through to per-permission cache / IAM
    }

    // Tier 2: individual authz decision cached by IAM service (fast for known permissions)
    const authzKey = this.getAuthzKey(
      userId,
      tenantId,
      permission,
      resourceType,
      resourceId,
    );
    const cached = await this.redisClient.get(authzKey);
    if (cached !== null) {
      this.logger.log(
        `authz cache hit (tier 2) | user_id=${userId} tenant_id=${tenantId} permission=${permission} result=${cached}`,
      );
      return cached === 'true';
    }

    // Tier 3: call IAM service — it will hydrate both caches for next time
    this.logger.log(
      `cache miss — calling IAM service (tier 3) | user_id=${userId} tenant_id=${tenantId} permission=${permission}`,
    );
    const result = await this.iamClient.checkAuthorization(
      userId,
      tenantId,
      permission,
      resourceType,
      resourceId,
    );

    if (!result.allowed) {
      this.logger.warn(
        `Permission denied by IAM | user_id=${userId} tenant_id=${tenantId} permission=${permission}`,
      );
    }

    return result.allowed;
  }
}
