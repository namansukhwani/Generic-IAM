import { Entity, Column, ManyToOne, JoinColumn } from 'typeorm';
import { BaseTenantEntity } from '../../../common/base/base-tenant.entity';
import { UserEntity } from '../../user/entities/user.entity';

@Entity('resource_acls')
export class ResourceAclEntity extends BaseTenantEntity {
  @Column({ type: 'uuid' })
  user_id: string;

  @ManyToOne(() => UserEntity, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'user_id' })
  user: UserEntity;

  @Column()
  resource_type: string;

  @Column()
  resource_id: string;

  @Column()
  permission: string;
}
