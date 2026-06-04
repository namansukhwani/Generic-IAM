import { Injectable, NotFoundException, ConflictException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { UserPermissionOverrideEntity } from './entities/user-permission-override.entity';
import { CreateOverrideDto } from './dto/create-override.dto';
import { AssignmentService } from './assignment.service';
import { PermissionEntity } from './entities/permission.entity';
import { EventProducer } from '../../event/event.producer';
import { AuditEventType } from '../../common/constants/audit-events.constant';
import { BaseService } from '../../common/base/base.service';

@Injectable()
export class OverrideService extends BaseService<UserPermissionOverrideEntity> {
  constructor(
    @InjectRepository(UserPermissionOverrideEntity)
    protected readonly overrideRepository: Repository<UserPermissionOverrideEntity>,
    @InjectRepository(PermissionEntity)
    private readonly permissionRepository: Repository<PermissionEntity>,
    private readonly assignmentService: AssignmentService,
    private readonly eventProducer: EventProducer,
  ) {
    super(overrideRepository);
  }

  async addOverride(userId: string, tenantId: string, dto: CreateOverrideDto, actorId: string): Promise<UserPermissionOverrideEntity> {
    const permission = await this.permissionRepository.findOne({ where: { id: dto.permission_id } });
    if (!permission) throw new NotFoundException('Permission not found');

    const existing = await this.overrideRepository.findOne({
      where: { user_id: userId, permission_id: dto.permission_id, tenant_id: tenantId }
    });

    if (existing) {
      if (existing.override_type === dto.override_type) {
        return existing;
      }
      // If updating, delete existing first or just update it
      existing.override_type = dto.override_type;
      existing.reason = dto.reason || '';
      await this.overrideRepository.save(existing);
      
      this.emitOverrideEvent(userId, tenantId, actorId, 'updated', dto);
      return existing;
    }

    const override = this.overrideRepository.create({
      tenant_id: tenantId,
      user_id: userId,
      permission_id: dto.permission_id,
      override_type: dto.override_type,
      reason: dto.reason || '',
    });

    const saved = await this.overrideRepository.save(override);
    this.emitOverrideEvent(userId, tenantId, actorId, 'added', dto);
    return saved;
  }

  async removeOverride(overrideId: string, userId: string, tenantId: string, actorId: string): Promise<void> {
    const override = await this.overrideRepository.findOne({
      where: { id: overrideId, user_id: userId, tenant_id: tenantId }
    });

    if (override) {
      await this.overrideRepository.remove(override);

      this.eventProducer.emit('iam.audit', {
        event_type: AuditEventType.PERMISSION_OVERRIDE_REMOVED,
        tenant_id: tenantId,
        actor_id: actorId,
        resource_type: 'user',
        resource_id: userId,
        payload: { permission_id: override.permission_id },
      });

      this.eventProducer.emit('iam.permission.changed', {
        event_type: 'PERMISSION_CHANGED',
        tenant_id: tenantId,
        user_id: userId,
      });
    }
  }

  async getOverridesForUser(userId: string, tenantId: string): Promise<UserPermissionOverrideEntity[]> {
    return this.overrideRepository.find({
      where: { user_id: userId, tenant_id: tenantId },
      relations: { permission: true },
    });
  }

  async getEffectivePermissions(userId: string, tenantId: string): Promise<PermissionEntity[]> {
    // 1. Get user roles (unexpired)
    const activeRoles = await this.assignmentService.getUserRoles(userId, tenantId);
    
    // 2. Fetch permissions for those roles
    const roleIds = activeRoles.map(ur => ur.role_id);
    
    let rolePermissions: any[] = [];
    if (roleIds.length > 0) {
      const qb = this.permissionRepository.createQueryBuilder('p')
        .innerJoin('role_permissions', 'rp', 'rp.permission_id = p.id')
        .where('rp.role_id IN (:...roleIds)', { roleIds });
      rolePermissions = await qb.getMany();
    }

    // 3. Get user overrides
    const overrides = await this.getOverridesForUser(userId, tenantId);
    
    const grantOverrides = overrides.filter(o => o.override_type === 'GRANT').map(o => o.permission);
    const denyOverrideIds = new Set(overrides.filter(o => o.override_type === 'DENY').map(o => o.permission_id));

    // 4. Compute: (Role Permissions UNION Grants) EXCEPT Denys
    const allGranted = [...rolePermissions, ...grantOverrides];
    
    const effective = new Map<string, PermissionEntity>();
    for (const p of allGranted) {
      if (!denyOverrideIds.has(p.id)) {
        effective.set(p.id, p);
      }
    }

    return Array.from(effective.values());
  }

  private emitOverrideEvent(userId: string, tenantId: string, actorId: string, action: string, dto: any) {
    this.eventProducer.emit('iam.audit', {
      event_type: AuditEventType.PERMISSION_OVERRIDE_ADDED,
      tenant_id: tenantId,
      actor_id: actorId,
      resource_type: 'user',
      resource_id: userId,
      payload: { permission_id: dto.permission_id, type: dto.override_type, action },
    });

    this.eventProducer.emit('iam.permission.changed', {
      event_type: 'PERMISSION_CHANGED',
      tenant_id: tenantId,
      user_id: userId,
    });
  }
}
