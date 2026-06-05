import { Injectable, CanActivate, ExecutionContext, ForbiddenException } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { PERMISSIONS_KEY } from '../decorators/require-permissions.decorator';
import { RequestContext } from '../interfaces/request-context.interface';
import { IdentityType } from '../constants/identity-types.constant';
import { hasPermission } from '../utils/permission-matcher.util';
import { IamAuthzService } from '../iam-authz.service';

@Injectable()
export class PermissionGuard implements CanActivate {
  constructor(
    protected reflector: Reflector,
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

    if (user.identity_type === IdentityType.SUPER_ADMIN) {
      return true;
    }

    // In Phase 4/5, inject CacheService/PermissionService to get effective permissions
    // We iterate over required permissions and check each one
    for (const perm of requiredPermissions) {
      const isAllowed = await this.authzService.isAllowed(
        user.sub,
        user.tenant_id as string,
        perm,
      );
      if (!isAllowed) {
        throw new ForbiddenException('Insufficient permissions');
      }
    }

    return true;
  }
}
