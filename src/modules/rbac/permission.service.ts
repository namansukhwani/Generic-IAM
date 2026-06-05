import { Injectable, BadRequestException, Inject, Scope } from '@nestjs/common';
import { REQUEST } from '@nestjs/core';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { PermissionEntity } from './entities/permission.entity';
import { RolePermissionEntity } from './entities/role-permission.entity';
import { RoleService } from './role.service';
import { EventProducer } from '../../event/event.producer';
import { AuditEventType } from '../../common/constants/audit-events.constant';
import { BaseService } from '../../common/base/base.service';
import type { RequestContext } from '../../common/interfaces/request-context.interface';
import { KAFKA_TOPICS } from '../../common/constants/kafka.constant';
import { UpdateRolePermissionsDto } from './dto/update-role-permissions.dto';

@Injectable({ scope: Scope.REQUEST })
export class PermissionService extends BaseService<PermissionEntity> {
  constructor(
    @InjectRepository(PermissionEntity)
    protected readonly defaultRepository: Repository<PermissionEntity>,
    @InjectRepository(RolePermissionEntity)
    private readonly rolePermissionRepository: Repository<RolePermissionEntity>,
    private readonly roleService: RoleService,
    private readonly eventProducer: EventProducer,
    @Inject(REQUEST) protected readonly request: RequestContext,
  ) {
    super(defaultRepository, request);
  }

  async findAllGlobal(): Promise<PermissionEntity[]> {
    return this.repository.find();
  }

  async updateRolePermissions(
    roleId: string,
    tenantId: string,
    dto: UpdateRolePermissionsDto,
    actorId: string,
  ): Promise<void> {
    const role = await this.roleService.findOneForTenant(roleId, tenantId);

    if (role.is_system) {
      throw new BadRequestException(
        'Cannot modify permissions of system roles',
      );
    }

    const manager = this.repository.manager;
    if (dto.add && dto.add.length > 0) {
      const permissions = await manager.find(PermissionEntity, {
        where: dto.add.map((id) => {
          const isUuid =
            /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(
              id,
            );
          return isUuid ? { id } : { code: id };
        }),
      });
      for (const permission of permissions) {
        const existing = await manager.findOne(RolePermissionEntity, {
          where: { role_id: roleId, permission_id: permission.id },
        });
        if (!existing) {
          const mapping = manager.create(RolePermissionEntity, {
            role_id: roleId,
            permission_id: permission.id,
          });
          await manager.save(mapping);

          this.eventProducer.emit(KAFKA_TOPICS.IAM_AUDIT, {
            event_type: AuditEventType.PERMISSION_ADDED_TO_ROLE,
            tenant_id: tenantId,
            actor_id: actorId,
            resource_type: 'role',
            resource_id: roleId,
            payload: { permission_id: permission.id },
          });
        }
      }
    }

    if (dto.remove && dto.remove.length > 0) {
      const permissions = await manager.find(PermissionEntity, {
        where: dto.remove.map((id) => {
          const isUuid =
            /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(
              id,
            );
          return isUuid ? { id } : { code: id };
        }),
      });
      for (const permission of permissions) {
        const mapping = await manager.findOne(RolePermissionEntity, {
          where: { role_id: roleId, permission_id: permission.id },
        });
        if (mapping) {
          await manager.remove(mapping);

          this.eventProducer.emit(KAFKA_TOPICS.IAM_AUDIT, {
            event_type: AuditEventType.PERMISSION_REMOVED_FROM_ROLE,
            tenant_id: tenantId,
            actor_id: actorId,
            resource_type: 'role',
            resource_id: roleId,
            payload: { permission_id: permission.id },
          });
        }
      }
    }

    this.eventProducer.emit(KAFKA_TOPICS.IAM_PERMISSION_CHANGED, {
      event_type: 'PERMISSION_CHANGED',
      tenant_id: tenantId,
      actor_id: actorId,
      payload: { role_id: roleId },
    });
  }
}
