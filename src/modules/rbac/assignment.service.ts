import {
  Injectable,
  NotFoundException,
  BadRequestException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository, MoreThanOrEqual, IsNull } from 'typeorm';
import { UserRoleEntity } from './entities/user-role.entity';
import { AssignRoleDto } from './dto/assign-role.dto';
import { RoleService } from './role.service';
import { EventProducer } from '../../event/event.producer';
import { AuditEventType } from '../../common/constants/audit-events.constant';
import { BaseService } from '../../common/base/base.service';
import { UserEntity } from '../user/entities/user.entity';

@Injectable()
export class AssignmentService extends BaseService<UserRoleEntity> {
  constructor(
    @InjectRepository(UserRoleEntity)
    protected readonly userRoleRepository: Repository<UserRoleEntity>,
    @InjectRepository(UserEntity)
    private readonly userRepository: Repository<UserEntity>,
    private readonly roleService: RoleService,
    private readonly eventProducer: EventProducer,
  ) {
    super(userRoleRepository);
  }

  async assignToUser(
    userId: string,
    tenantId: string,
    dto: AssignRoleDto,
    actorId: string,
  ): Promise<UserRoleEntity> {
    const user = await this.userRepository.findOne({
      where: { id: userId, tenant_id: tenantId },
    });
    if (!user) throw new NotFoundException('User not found in tenant');

    // Validates role exists and belongs to tenant (or system)
    const role = await this.roleService.findOneForTenant(dto.role_id, tenantId);

    const existing = await this.userRoleRepository.findOne({
      where: { user_id: userId, role_id: dto.role_id, tenant_id: tenantId },
    });

    let assignment: UserRoleEntity;

    if (existing) {
      existing.expires_at = dto.expires_at || null;
      assignment = await this.userRoleRepository.save(existing);
    } else {
      assignment = await this.userRoleRepository.save(
        this.userRoleRepository.create({
          tenant_id: tenantId,
          user_id: userId,
          role_id: dto.role_id,
          expires_at: dto.expires_at || null,
        }),
      );
    }

    this.eventProducer.emit('iam.audit', {
      event_type: AuditEventType.ROLE_ASSIGNED,
      tenant_id: tenantId,
      actor_id: actorId,
      resource_type: 'user',
      resource_id: userId,
      payload: { role_id: dto.role_id, expires_at: dto.expires_at },
    });

    this.eventProducer.emit('iam.permission.changed', {
      event_type: 'PERMISSION_CHANGED',
      tenant_id: tenantId,
      user_id: userId,
    });

    return assignment;
  }

  async revokeFromUser(
    userId: string,
    roleId: string,
    tenantId: string,
    actorId: string,
  ): Promise<void> {
    const assignment = await this.userRoleRepository.findOne({
      where: { user_id: userId, role_id: roleId, tenant_id: tenantId },
    });

    if (assignment) {
      await this.userRoleRepository.remove(assignment);

      this.eventProducer.emit('iam.audit', {
        event_type: AuditEventType.ROLE_REVOKED,
        tenant_id: tenantId,
        actor_id: actorId,
        resource_type: 'user',
        resource_id: userId,
        payload: { role_id: roleId },
      });

      this.eventProducer.emit('iam.permission.changed', {
        event_type: 'PERMISSION_CHANGED',
        tenant_id: tenantId,
        user_id: userId,
      });
    }
  }

  async getUserRoles(
    userId: string,
    tenantId: string,
  ): Promise<UserRoleEntity[]> {
    const now = new Date();

    // We want all roles that have NO expiry, or expiry > now
    const qb = this.userRoleRepository
      .createQueryBuilder('ur')
      .leftJoinAndSelect('ur.role', 'role')
      .where('ur.user_id = :userId', { userId })
      .andWhere('ur.tenant_id = :tenantId', { tenantId })
      .andWhere('(ur.expires_at IS NULL OR ur.expires_at > :now)', { now });

    return qb.getMany();
  }
}
