import { Entity, Column, ManyToOne, JoinColumn, Unique } from 'typeorm';
import { BaseTenantEntity } from '../../../common/base/base-tenant.entity';
import { UserEntity } from '../../user/entities/user.entity';
import { PermissionEntity } from './permission.entity';

@Entity('user_permission_overrides')
@Unique(['tenant_id', 'user_id', 'permission_id'])
export class UserPermissionOverrideEntity extends BaseTenantEntity {
  @Column({ type: 'uuid' })
  user_id: string;

  @ManyToOne(() => UserEntity, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'user_id' })
  user: UserEntity;

  @Column({ type: 'uuid' })
  permission_id: string;

  @ManyToOne(() => PermissionEntity, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'permission_id' })
  permission: PermissionEntity;

  @Column()
  override_type: 'GRANT' | 'DENY';

  @Column({ nullable: true })
  reason: string;
}
