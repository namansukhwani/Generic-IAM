import { Injectable, Inject } from '@nestjs/common';

@Injectable()
export class IamClientService {
  constructor(@Inject('IAM_URL') private readonly iamUrl: string) {}

  async checkAuthorization(
    userId: string,
    tenantId: string,
    permission: string,
    resourceType?: string,
    resourceId?: string,
  ): Promise<{ allowed: boolean }> {
    try {
      const response = await fetch(`${this.iamUrl}/authorization/check`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          user_id: userId,
          tenant_id: tenantId,
          permission,
          resource_type: resourceType,
          resource_id: resourceId,
        }),
      });

      if (!response.ok) {
        return { allowed: false };
      }

      return response.json();
    } catch (e) {
      console.error('Failed to check authorization against IAM service', e);
      return { allowed: false };
    }
  }
}
