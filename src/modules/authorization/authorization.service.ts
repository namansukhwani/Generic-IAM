import { Injectable, Logger } from '@nestjs/common';
import { OverrideService } from '../rbac/override.service';
import { AclService } from '../acl/acl.service';
import { CheckAuthzDto } from './dto/check-authz.dto';
import { EventProducer } from '../../event/event.producer';
import { hasPermission } from '@iam/nestjs-sdk';
import { CacheService } from '../../cache/cache.service';

@Injectable()
export class AuthorizationService {
  private readonly logger = new Logger(AuthorizationService.name);

  constructor(
    private readonly cacheService: CacheService,
    private readonly overrideService: OverrideService,
    private readonly aclService: AclService,
    private readonly eventProducer: EventProducer,
  ) {}

  private getCacheKey(dto: CheckAuthzDto): string {
    return `authz:${dto.tenant_id}:${dto.user_id}:${dto.permission}:${dto.resource_type || '*'}:${dto.resource_id || '*'}`;
  }

  async check(
    dto: CheckAuthzDto,
  ): Promise<{ allowed: boolean; source: string; evaluated_at: string }> {
    const authzKey = this.getCacheKey(dto);
    const now = new Date().toISOString();

    // Fast path: individual authz decision already cached (read by SDK via ioredis too)
    const cachedDecision = await this.cacheService.get<boolean>(authzKey);
    if (cachedDecision !== undefined && cachedDecision !== null) {
      this.logger.log(
        `authz cache hit | permission=${dto.permission} user_id=${dto.user_id} result=${cachedDecision}`,
      );
      return { allowed: cachedDecision, source: 'cache', evaluated_at: now };
    }

    // Medium path: full effective permission set is cached — check locally, no DB needed
    let effectiveSet = await this.cacheService.getPermissions(
      dto.tenant_id,
      dto.user_id,
    );

    if (!effectiveSet) {
      this.logger.log(
        `perms cache miss — computing from DB | user_id=${dto.user_id} tenant_id=${dto.tenant_id}`,
      );
      // DB path: compute effective permissions and populate the perms: cache so
      // subsequent checks for this user (different permissions) skip the DB entirely
      const effectivePermissions =
        await this.overrideService.getEffectivePermissions(
          dto.user_id,
          dto.tenant_id,
        );
      effectiveSet = new Set(effectivePermissions.map((p) => p.code));
      await this.cacheService.setPermissions(
        dto.tenant_id,
        dto.user_id,
        effectiveSet,
      );
    } else {
      this.logger.log(
        `perms cache hit | user_id=${dto.user_id} tenant_id=${dto.tenant_id}`,
      );
    }

    let allowed = hasPermission(effectiveSet, dto.permission);
    let source = 'rbac';

    this.logger.log(
      `RBAC decision | permission=${dto.permission} user_id=${dto.user_id} allowed=${allowed}`,
    );

    // ACL check: only if RBAC denied and a specific resource is provided
    if (!allowed && dto.resource_type && dto.resource_id) {
      this.logger.log(
        `RBAC denied — falling back to ACL | permission=${dto.permission} resource_type=${dto.resource_type} resource_id=${dto.resource_id} user_id=${dto.user_id}`,
      );
      const aclResult = await this.aclService.check(dto.tenant_id, {
        user_id: dto.user_id,
        permission: dto.permission,
        resource_type: dto.resource_type,
        resource_id: dto.resource_id,
      });
      allowed = aclResult.allowed;
      source = 'acl';
    }

    if (!allowed) {
      this.logger.warn(
        `Permission denied | permission=${dto.permission} user_id=${dto.user_id} tenant_id=${dto.tenant_id}`,
      );
    }

    // Write the individual decision so the SDK can read it directly from Redis
    await this.cacheService.set(authzKey, allowed, 300);

    return { allowed, source: allowed ? source : 'none', evaluated_at: now };
  }

  async checkBatch(
    dtos: CheckAuthzDto[],
  ): Promise<
    Array<{ allowed: boolean; source: string; evaluated_at: string }>
  > {
    return Promise.all(dtos.map((dto) => this.check(dto)));
  }
}
