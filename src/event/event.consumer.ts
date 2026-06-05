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

export interface UserChangedEvent {
  tenant_id?: string;
  user_id?: string;
  event_type?: string;
}

export interface AclChangedEvent {
  tenant_id?: string;
  user_id?: string;
  resource_type?: string;
  resource_id?: string;
  payload?: {
    permission?: string;
  };
}

@Controller()
export class EventConsumer {
  private readonly logger = new Logger(EventConsumer.name);

  constructor(private readonly cacheService: CacheService) {}

  @EventPattern(KAFKA_TOPICS.IAM_USER_CHANGED)
  async handleUserChanged(@Payload() message: UserChangedEvent) {
    const { tenant_id, user_id, event_type } = message;

    if (!tenant_id || !user_id) {
      this.logger.warn(
        `user.changed missing required fields — skipping | tenant_id=${tenant_id} user_id=${user_id}`,
      );
      return;
    }

    this.logger.log(
      `user.changed received | event_type=${event_type} tenant_id=${tenant_id} user_id=${user_id}`,
    );

    await this.cacheService.invalidateUserPermissionCache(tenant_id, user_id);
  }

  @EventPattern(KAFKA_TOPICS.IAM_ACL_CHANGED)
  async handleAclChanged(@Payload() message: AclChangedEvent) {
    const { tenant_id, user_id, resource_type, resource_id } = message;
    const permission = message.payload?.permission;

    if (
      !tenant_id ||
      !user_id ||
      !resource_type ||
      !resource_id ||
      !permission
    ) {
      this.logger.warn(
        `acl.changed missing required fields — skipping | tenant_id=${tenant_id} user_id=${user_id} resource_type=${resource_type} resource_id=${resource_id} permission=${permission}`,
      );
      return;
    }

    this.logger.log(
      `acl.changed received | tenant_id=${tenant_id} user_id=${user_id} resource_type=${resource_type} resource_id=${resource_id} permission=${permission}`,
    );

    await this.cacheService.invalidateAclCache(
      tenant_id,
      user_id,
      resource_type,
      resource_id,
      permission,
    );
    await this.cacheService.invalidateAuthzDecision(
      tenant_id,
      user_id,
      permission,
      resource_type,
      resource_id,
    );
  }

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
