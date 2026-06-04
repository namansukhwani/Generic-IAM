import { Entity, Column, ManyToOne, JoinColumn, Unique } from 'typeorm';
import { BaseTenantEntity } from '../../../common/base/base-tenant.entity';

@Entity('users')
@Unique(['tenant_id', 'email'])
export class UserEntity extends BaseTenantEntity {
  @Column()
  email: string;

  @Column()
  password_hash: string;

  @Column()
  first_name: string;

  @Column()
  last_name: string;

  @Column({ default: true })
  is_active: boolean;

  @Column({ type: 'uuid', nullable: true })
  manager_id: string | null;

  @ManyToOne(() => UserEntity, { onDelete: 'SET NULL' })
  @JoinColumn({ name: 'manager_id' })
  manager: UserEntity;
}
