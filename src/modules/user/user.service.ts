import { Injectable, BadRequestException, Inject, Scope } from '@nestjs/common';
import { REQUEST } from '@nestjs/core';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository, DataSource } from 'typeorm';
import { UserEntity } from './entities/user.entity';
import { RefreshTokenEntity } from '../auth/entities/refresh-token.entity';
import { CreateUserDto } from './dto/create-user.dto';
import { UpdateUserDto } from './dto/update-user.dto';
import { hashPassword } from '../../common/utils/password.util';
import { EventProducer } from '../../event/event.producer';
import { AuditEventType } from '../../common/constants/audit-events.constant';
import { BaseService } from '../../common/base/base.service';
import type { RequestContext } from '../../common/interfaces/request-context.interface';

import { KAFKA_TOPICS } from '../../common/constants/kafka.constant';
import { SystemRole } from '../../common/constants/system-roles.constant';
import { RoleService } from '../rbac/role.service';
import { AssignmentService } from '../rbac/assignment.service';

@Injectable({ scope: Scope.REQUEST })
export class UserService extends BaseService<UserEntity> {
  constructor(
    @InjectRepository(UserEntity)
    protected readonly defaultRepository: Repository<UserEntity>,
    @InjectRepository(RefreshTokenEntity)
    private readonly refreshTokenRepository: Repository<RefreshTokenEntity>,
    private readonly dataSource: DataSource,
    private readonly eventProducer: EventProducer,
    private readonly roleService: RoleService,
    private readonly assignmentService: AssignmentService,
    @Inject(REQUEST) protected readonly request: RequestContext,
  ) {
    super(defaultRepository, request);
  }

  async createUser(
    tenantId: string,
    dto: CreateUserDto,
    actorId: string,
  ): Promise<UserEntity> {
    const existing = await this.repository.findOne({
      where: { tenant_id: tenantId, email: dto.email },
    });
    if (existing)
      throw new BadRequestException('User with email already exists in tenant');

    const hashedPassword = await hashPassword(dto.password);
    const user = this.repository.create({
      tenant_id: tenantId,
      email: dto.email,
      password_hash: hashedPassword,
      first_name: dto.first_name,
      last_name: dto.last_name,
      manager_id: dto.manager_id,
    });

    const saved = await this.repository.save(user);

    // Role Assignment
    let roleIdToAssign = dto.role_id;
    if (!roleIdToAssign) {
      // Find default MEMBER role
      const defaultRole = await this.roleService.findOneByName(
        SystemRole.MEMBER,
        null, // system role has null tenant_id
      );
      if (defaultRole) {
        roleIdToAssign = defaultRole.id;
      }
    }

    if (roleIdToAssign) {
      await this.assignmentService.assignToUser(
        saved.id,
        tenantId,
        { role_id: roleIdToAssign },
        actorId,
      );
    }

    this.eventProducer.emit(KAFKA_TOPICS.IAM_AUDIT, {
      event_type: AuditEventType.USER_CREATED,
      tenant_id: tenantId,
      actor_id: actorId,
      resource_type: 'user',
      resource_id: saved.id,
      payload: { email: saved.email, assigned_role_id: roleIdToAssign },
    });

    return saved;
  }

  async updateUser(
    id: string,
    dto: UpdateUserDto,
    tenantId: string,
    actorId: string,
  ): Promise<UserEntity> {
    const user = await this.findOne({ where: { id } });
    if (user.tenant_id !== tenantId)
      throw new BadRequestException('Invalid tenant');

    Object.assign(user, dto);
    const updated = await this.repository.save(user);

    this.eventProducer.emit(KAFKA_TOPICS.IAM_AUDIT, {
      event_type: AuditEventType.USER_UPDATED,
      tenant_id: tenantId,
      actor_id: actorId,
      resource_type: 'user',
      resource_id: id,
      payload: { updates: dto },
    });

    return updated;
  }

  async setActivation(
    id: string,
    tenantId: string,
    isActive: boolean,
    actorId: string,
  ): Promise<void> {
    const user = await this.findOne({ where: { id } });
    if (user.tenant_id !== tenantId)
      throw new BadRequestException('Invalid tenant');

    user.is_active = isActive;
    await this.repository.save(user);

    if (!isActive) {
      await this.refreshTokenRepository.delete({ user_id: id });
    }

    const eventType = isActive
      ? AuditEventType.USER_ACTIVATED
      : AuditEventType.USER_DEACTIVATED;

    // Also emit a general user changed event for cache invalidation
    this.eventProducer.emit(KAFKA_TOPICS.IAM_USER_CHANGED, {
      event_type: eventType,
      tenant_id: tenantId,
      user_id: id,
    });

    this.eventProducer.emit(KAFKA_TOPICS.IAM_AUDIT, {
      event_type: eventType,
      tenant_id: tenantId,
      actor_id: actorId,
      resource_type: 'user',
      resource_id: id,
      payload: {},
    });
  }

  async getHierarchy(userId: string, tenantId: string): Promise<any> {
    // Recursive CTE for reporting chain
    const query = `
      WITH RECURSIVE subordinates AS (
        SELECT id, first_name, last_name, email, manager_id, 1 as level
        FROM users
        WHERE id = $1 AND tenant_id = $2
        UNION ALL
        SELECT u.id, u.first_name, u.last_name, u.email, u.manager_id, s.level + 1
        FROM users u
        INNER JOIN subordinates s ON s.id = u.manager_id
        WHERE u.tenant_id = $2
      )
      SELECT * FROM subordinates ORDER BY level, first_name;
    `;
    const result = await this.dataSource.query(query, [userId, tenantId]);
    return result;
  }
}
