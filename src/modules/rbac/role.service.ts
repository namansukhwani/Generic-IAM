import {
  Injectable,
  BadRequestException,
  NotFoundException,
  Inject,
  Scope,
} from '@nestjs/common';
import { REQUEST } from '@nestjs/core';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository, IsNull } from 'typeorm';
import { RoleEntity } from './entities/role.entity';
import { UserRoleEntity } from './entities/user-role.entity';
import { CreateRoleDto } from './dto/create-role.dto';
import { EventProducer } from '../../event/event.producer';
import { AuditEventType } from '../../common/constants/audit-events.constant';
import { BaseService } from '../../common/base/base.service';
import type { RequestContext } from '../../common/interfaces/request-context.interface';
import { ConflictException } from '@nestjs/common';

import { KAFKA_TOPICS } from '../../common/constants/kafka.constant';

@Injectable({ scope: Scope.REQUEST })
export class RoleService extends BaseService<RoleEntity> {
  constructor(
    @InjectRepository(RoleEntity)
    protected readonly defaultRepository: Repository<RoleEntity>,
    @InjectRepository(UserRoleEntity)
    private readonly userRoleRepository: Repository<UserRoleEntity>,
    private readonly eventProducer: EventProducer,
    @Inject(REQUEST) protected readonly request: RequestContext,
  ) {
    super(defaultRepository, request);
  }

  async createCustomRole(
    tenantId: string,
    dto: CreateRoleDto,
    actorId: string,
  ): Promise<RoleEntity> {
    const role = this.repository.create({
      tenant_id: tenantId,
      name: dto.name,
      description: dto.description,
      is_system: false,
    });

    const savedRole = await this.repository.save(role);

    this.eventProducer.emit(KAFKA_TOPICS.IAM_AUDIT, {
      event_type: AuditEventType.ROLE_CREATED,
      tenant_id: tenantId,
      actor_id: actorId,
      resource_type: 'role',
      resource_id: savedRole.id,
      payload: { name: savedRole.name },
    });

    return savedRole;
  }

  async findAllForTenant(tenantId: string): Promise<RoleEntity[]> {
    return this.repository.find({
      where: [{ tenant_id: tenantId }, { is_system: true }],
    });
  }

  async findOneForTenant(id: string, tenantId: string): Promise<RoleEntity> {
    const role = await this.repository.findOne({
      where: [
        { id, tenant_id: tenantId },
        { id, is_system: true },
      ],
    });
    if (!role) throw new NotFoundException('Role not found');
    return role;
  }

  async findOneByName(
    name: string,
    tenantId: string | null,
  ): Promise<RoleEntity | null> {
    return this.repository.findOne({
      where: { name, tenant_id: tenantId === null ? IsNull() : tenantId },
    });
  }

  async updateCustomRole(
    id: string,
    tenantId: string,
    dto: Partial<CreateRoleDto>,
    actorId: string,
  ): Promise<RoleEntity> {
    const role = await this.findOneForTenant(id, tenantId);

    if (role.is_system) {
      throw new BadRequestException('Cannot modify system roles');
    }

    Object.assign(role, dto);
    const updatedRole = await this.repository.save(role);

    this.eventProducer.emit(KAFKA_TOPICS.IAM_AUDIT, {
      event_type: AuditEventType.ROLE_UPDATED,
      tenant_id: tenantId,
      actor_id: actorId,
      resource_type: 'role',
      resource_id: updatedRole.id,
      payload: { updates: dto },
    });

    return updatedRole;
  }

  async deleteCustomRole(
    id: string,
    tenantId: string,
    actorId: string,
  ): Promise<void> {
    const role = await this.findOneForTenant(id, tenantId);

    if (role.is_system) {
      throw new BadRequestException('Cannot delete system roles');
    }

    const assignedUsersCount = await this.userRoleRepository.count({
      where: { role_id: role.id },
    });

    if (assignedUsersCount > 0) {
      throw new ConflictException(
        'Cannot delete role as it is assigned to users',
      );
    }

    await this.repository.remove(role);

    this.eventProducer.emit(KAFKA_TOPICS.IAM_AUDIT, {
      event_type: AuditEventType.ROLE_DELETED,
      tenant_id: tenantId,
      actor_id: actorId,
      resource_type: 'role',
      resource_id: id,
      payload: { name: role.name },
    });
  }
}
