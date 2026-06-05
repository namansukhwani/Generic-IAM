import {
  Injectable,
  NotFoundException,
  Inject,
  Logger,
  Scope,
} from '@nestjs/common';
import { REQUEST } from '@nestjs/core';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { ResourceAclEntity } from './entities/resource-acl.entity';
import { CreateAclDto } from './dto/create-acl.dto';
import { CheckAclDto } from './dto/check-acl.dto';
import { AclQueryDto } from './dto/acl-query.dto';
import { EventProducer } from '../../event/event.producer';
import { CacheService } from '../../cache/cache.service';
import { BaseService } from '../../common/base/base.service';
import type { RequestContext } from '../../common/interfaces/request-context.interface';
import { KAFKA_TOPICS } from '../../common/constants/kafka.constant';

@Injectable({ scope: Scope.REQUEST })
export class AclService extends BaseService<ResourceAclEntity> {
  private readonly logger = new Logger(AclService.name);

  constructor(
    @InjectRepository(ResourceAclEntity)
    protected readonly defaultRepository: Repository<ResourceAclEntity>,
    private readonly cacheService: CacheService,
    private readonly eventProducer: EventProducer,
    @Inject(REQUEST) protected readonly request: RequestContext,
  ) {
    super(defaultRepository, request);
  }

  private getCacheKey(
    tenantId: string,
    userId: string,
    resourceType: string,
    resourceId: string,
    permission: string,
  ): string {
    return `acl:${tenantId}:${userId}:${resourceType}:${resourceId}:${permission}`;
  }

  async createAcl(
    tenantId: string,
    dto: CreateAclDto,
    actorId: string,
  ): Promise<ResourceAclEntity> {
    this.logger.log(
      `Creating ACL | tenant_id=${tenantId} user_id=${dto.user_id} resource_type=${dto.resource_type} resource_id=${dto.resource_id} permission=${dto.permission}`,
    );
    const existing = await this.repository.findOne({
      where: {
        tenant_id: tenantId,
        user_id: dto.user_id,
        resource_type: dto.resource_type,
        resource_id: dto.resource_id,
        permission: dto.permission,
      },
    });

    if (existing) {
      return existing;
    }

    const acl = this.repository.create({
      tenant_id: tenantId,
      user_id: dto.user_id,
      resource_type: dto.resource_type,
      resource_id: dto.resource_id,
      permission: dto.permission,
    });

    let saved: ResourceAclEntity;
    try {
      saved = await this.repository.save(acl);
    } catch (error: any) {
      if (error.code === '23503') {
        const detail: string = error.detail ?? '';
        if (detail.includes('tenant_id')) {
          throw new NotFoundException(`Tenant with ID ${tenantId} not found`);
        }
        if (detail.includes('user_id')) {
          throw new NotFoundException(`User with ID ${dto.user_id} not found`);
        }
      }
      throw error;
    }

    this.eventProducer.emit(KAFKA_TOPICS.IAM_ACL_CHANGED, {
      event_type: 'ACL_CREATED',
      tenant_id: tenantId,
      user_id: dto.user_id,
      resource_type: dto.resource_type,
      resource_id: dto.resource_id,
      payload: { permission: dto.permission },
    });

    this.eventProducer.emit(KAFKA_TOPICS.IAM_AUDIT, {
      event_type: 'ACL_CREATED',
      tenant_id: tenantId,
      actor_id: actorId,
      resource_type: dto.resource_type,
      resource_id: dto.resource_id,
      payload: { user_id: dto.user_id, permission: dto.permission },
    });

    return saved;
  }

  async findAllAcls(
    tenantId: string,
    query: AclQueryDto,
  ): Promise<{
    data: ResourceAclEntity[];
    total: number;
    page: number;
    limit: number;
  }> {
    const whereClause: any = { tenant_id: tenantId };

    if (query.user_id) whereClause.user_id = query.user_id;
    if (query.resource_type) whereClause.resource_type = query.resource_type;
    if (query.resource_id) whereClause.resource_id = query.resource_id;

    const page = query.page ?? 1;
    const limit = query.limit ?? 20;

    const [data, total] = await this.repository.findAndCount({
      where: whereClause,
      skip: (page - 1) * limit,
      take: limit,
      order: { created_at: 'DESC' },
    });

    return { data, total, page, limit };
  }

  async deleteAcl(
    id: string,
    tenantId: string,
    actorId: string,
  ): Promise<void> {
    this.logger.log(`Deleting ACL | id=${id} tenant_id=${tenantId}`);
    const acl = await this.repository.findOne({
      where: { id, tenant_id: tenantId },
    });
    if (!acl) throw new NotFoundException('ACL not found');

    await this.repository.remove(acl);

    this.eventProducer.emit(KAFKA_TOPICS.IAM_ACL_CHANGED, {
      event_type: 'ACL_DELETED',
      tenant_id: tenantId,
      user_id: acl.user_id,
      resource_type: acl.resource_type,
      resource_id: acl.resource_id,
      payload: { permission: acl.permission },
    });

    this.eventProducer.emit(KAFKA_TOPICS.IAM_AUDIT, {
      event_type: 'ACL_DELETED',
      tenant_id: tenantId,
      actor_id: actorId,
      resource_type: acl.resource_type,
      resource_id: acl.resource_id,
      payload: { user_id: acl.user_id, permission: acl.permission },
    });
  }

  async check(
    tenantId: string,
    dto: CheckAclDto,
  ): Promise<{ allowed: boolean; source: string }> {
    const cacheKey = this.getCacheKey(
      tenantId,
      dto.user_id,
      dto.resource_type,
      dto.resource_id,
      dto.permission,
    );
    const cached = await this.cacheService.get<boolean>(cacheKey);

    if (cached !== undefined && cached !== null) {
      this.logger.log(
        `ACL cache hit | user_id=${dto.user_id} resource_type=${dto.resource_type} resource_id=${dto.resource_id} permission=${dto.permission} result=${cached}`,
      );
      return { allowed: cached, source: 'cache' };
    }

    this.logger.log(
      `ACL cache miss — querying DB | user_id=${dto.user_id} resource_type=${dto.resource_type} resource_id=${dto.resource_id} permission=${dto.permission}`,
    );
    const count = await this.repository.count({
      where: {
        tenant_id: tenantId,
        user_id: dto.user_id,
        resource_type: dto.resource_type,
        resource_id: dto.resource_id,
        permission: dto.permission,
      },
    });

    const allowed = count > 0;

    await this.cacheService.set(cacheKey, allowed, 300);

    return { allowed, source: 'db' };
  }
}
