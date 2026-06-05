import { Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { JwtService } from '@nestjs/jwt';
import { TenantEntity } from '../tenant/entities/tenant.entity';
import { UserEntity } from '../user/entities/user.entity';
import { ImpersonateDto } from './dto/impersonate.dto';
import { EventProducer } from '../../event/event.producer';
import { AuditService } from '../audit/audit.service';
import { AuditQueryDto } from '../audit/dto/audit-query.dto';

import { KAFKA_TOPICS } from '../../common/constants/kafka.constant';

@Injectable()
export class SuperAdminService {
  constructor(
    @InjectRepository(TenantEntity)
    private readonly tenantRepository: Repository<TenantEntity>,
    @InjectRepository(UserEntity)
    private readonly userRepository: Repository<UserEntity>,
    private readonly jwtService: JwtService,
    private readonly eventProducer: EventProducer,
    private readonly auditService: AuditService,
  ) {}

  async impersonate(
    dto: ImpersonateDto,
    superAdminId: string,
  ): Promise<{ access_token: string; expires_in: number }> {
    // Note: Assuming a BYPASSRLS connection or query here. Using default repo.
    const targetUser = await this.userRepository.findOne({
      where: { id: dto.user_id, tenant_id: dto.tenant_id },
    });

    if (!targetUser) throw new NotFoundException('Target user not found');

    // In a real scenario, check if targetUser is a SuperAdmin and block it.
    // For now we assume we check role or a flag.

    const payload = {
      sub: targetUser.id,
      email: targetUser.email,
      tenant_id: targetUser.tenant_id,
      identity_type: 'IMPERSONATION',
      impersonator_id: superAdminId,
    };

    const accessTtl = 1800; // 30 mins
    const access_token = this.jwtService.sign(payload, {
      expiresIn: accessTtl,
    });

    this.eventProducer.emit(KAFKA_TOPICS.IAM_AUDIT, {
      event_type: 'IMPERSONATION_STARTED',
      tenant_id: dto.tenant_id,
      actor_id: superAdminId,
      resource_type: 'user',
      resource_id: dto.user_id,
      payload: { reason: dto.reason },
    });

    return { access_token, expires_in: accessTtl };
  }

  async getTenants(): Promise<TenantEntity[]> {
    // Note: requires BYPASSRLS
    return this.tenantRepository.find();
  }

  async getTenantUsers(tenantId: string): Promise<UserEntity[]> {
    // Note: requires BYPASSRLS
    return this.userRepository.find({ where: { tenant_id: tenantId } });
  }

  async getAuditLogs(filters: AuditQueryDto): Promise<any> {
    return this.auditService.queryLogs(filters);
  }
}
