import { Injectable, CanActivate, ExecutionContext, ForbiddenException } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { IDENTITY_TYPES_KEY } from '../decorators/identity-types.decorator';
import { IdentityType } from '../constants/identity-types.constant';
import { RequestContext } from '../interfaces/request-context.interface';

@Injectable()
export class IdentityTypeGuard implements CanActivate {
  constructor(private reflector: Reflector) {}

  canActivate(context: ExecutionContext): boolean {
    const requiredTypes = this.reflector.getAllAndOverride<IdentityType[]>(
      IDENTITY_TYPES_KEY,
      [context.getHandler(), context.getClass()],
    );
    if (!requiredTypes || requiredTypes.length === 0) {
      return true;
    }

    const request = context.switchToHttp().getRequest<RequestContext>();
    const user = request.user;

    if (!user || !user.identity_type) {
      throw new ForbiddenException('No identity type found');
    }

    if (!requiredTypes.includes(user.identity_type as IdentityType)) {
      throw new ForbiddenException(`Identity type ${user.identity_type} not allowed`);
    }

    return true;
  }
}
