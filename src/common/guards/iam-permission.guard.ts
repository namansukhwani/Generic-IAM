import {
  Injectable,
  ExecutionContext,
  ForbiddenException,
  Logger,
  CanActivate,
} from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { PERMISSIONS_KEY, IdentityType } from '@iam/nestjs-sdk';
import { AuthorizationService } from '../../modules/authorization/authorization.service';
import { RequestContext } from '../interfaces/request-context.interface';

@Injectable()
export class IamPermissionGuard implements CanActivate {
  private readonly logger = new Logger(IamPermissionGuard.name);

  constructor(
    private readonly reflector: Reflector,
    private readonly authorizationService: AuthorizationService,
  ) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const isPublic = this.reflector.getAllAndOverride<boolean>('isPublic', [
      context.getHandler(),
      context.getClass(),
    ]);
    if (isPublic) {
      this.logger.log('PermissionGuard | Route is public');
      return true;
    }

    this.logger.log('Checking permissions');
    const requiredPermissions = this.reflector.getAllAndOverride<string[]>(
      PERMISSIONS_KEY,
      [context.getHandler(), context.getClass()],
    );
    this.logger.log(
      `Required permissions: ${JSON.stringify(requiredPermissions)}`,
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
      this.logger.log('PermissionGuard | Super admin');
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
      const failedPermissions = requiredPermissions.filter(
        (_, i) => !results[i].allowed,
      );
      this.logger.warn(
        `DENIED | user_id=${userId} tenant_id=${tenantId} required=[${requiredPermissions.join(',')}] failed=[${failedPermissions.join(',')}]`,
      );
      throw new ForbiddenException('Insufficient permissions');
    }

    this.logger.log(
      `ALLOWED | user_id=${userId} tenant_id=${tenantId} required=[${requiredPermissions.join(',')}]`,
    );

    return true;
  }
}
