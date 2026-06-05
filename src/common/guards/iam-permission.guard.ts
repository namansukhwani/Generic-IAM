import {
  Injectable,
  ExecutionContext,
  ForbiddenException,
} from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import {
  PermissionGuard,
  PERMISSIONS_KEY,
  IdentityType,
  IamAuthzService,
} from '@iam/nestjs-sdk';
import { AuthorizationService } from '../../modules/authorization/authorization.service';
import { RequestContext } from '../interfaces/request-context.interface';

@Injectable()
export class IamPermissionGuard extends PermissionGuard {
  constructor(
    protected reflector: Reflector,
    private readonly authorizationService: AuthorizationService,
  ) {
    super(reflector, null as unknown as IamAuthzService);
  }

  async canActivate(context: ExecutionContext): Promise<boolean> {
    if (!this.reflector) {
      return true;
    }
    const isPublic = this.reflector.getAllAndOverride<boolean>('isPublic', [
      context.getHandler(),
      context.getClass(),
    ]);
    if (isPublic) {
      return true;
    }

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

    if (user.identity_type === (IdentityType.SUPER_ADMIN as string)) {
      return true;
    }

    const tenantId = user.tenant_id;
    const userId = user.sub;

    const dtos = requiredPermissions.map((perm) => ({
      tenant_id: tenantId!,
      user_id: userId,
      permission: perm,
    }));

    const results = await this.authorizationService.checkBatch(dtos);
    const hasAllRequired = results.every((r) => r.allowed);

    if (!hasAllRequired) {
      throw new ForbiddenException('Insufficient permissions');
    }

    return true;
  }
}
