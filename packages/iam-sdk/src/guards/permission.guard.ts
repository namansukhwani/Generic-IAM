import {
  Injectable,
  CanActivate,
  ExecutionContext,
  ForbiddenException,
  Logger,
} from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { PERMISSIONS_KEY } from '../decorators/require-permissions.decorator';
import { RequestContext } from '../interfaces/request-context.interface';
import { IdentityType } from '../constants/identity-types.constant';
import { IamAuthzService } from '../iam-authz.service';

@Injectable()
export class PermissionGuard implements CanActivate {
  protected readonly logger = new Logger(PermissionGuard.name);

  constructor(
    protected readonly reflector: Reflector,
    protected authzService: IamAuthzService,
  ) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const requiredPermissions = this.reflector.getAllAndOverride<string[]>(
      PERMISSIONS_KEY,
      [context.getHandler(), context.getClass()],
    );

    if (!requiredPermissions || requiredPermissions.length === 0) {
      return true;
    }

    const request = context.switchToHttp().getRequest<RequestContext>();
    const user = request.user;

    if (!user) {
      throw new ForbiddenException('Authentication required');
    }

    if ((user.identity_type as IdentityType) === IdentityType.SUPER_ADMIN) {
      return true;
    }

    for (const perm of requiredPermissions) {
      const isAllowed = await this.authzService.isAllowed(
        user.sub,
        user.tenant_id as string,
        perm,
      );
      if (!isAllowed) {
        this.logger.warn(
          `DENIED | user_id=${user.sub} tenant_id=${user.tenant_id} required=${perm}`,
        );
        throw new ForbiddenException('Insufficient permissions');
      }
    }

    return true;
  }
}
