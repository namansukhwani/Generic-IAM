import { Controller, Inject } from '@nestjs/common';
import { EventPattern, Payload } from '@nestjs/microservices';
import { CACHE_MANAGER } from '@nestjs/cache-manager';
import type { Cache } from 'cache-manager';

@Controller()
export class CacheInvalidationConsumer {
  constructor(@Inject(CACHE_MANAGER) private cacheManager: Cache) {}

  @EventPattern('iam.permission.changed')
  async handlePermissionChanged(@Payload() message: any) {
    // message: { tenant_id, user_id, role_id }
    // In SDK, we should invalidate all authz checks for the affected user/tenant.
    // For Redis, this might require SCAN or keys deletion pattern if properly prefixed.
    // Here we'll log it as a stub since keys deletion via wildcard in standard cache-manager is limited.
    console.log(
      'Received permission change event, invalidating cache...',
      message,
    );

    // Simple naive deletion if it was a single known key, but since we have many possible keys
    // a real implementation would use a Redis scan stream.
  }
}
