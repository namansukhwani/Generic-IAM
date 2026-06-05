import {
  Entity,
  Column,
  Unique,
  ManyToOne,
  JoinColumn,
  OneToMany,
} from 'typeorm';
import { BaseEntity } from '../../../common/base/base.entity';

@Entity('permissions')
@Unique(['code'])
export class PermissionEntity extends BaseEntity {
  @Column()
  code: string;

  @Column()
  service: string;

  @Column({ type: 'uuid', nullable: true })
  parent_id: string | null;

  @ManyToOne(() => PermissionEntity, { nullable: true })
  @JoinColumn({ name: 'parent_id' })
  parent: PermissionEntity | null;

  @OneToMany(() => PermissionEntity, (p) => p.parent)
  children: PermissionEntity[];

  @Column({ nullable: true })
  description: string;
}
