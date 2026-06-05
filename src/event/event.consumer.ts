import { KAFKA_TOPICS } from '../common/constants/kafka.constant';
import { Controller, Logger } from '@nestjs/common';
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
  private readonly logger = new Logger(EventConsumer.name);

  constructor(private readonly cacheService: CacheService) {}

  @EventPattern(KAFKA_TOPICS.IAM_PERMISSION_CHANGED)
  async handlePermissionChanged(@Payload() message: PermissionChangedEvent) {
    const tenantId = message.tenant_id || message.payload?.tenant_id;
    const userId = message.user_id || message.payload?.user_id;

    if (!tenantId) {
      this.logger.warn('No tenant_id in permission.changed event — skipping');
      return;
    }

    this.logger.log(
      `permission.changed received | tenant_id=${tenantId} user_id=${userId ?? 'N/A'}`,
    );

    if (userId) {
      this.logger.log(
        `Invalidating user permission cache | tenant_id=${tenantId} user_id=${userId}`,
      );
      await this.cacheService.invalidateUserPermissionCache(tenantId, userId);
    } else {
      this.logger.log(
        `Invalidating tenant permission cache | tenant_id=${tenantId}`,
      );
      await this.cacheService.invalidateTenantPermissionCache(tenantId);
    }
  }
}
