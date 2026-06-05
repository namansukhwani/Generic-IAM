import { Injectable, Inject } from '@nestjs/common';
import { CACHE_MANAGER } from '@nestjs/cache-manager';
import type { Cache } from 'cache-manager';
import { OverrideService } from '../rbac/override.service';
import { AclService } from '../acl/acl.service';
import { CheckAuthzDto } from './dto/check-authz.dto';
import { EventProducer } from '../../event/event.producer';

@Injectable()
export class AuthorizationService {
  constructor(
    @Inject(CACHE_MANAGER) private cacheManager: Cache,
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
    const cacheKey = this.getCacheKey(dto);
    const cached = await this.cacheManager.get<boolean>(cacheKey);

    const now = new Date().toISOString();

    if (cached !== undefined && cached !== null) {
      return { allowed: cached, source: 'cache', evaluated_at: now };
    }

    // 1. Check RBAC
    const effectivePermissions =
      await this.overrideService.getEffectivePermissions(
        dto.user_id,
        dto.tenant_id,
      );
    let allowed = effectivePermissions.some((p) => p.action === dto.permission);
    let source = 'rbac';

    // 2. Check ACL if RBAC denied and resource is specified
    if (!allowed && dto.resource_type && dto.resource_id) {
      const aclResult = await this.aclService.check(dto.tenant_id, {
        user_id: dto.user_id,
        permission: dto.permission,
        resource_type: dto.resource_type,
        resource_id: dto.resource_id,
      });
      allowed = aclResult.allowed;
      source = 'acl';
    }

    // Cache the result (5 minutes)
    await this.cacheManager.set(cacheKey, allowed, 300000);

    return { allowed, source: allowed ? source : 'none', evaluated_at: now };
  }

  async checkBatch(
    dtos: CheckAuthzDto[],
  ): Promise<
    Array<{ allowed: boolean; source: string; evaluated_at: string }>
  > {
    const results = await Promise.all(dtos.map((dto) => this.check(dto)));
    return results;
  }
}
