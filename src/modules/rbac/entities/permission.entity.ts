import { Entity, Column, Unique } from 'typeorm';
import { BaseEntity } from '../../../common/base/base.entity';

@Entity('permissions')
@Unique(['resource', 'action'])
export class PermissionEntity extends BaseEntity {
  @Column()
  resource: string;

  @Column()
  action: string;

  @Column({ nullable: true })
  description: string;
}
