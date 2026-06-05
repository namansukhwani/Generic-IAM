import {
  Injectable,
  BadRequestException,
  NotFoundException,
  Inject,
  Scope,
} from '@nestjs/common';
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
import { KAFKA_TOPICS } from 'src/common/constants/kafka.constant';

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

  async assignToRole(
    roleId: string,
    tenantId: string,
    permissionId: string,
    actorId: string,
  ): Promise<RolePermissionEntity> {
    const role = await this.roleService.findOneForTenant(roleId, tenantId);

    if (role.is_system) {
      throw new BadRequestException(
        'Cannot modify permissions of system roles',
      );
    }

    const isUuid = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(permissionId);
    const permission = await this.repository.findOne({
      where: isUuid ? { id: permissionId } : { code: permissionId },
    });
    if (!permission) throw new NotFoundException('Permission not found');

    const existing = await this.rolePermissionRepository.findOne({
      where: { role_id: roleId, permission_id: permission.id },
    });

    if (existing) {
      return existing; // Already assigned
    }

    const mapping = this.rolePermissionRepository.create({
      role_id: roleId,
      permission_id: permission.id,
    });

    const saved = await this.rolePermissionRepository.save(mapping);

    this.eventProducer.emit(KAFKA_TOPICS.IAM_AUDIT, {
      event_type: AuditEventType.PERMISSION_ADDED_TO_ROLE,
      tenant_id: tenantId,
      actor_id: actorId,
      resource_type: 'role',
      resource_id: roleId,
      payload: { permission_id: permissionId },
    });

    this.eventProducer.emit(KAFKA_TOPICS.IAM_PERMISSION_CHANGED, {
      event_type: 'PERMISSION_CHANGED',
      tenant_id: tenantId,
      payload: { role_id: roleId },
    });

    return saved;
  }

  async removeFromRole(
    roleId: string,
    tenantId: string,
    permissionId: string,
    actorId: string,
  ): Promise<void> {
    const role = await this.roleService.findOneForTenant(roleId, tenantId);

    if (role.is_system) {
      throw new BadRequestException(
        'Cannot modify permissions of system roles',
      );
    }

    const isUuid = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(permissionId);
    const permission = await this.repository.findOne({
      where: isUuid ? { id: permissionId } : { code: permissionId },
    });
    if (!permission) return;

    const mapping = await this.rolePermissionRepository.findOne({
      where: { role_id: roleId, permission_id: permission.id },
    });

    if (mapping) {
      await this.rolePermissionRepository.remove(mapping);

      this.eventProducer.emit(KAFKA_TOPICS.IAM_AUDIT, {
        event_type: AuditEventType.PERMISSION_REMOVED_FROM_ROLE,
        tenant_id: tenantId,
        actor_id: actorId,
        resource_type: 'role',
        resource_id: roleId,
        payload: { permission_id: permissionId },
      });

      this.eventProducer.emit(KAFKA_TOPICS.IAM_PERMISSION_CHANGED, {
        event_type: 'PERMISSION_CHANGED',
        tenant_id: tenantId,
        payload: { role_id: roleId },
      });
    }
  }
}
