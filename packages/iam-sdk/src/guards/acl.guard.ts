import { Injectable, CanActivate, ExecutionContext, ForbiddenException } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { ACL_KEY, AclMetadata } from '../decorators/require-acl.decorator';
import { RequestContext } from '../interfaces/request-context.interface';
import { IdentityType } from '../constants/identity-types.constant';

@Injectable()
export class AclGuard implements CanActivate {
  constructor(protected reflector: Reflector) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const aclMeta = this.reflector.getAllAndOverride<AclMetadata>(ACL_KEY, [
      context.getHandler(),
      context.getClass(),
    ]);

    if (!aclMeta) {
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

    const resourceId = request.params[aclMeta.paramKey || 'id'];
    if (!resourceId) {
      throw new ForbiddenException('Resource ID not found in request');
    }

    // TODO: In Phase 4/5, inject AclService to check DB/Redis for resource-level permission
    // const hasAcl = await this.aclService.checkAcl(user.tenant_id, user.sub, aclMeta.resource, resourceId, aclMeta.action);
    const hasAcl = false; // Mock

    if (!hasAcl) {
      throw new ForbiddenException('Insufficient resource ACL');
    }

    return true;
  }
}
