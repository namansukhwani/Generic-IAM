import {
  Injectable,
  CanActivate,
  ExecutionContext,
  ForbiddenException,
  Logger,
} from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { IDENTITY_TYPES_KEY } from '../decorators/identity-types.decorator';
import { IdentityType } from '../constants/identity-types.constant';
import { RequestContext } from '../interfaces/request-context.interface';

@Injectable()
export class IdentityTypeGuard implements CanActivate {
  private readonly logger = new Logger(IdentityTypeGuard.name);
  constructor(private reflector: Reflector) {}

  canActivate(context: ExecutionContext): boolean {
    const requiredTypes = this.reflector.getAllAndOverride<IdentityType[]>(
      IDENTITY_TYPES_KEY,
      [context.getHandler(), context.getClass()],
    );
    if (!requiredTypes || requiredTypes.length === 0) {
      this.logger.log('IdentityTypeGuard | No required types');
      return true;
    }

    const request = context.switchToHttp().getRequest<RequestContext>();
    const user = request.user;

    if (!user || !user.identity_type) {
      throw new ForbiddenException('No identity type found');
    }

    this.logger.log(
      'IdentityTypeGuard | Required types: ' +
        JSON.stringify(requiredTypes) +
        ' User identity type: ' +
        user.identity_type,
    );
    if (!requiredTypes.includes(user.identity_type as IdentityType)) {
      throw new ForbiddenException(
        `Identity type ${user.identity_type} not allowed`,
      );
    }

    return true;
  }
}
