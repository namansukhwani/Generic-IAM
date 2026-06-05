import {
  Injectable,
  CanActivate,
  ExecutionContext,
  ForbiddenException,
  Logger,
} from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { ACL_KEY, AclMetadata } from '../decorators/require-acl.decorator';
import { RequestContext } from '../interfaces/request-context.interface';
import { IdentityType } from '../constants/identity-types.constant';

import { IamAuthzService } from '../iam-authz.service';

@Injectable()
export class AclGuard implements CanActivate {
  protected readonly logger = new Logger(AclGuard.name);

  constructor(
    protected reflector: Reflector,
    protected authzService: IamAuthzService,
  ) {}

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

    if ((user.identity_type as IdentityType) === IdentityType.SUPER_ADMIN) {
      return true;
    }

    const resourceId = request.params[aclMeta.paramKey || 'id'] as string;
    if (!resourceId) {
      throw new ForbiddenException('Resource ID not found in request');
    }

    const hasAcl = await this.authzService.isAllowed(
      user.sub,
      user.tenant_id as string,
      aclMeta.action,
      aclMeta.resource,
      resourceId,
    );

    if (!hasAcl) {
      this.logger.warn(
        `DENIED | user_id=${user.sub} tenant_id=${user.tenant_id} resource_type=${aclMeta.resource} resource_id=${resourceId} permission=${aclMeta.action}`,
      );
      throw new ForbiddenException('Insufficient resource ACL');
    }

    return true;
  }
}
