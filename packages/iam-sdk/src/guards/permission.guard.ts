import { Injectable, CanActivate, ExecutionContext, ForbiddenException } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { PERMISSIONS_KEY } from '../decorators/require-permissions.decorator';
import { RequestContext } from '../interfaces/request-context.interface';
import { IdentityType } from '../constants/identity-types.constant';
import { hasPermission } from '../utils/permission-matcher.util';

@Injectable()
export class PermissionGuard implements CanActivate {
  constructor(private reflector: Reflector) {}

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

    // TODO: In Phase 4/5, inject CacheService/PermissionService to get effective permissions
    // const effectivePermissions = await this.permissionService.getEffectivePermissions(user.tenant_id, user.sub);
    const effectivePermissions = new Set<string>(); // Mock for now

    const hasAllRequired = requiredPermissions.every((perm) =>
      hasPermission(effectivePermissions, perm),
    );

    if (!hasAllRequired) {
      throw new ForbiddenException('Insufficient permissions');
    }

    return true;
  }
}
