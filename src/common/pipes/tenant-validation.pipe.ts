import {
  PipeTransform,
  Injectable,
  ArgumentMetadata,
  BadRequestException,
} from '@nestjs/common';

@Injectable()
export class TenantValidationPipe implements PipeTransform {
  public async transform(value: any, _metadata: ArgumentMetadata) {
    if (!value) {
      return value;
    }

    // Note: Assuming `value` contains tenant_id.
    // In Phase 4, we will use TenantService / Cache to validate the tenant_id.
    const tenantId = value.tenant_id;
    if (tenantId) {
      // TODO: Validate tenantId exists in DB/Cache
      // const isValid = await this.tenantService.isValid(tenantId);
      // if (!isValid) throw new BadRequestException('Invalid tenant');
    }

    return value;
  }
}
