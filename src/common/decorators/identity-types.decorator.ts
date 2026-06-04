import { SetMetadata } from '@nestjs/common';
import { IdentityType } from '../constants/identity-types.constant';

export const IDENTITY_TYPES_KEY = 'identityTypes';
export const IdentityTypes = (...types: IdentityType[]) => SetMetadata(IDENTITY_TYPES_KEY, types);
