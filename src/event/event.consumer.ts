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
  };
}

@Controller()
export class EventConsumer {
  constructor(private readonly cacheService: CacheService) {}

  @EventPattern(KAFKA_TOPICS.IAM_PERMISSION_CHANGED)
  async handlePermissionChanged(@Payload() message: PermissionChangedEvent) {
    const tenantId = message.tenant_id || message.payload?.tenant_id;
    const userId = message.user_id || message.payload?.user_id;

    if (tenantId && userId) {
      // Invalidate the cache for this user
      await this.cacheService.invalidatePermissions(tenantId, userId);
      console.log(
        `[EventConsumer] Invalidated permissions for user ${userId} (Tenant: ${tenantId})`,
      );
    }
  }
}
