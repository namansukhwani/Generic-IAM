import { Entity, Column } from 'typeorm';
import { BaseEntity } from '../../../common/base/base.entity';

@Entity('roles')
export class RoleEntity extends BaseEntity {
  @Column({ type: 'uuid', nullable: true })
  tenant_id: string | null;

  @Column()
  name: string;

  @Column({ nullable: true })
  description: string;

  @Column({ default: false })
  is_system: boolean;
}
