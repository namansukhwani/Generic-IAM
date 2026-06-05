import { KAFKA_TOPICS } from '../common/constants/kafka.constant';
import { Controller } from '@nestjs/common';
import { EventPattern, Payload } from '@nestjs/microservices';
import { CacheService } from '../cache/cache.service';

export interface PermissionChangedEvent {
  tenant_id?: string;
  user_id?: string;
  payload?: {
    tenant_id?: string;
    user_id?: string;
    role_id?: string;
  };
}

@Controller()
export class EventConsumer {
  constructor(private readonly cacheService: CacheService) {}

  @EventPattern(KAFKA_TOPICS.IAM_PERMISSION_CHANGED)
  async handlePermissionChanged(@Payload() message: PermissionChangedEvent) {
    const tenantId = message.tenant_id || message.payload?.tenant_id;
    const userId = message.user_id || message.payload?.user_id;

    if (!tenantId) return;

    if (userId) {
      // Per-user change (role assigned/revoked, override added/removed):
      // clear both the full permission set and all individual authz: decisions
      await this.cacheService.invalidateUserPermissionCache(tenantId, userId);
    } else {
      // Role-level change (role permissions modified): all users in this tenant
      // who hold the affected role may have stale caches. Flush the tenant.
      await this.cacheService.invalidateTenantPermissionCache(tenantId);
    }
  }
}
