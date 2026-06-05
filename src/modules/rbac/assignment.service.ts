import { Injectable, NotFoundException, Inject, Scope } from '@nestjs/common';
import { REQUEST } from '@nestjs/core';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { UserRoleEntity } from './entities/user-role.entity';
import { AssignRoleDto } from './dto/assign-role.dto';
import { RoleService } from './role.service';
import { EventProducer } from '../../event/event.producer';
import { AuditEventType } from '../../common/constants/audit-events.constant';
import { BaseService } from '../../common/base/base.service';
import { UserEntity } from '../user/entities/user.entity';
import type { RequestContext } from '../../common/interfaces/request-context.interface';
import { KAFKA_TOPICS } from '../../common/constants/kafka.constant';
import { UpdateUserRolesDto } from './dto/update-user-roles.dto';

@Injectable({ scope: Scope.REQUEST })
export class AssignmentService extends BaseService<UserRoleEntity> {
  constructor(
    @InjectRepository(UserRoleEntity)
    protected readonly defaultRepository: Repository<UserRoleEntity>,
    @InjectRepository(UserEntity)
    private readonly userRepository: Repository<UserEntity>,
    private readonly roleService: RoleService,
    private readonly eventProducer: EventProducer,
    @Inject(REQUEST) protected readonly request: RequestContext,
  ) {
    super(defaultRepository, request);
  }

  // Mirrors BaseService.repository: participates in the interceptor's
  // transaction so uncommitted saves within the same request are visible.
  private get userRepo(): Repository<UserEntity> {
    if (this.request?.entityManager) {
      return this.request.entityManager.getRepository(UserEntity);
    }
    return this.userRepository;
  }

  async assignToUser(
    userId: string,
    tenantId: string,
    dto: AssignRoleDto,
    actorId: string,
  ): Promise<UserRoleEntity> {
    const user = await this.userRepo.findOne({
      where: { id: userId, tenant_id: tenantId },
    });
    if (!user) throw new NotFoundException('User not found in tenant');

    // Validates role exists and belongs to tenant (or system)
    await this.roleService.findOneForTenant(dto.role_id, tenantId);

    const existing = await this.repository.findOne({
      where: { user_id: userId, role_id: dto.role_id, tenant_id: tenantId },
    });

    let assignment: UserRoleEntity;

    if (existing) {
      existing.expires_at = dto.expires_at || null;
      assignment = await this.repository.save(existing);
    } else {
      assignment = await this.repository.save(
        this.repository.create({
          tenant_id: tenantId,
          user_id: userId,
          role_id: dto.role_id,
          expires_at: dto.expires_at || null,
        }),
      );
    }

    this.eventProducer.emit(KAFKA_TOPICS.IAM_AUDIT, {
      event_type: AuditEventType.ROLE_ASSIGNED,
      tenant_id: tenantId,
      actor_id: actorId,
      resource_type: 'user',
      resource_id: userId,
      payload: { role_id: dto.role_id, expires_at: dto.expires_at },
    });

    this.eventProducer.emit(KAFKA_TOPICS.IAM_PERMISSION_CHANGED, {
      event_type: 'PERMISSION_CHANGED',
      tenant_id: tenantId,
      user_id: userId,
    });

    return assignment;
  }

  async updateUserRoles(
    userId: string,
    tenantId: string,
    dto: UpdateUserRolesDto,
    actorId: string,
  ): Promise<void> {
    const user = await this.userRepo.findOne({
      where: { id: userId, tenant_id: tenantId },
    });
    if (!user) throw new NotFoundException('User not found in tenant');

    const manager = this.repository.manager;
    if (dto.add && dto.add.length > 0) {
      for (const item of dto.add) {
        await this.roleService.findOneForTenant(item.role_id, tenantId);

        let assignment = await manager.findOne(UserRoleEntity, {
          where: {
            user_id: userId,
            role_id: item.role_id,
            tenant_id: tenantId,
          },
        });

        if (assignment) {
          assignment.expires_at = item.expires_at || null;
          await manager.save(assignment);
        } else {
          assignment = manager.create(UserRoleEntity, {
            tenant_id: tenantId,
            user_id: userId,
            role_id: item.role_id,
            expires_at: item.expires_at || null,
          });
          await manager.save(assignment);
        }

        this.eventProducer.emit(KAFKA_TOPICS.IAM_AUDIT, {
          event_type: AuditEventType.ROLE_ASSIGNED,
          tenant_id: tenantId,
          actor_id: actorId,
          resource_type: 'user',
          resource_id: userId,
          payload: { role_id: item.role_id, expires_at: item.expires_at },
        });
      }
    }

    if (dto.remove && dto.remove.length > 0) {
      for (const roleId of dto.remove) {
        const assignment = await manager.findOne(UserRoleEntity, {
          where: { user_id: userId, role_id: roleId, tenant_id: tenantId },
        });

        if (assignment) {
          await manager.remove(assignment);

          this.eventProducer.emit(KAFKA_TOPICS.IAM_AUDIT, {
            event_type: AuditEventType.ROLE_REVOKED,
            tenant_id: tenantId,
            actor_id: actorId,
            resource_type: 'user',
            resource_id: userId,
            payload: { role_id: roleId },
          });
        }
      }
    }

    this.eventProducer.emit(KAFKA_TOPICS.IAM_PERMISSION_CHANGED, {
      event_type: 'PERMISSION_CHANGED',
      tenant_id: tenantId,
      user_id: userId,
    });
  }

  async getUserRoles(
    userId: string,
    tenantId: string,
  ): Promise<UserRoleEntity[]> {
    const now = new Date();

    // We want all roles that have NO expiry, or expiry > now
    const qb = this.repository
      .createQueryBuilder('ur')
      .leftJoinAndSelect('ur.role', 'role')
      .where('ur.user_id = :userId', { userId })
      .andWhere('ur.tenant_id = :tenantId', { tenantId })
      .andWhere('(ur.expires_at IS NULL OR ur.expires_at > :now)', { now });

    return qb.getMany();
  }
}
