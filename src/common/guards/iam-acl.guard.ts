import {
  Injectable,
  ExecutionContext,
  ForbiddenException,
  Logger,
  CanActivate,
} from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { ACL_KEY, AclMetadata, IdentityType } from '@iam/nestjs-sdk';
import { AuthorizationService } from '../../modules/authorization/authorization.service';
import { RequestContext } from '../interfaces/request-context.interface';

@Injectable()
export class IamAclGuard implements CanActivate {
  private readonly logger = new Logger(IamAclGuard.name);

  constructor(
    private readonly reflector: Reflector,
    private readonly authorizationService: AuthorizationService,
  ) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const aclMeta = this.reflector.getAllAndOverride<AclMetadata>(ACL_KEY, [
      context.getHandler(),
      context.getClass(),
    ]);

    if (!aclMeta) {
      this.logger.log('ACL Metadata Not Found');
      return true;
    }

    const request = context.switchToHttp().getRequest<RequestContext>();
    const user = request.user;

    if (!user) {
      throw new ForbiddenException('Authentication required');
    }

    if (user.identity_type === (IdentityType.SUPER_ADMIN as string)) {
      this.logger.log('Super Admin | route permission');
      return true;
    }

    const resourceId = request.params[aclMeta.paramKey || 'id'];
    if (!resourceId) {
      this.logger.log('Resource ID not found in request');
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
        `DENIED | user_id=${String(user.sub)} tenant_id=${String(user.tenant_id)} resource_type=${String(aclMeta.resource)} resource_id=${String(resourceId)} permission=${String(aclMeta.action)}`,
      );
      throw new ForbiddenException('Insufficient resource ACL');
    }

    this.logger.log(
      `ALLOWED | user_id=${String(user.sub)} tenant_id=${String(user.tenant_id)} resource_type=${String(aclMeta.resource)} resource_id=${String(resourceId)} permission=${String(aclMeta.action)}`,
    );
    return true;
  }
}
