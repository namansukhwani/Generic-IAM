import {
  Injectable,
  ExecutionContext,
  ForbiddenException,
  Logger,
} from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import {
  AclGuard,
  ACL_KEY,
  AclMetadata,
  IdentityType,
  IamAuthzService,
} from '@iam/nestjs-sdk';
import { AuthorizationService } from '../../modules/authorization/authorization.service';
import { RequestContext } from '../interfaces/request-context.interface';

@Injectable()
export class IamAclGuard extends AclGuard {
  protected readonly logger = new Logger(IamAclGuard.name);

  constructor(
    protected reflector: Reflector,
    private readonly authorizationService: AuthorizationService,
  ) {
    super(reflector, null as unknown as IamAuthzService);
  }

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const reflector = this.reflector || (this as any).reflector;
    if (!reflector) {
      return true;
    }
    const isPublic = reflector.getAllAndOverride<boolean>('isPublic', [
      context.getHandler(),
      context.getClass(),
    ]);
    if (isPublic) {
      return true;
    }

    const aclMeta = reflector.getAllAndOverride<AclMetadata>(ACL_KEY, [
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

    if (user.identity_type === (IdentityType.SUPER_ADMIN as string)) {
      return true;
    }

    const resourceId = request.params[aclMeta.paramKey || 'id'];
    if (!resourceId) {
      throw new ForbiddenException('Resource ID not found in request');
    }

    const result = await this.authorizationService.check({
      tenant_id: user.tenant_id!,
      user_id: user.sub,
      permission: aclMeta.action,
      resource_type: aclMeta.resource,
      resource_id: resourceId as string,
    });

    if (!result.allowed) {
      this.logger.warn(
        `DENIED | user_id=${user.sub} tenant_id=${user.tenant_id} resource_type=${aclMeta.resource} resource_id=${resourceId} permission=${aclMeta.action}`,
      );
      throw new ForbiddenException('Insufficient resource ACL');
    }

    return true;
  }
}
