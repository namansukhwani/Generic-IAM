import { Column, ManyToOne, JoinColumn } from 'typeorm';
import { BaseEntity } from './base.entity';
import { TenantEntity } from '../../modules/tenant/entities/tenant.entity';

export abstract class BaseTenantEntity extends BaseEntity {
  @Column({ type: 'uuid' })
  tenant_id: string;

  @ManyToOne(() => TenantEntity, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'tenant_id' })
  tenant: TenantEntity;
}
