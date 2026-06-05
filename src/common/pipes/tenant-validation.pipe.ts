import {
  PipeTransform,
  Injectable,
  ArgumentMetadata,
  BadRequestException,
} from '@nestjs/common';
import { TenantService } from '../../modules/tenant/tenant.service';
import { CacheService } from '../../cache/cache.service';

@Injectable()
export class TenantValidationPipe implements PipeTransform {
  constructor(
    private readonly tenantService: TenantService,
    private readonly cacheService: CacheService,
  ) {}

  public async transform(value: Record<string, unknown> | any, _metadata: ArgumentMetadata) {
    if (!value || typeof value !== 'object') {
      return value;
    }

    const tenantId = value.tenant_id as string;
    if (tenantId) {
      const cacheKey = `tenant_valid:${tenantId}`;
      const isCached = await this.cacheService.get(cacheKey);

      if (!isCached) {
        try {
          const tenant = await this.tenantService.findOne({ where: { id: tenantId } });
          if (!tenant || !tenant.is_active) {
            throw new BadRequestException('Invalid or inactive tenant');
          }
          await this.cacheService.set(cacheKey, 'true', 600); // 10 min TTL
        } catch (error) {
          throw new BadRequestException('Invalid or inactive tenant');
        }
      }
    }

    return value;
  }
}
