import { Injectable, BadRequestException, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { RoleEntity } from './entities/role.entity';
import { CreateRoleDto } from './dto/create-role.dto';
import { EventProducer } from '../../event/event.producer';
import { AuditEventType } from '../../common/constants/audit-events.constant';
import { BaseService } from '../../common/base/base.service';

@Injectable()
export class RoleService extends BaseService<RoleEntity> {
  constructor(
    @InjectRepository(RoleEntity)
    protected readonly repository: Repository<RoleEntity>,
    private readonly eventProducer: EventProducer,
  ) {
    super(repository);
  }

  async createCustomRole(tenantId: string, dto: CreateRoleDto, actorId: string): Promise<RoleEntity> {
    const role = this.repository.create({
      tenant_id: tenantId,
      name: dto.name,
      description: dto.description,
      is_system: false,
    });
    
    const savedRole = await this.repository.save(role);

    this.eventProducer.emit('iam.audit', {
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
      where: [
        { tenant_id: tenantId },
        { is_system: true },
      ],
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

  async updateCustomRole(id: string, tenantId: string, dto: Partial<CreateRoleDto>, actorId: string): Promise<RoleEntity> {
    const role = await this.findOneForTenant(id, tenantId);
    
    if (role.is_system) {
      throw new BadRequestException('Cannot modify system roles');
    }

    Object.assign(role, dto);
    const updatedRole = await this.repository.save(role);

    this.eventProducer.emit('iam.audit', {
      event_type: AuditEventType.ROLE_UPDATED,
      tenant_id: tenantId,
      actor_id: actorId,
      resource_type: 'role',
      resource_id: updatedRole.id,
      payload: { updates: dto },
    });

    return updatedRole;
  }

  async deleteCustomRole(id: string, tenantId: string, actorId: string): Promise<void> {
    const role = await this.findOneForTenant(id, tenantId);
    
    if (role.is_system) {
      throw new BadRequestException('Cannot delete system roles');
    }

    // TODO: Phase 5D.4 - Check if users are assigned to this role before deleting

    await this.repository.remove(role);

    this.eventProducer.emit('iam.audit', {
      event_type: AuditEventType.ROLE_DELETED,
      tenant_id: tenantId,
      actor_id: actorId,
      resource_type: 'role',
      resource_id: id,
      payload: { name: role.name },
    });
  }
}
