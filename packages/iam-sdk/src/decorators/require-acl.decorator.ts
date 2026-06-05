import { SetMetadata } from '@nestjs/common';

export const ACL_KEY = 'acl';

export interface AclMetadata {
  resource: string;
  action: string;
  paramKey?: string; // which route parameter contains the resource ID
}

export const RequireAcl = (
  resource: string,
  action: string,
  paramKey: string = 'id',
) => SetMetadata(ACL_KEY, { resource, action, paramKey });
