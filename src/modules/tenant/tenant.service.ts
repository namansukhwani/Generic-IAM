import {
  Injectable,
  NotFoundException,
  BadRequestException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository, DataSource } from 'typeorm';
import { TenantEntity } from './entities/tenant.entity';
import { UserEntity } from '../user/entities/user.entity';
import { RoleEntity } from '../rbac/entities/role.entity';
import { UserRoleEntity } from '../rbac/entities/user-role.entity';
import { CreateTenantDto } from './dto/create-tenant.dto';
import { UpdateTenantDto } from './dto/update-tenant.dto';
import { hashPassword } from '../../common/utils/password.util';
import { runInTransaction } from '../../common/utils/transaction.util';
import { SystemRole } from '../../common/constants/system-roles.constant';
import { EventProducer } from '../../event/event.producer';
import { AuditEventType } from '../../common/constants/audit-events.constant';
import { BaseService } from '../../common/base/base.service';

@Injectable()
export class TenantService extends BaseService<TenantEntity> {
  constructor(
    @InjectRepository(TenantEntity)
    protected readonly repository: Repository<TenantEntity>,
    private readonly dataSource: DataSource,
    private readonly eventProducer: EventProducer,
  ) {
    super(repository);
  }

  async createTenantWithAdmin(
    dto: CreateTenantDto,
    actorId: string,
  ): Promise<TenantEntity> {
    const { savedTenant, savedUser } = await runInTransaction(
      this.dataSource,
      async (manager) => {
        // 1. Check if tenant exists
        const existingTenant = await manager.findOne(TenantEntity, {
          where: [{ name: dto.name }, { slug: dto.slug }],
        });
        if (existingTenant) {
          throw new BadRequestException(
            'Tenant with same name or slug already exists',
          );
        }

        // 2. Create Tenant
        const tenant = manager.create(TenantEntity, {
          name: dto.name,
          slug: dto.slug,
          settings: dto.settings || {},
        });
        const savedTenant = await manager.save(tenant);

        // 3. Create Admin User
        const hashedPassword = await hashPassword(dto.admin.password);
        const user = manager.create(UserEntity, {
          tenant_id: savedTenant.id,
          email: dto.admin.email,
          password_hash: hashedPassword,
          first_name: dto.admin.first_name,
          last_name: dto.admin.last_name,
        });
        const savedUser = await manager.save(user);

        // 4. Find TENANT_ADMIN role
        const adminRole = await manager.findOne(RoleEntity, {
          where: { name: SystemRole.TENANT_ADMIN, is_system: true },
        });

        if (adminRole) {
          // 5. Assign Role
          const userRole = manager.create(UserRoleEntity, {
            tenant_id: savedTenant.id,
            user_id: savedUser.id,
            role_id: adminRole.id,
          });
          await manager.save(userRole);
        }

        return { savedTenant, savedUser };
      },
    );

    // Emit Events
    this.eventProducer.emit('iam.audit', {
      event_type: AuditEventType.TENANT_CREATED,
      tenant_id: savedTenant.id,
      actor_id: actorId,
      resource_type: 'tenant',
      resource_id: savedTenant.id,
      payload: { tenant_name: savedTenant.name, admin_email: savedUser.email },
    });

    return savedTenant;
  }

  async updateTenant(
    id: string,
    dto: UpdateTenantDto,
    actorId: string,
  ): Promise<TenantEntity> {
    const tenant = await this.update(id, dto);
    this.eventProducer.emit('iam.audit', {
      event_type: AuditEventType.TENANT_UPDATED,
      tenant_id: tenant.id,
      actor_id: actorId,
      resource_type: 'tenant',
      resource_id: tenant.id,
      payload: { updates: dto },
    });
    return tenant;
  }

  async deactivateTenant(id: string, actorId: string): Promise<void> {
    await this.update(id, { is_active: false });
    this.eventProducer.emit('iam.audit', {
      event_type: AuditEventType.TENANT_DEACTIVATED,
      tenant_id: id,
      actor_id: actorId,
      resource_type: 'tenant',
      resource_id: id,
      payload: {},
    });
  }
}
