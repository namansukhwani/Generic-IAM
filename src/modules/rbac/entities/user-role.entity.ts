import { Entity, Column, ManyToOne, JoinColumn } from 'typeorm';
import { BaseTenantEntity } from '../../../common/base/base-tenant.entity';
import { UserEntity } from '../../user/entities/user.entity';
import { RoleEntity } from './role.entity';

@Entity('user_roles')
export class UserRoleEntity extends BaseTenantEntity {
  @Column({ type: 'uuid' })
  user_id: string;

  @ManyToOne(() => UserEntity, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'user_id' })
  user: UserEntity;

  @Column({ type: 'uuid' })
  role_id: string;

  @ManyToOne(() => RoleEntity, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'role_id' })
  role: RoleEntity;

  @Column({ type: 'timestamp', nullable: true })
  expires_at: Date | null;
}
