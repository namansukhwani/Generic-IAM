import { Injectable, BadRequestException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository, DataSource } from 'typeorm';
import { UserEntity } from './entities/user.entity';
import { CreateUserDto } from './dto/create-user.dto';
import { UpdateUserDto } from './dto/update-user.dto';
import { hashPassword } from '../../common/utils/password.util';
import { EventProducer } from '../../event/event.producer';
import { AuditEventType } from '../../common/constants/audit-events.constant';
import { BaseService } from '../../common/base/base.service';

@Injectable()
export class UserService extends BaseService<UserEntity> {
  constructor(
    @InjectRepository(UserEntity)
    protected readonly repository: Repository<UserEntity>,
    private readonly dataSource: DataSource,
    private readonly eventProducer: EventProducer,
  ) {
    super(repository);
  }

  async createUser(tenantId: string, dto: CreateUserDto, actorId: string): Promise<UserEntity> {
    const existing = await this.repository.findOne({ where: { tenant_id: tenantId, email: dto.email } });
    if (existing) throw new BadRequestException('User with email already exists in tenant');

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

    this.eventProducer.emit('iam.audit', {
      event_type: AuditEventType.USER_CREATED,
      tenant_id: tenantId,
      actor_id: actorId,
      resource_type: 'user',
      resource_id: saved.id,
      payload: { email: saved.email },
    });

    return saved;
  }

  async updateUser(id: string, dto: UpdateUserDto, tenantId: string, actorId: string): Promise<UserEntity> {
    const user = await this.findOne({ where: { id } } as any);
    if (user.tenant_id !== tenantId) throw new BadRequestException('Invalid tenant');

    Object.assign(user, dto);
    const updated = await this.repository.save(user);

    this.eventProducer.emit('iam.audit', {
      event_type: AuditEventType.USER_UPDATED,
      tenant_id: tenantId,
      actor_id: actorId,
      resource_type: 'user',
      resource_id: id,
      payload: { updates: dto },
    });

    return updated;
  }

  async setActivation(id: string, tenantId: string, isActive: boolean, actorId: string): Promise<void> {
    const user = await this.findOne({ where: { id } } as any);
    if (user.tenant_id !== tenantId) throw new BadRequestException('Invalid tenant');

    user.is_active = isActive;
    await this.repository.save(user);

    const eventType = isActive ? AuditEventType.USER_ACTIVATED : AuditEventType.USER_DEACTIVATED;
    
    // Also emit a general user changed event for cache invalidation
    this.eventProducer.emit('iam.user.changed', {
      event_type: eventType,
      tenant_id: tenantId,
      user_id: id,
    });

    this.eventProducer.emit('iam.audit', {
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
