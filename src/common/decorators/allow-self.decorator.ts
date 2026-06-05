import { SetMetadata } from '@nestjs/common';

export const ALLOW_SELF_KEY = 'allowSelf';

/**
 * Allow the route if the authenticated user is accessing their own resource.
 * @param param - The request param name holding the target user's ID (default: 'userId')
 */
export const AllowSelf = (param = 'userId') =>
  SetMetadata(ALLOW_SELF_KEY, param);
