import { Controller } from '@nestjs/common';
import {
  EventPattern,
  Payload,
  Ctx,
  KafkaContext,
} from '@nestjs/microservices';
import { CacheService } from '../cache/cache.service';

@Controller()
export class EventConsumer {
  constructor(private readonly cacheService: CacheService) {}

  @EventPattern('iam.permission.changed')
  async handlePermissionChanged(
    @Payload() message: any,
    @Ctx() context: KafkaContext,
  ) {
    // Expected payload: { tenant_id: string, user_id: string }
    const { payload } = message;

    if (payload && payload.tenant_id && payload.user_id) {
      // Invalidate the cache for this user
      await this.cacheService.invalidatePermissions(
        payload.tenant_id,
        payload.user_id,
      );
      console.log(
        `[EventConsumer] Invalidated permissions for user ${payload.user_id} (Tenant: ${payload.tenant_id})`,
      );
    }
  }
}
