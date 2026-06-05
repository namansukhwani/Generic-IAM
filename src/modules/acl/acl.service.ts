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
import { CACHE_MANAGER } from '@nestjs/cache-manager';
import type { Cache } from 'cache-manager';
import { ResourceAclEntity } from './entities/resource-acl.entity';
import { CreateAclDto } from './dto/create-acl.dto';
import { CheckAclDto } from './dto/check-acl.dto';
import { AclQueryDto } from './dto/acl-query.dto';
import { EventProducer } from '../../event/event.producer';
import { BaseService } from '../../common/base/base.service';
import type { RequestContext } from '../../common/interfaces/request-context.interface';
import { CacheService } from '../../cache/cache.service';
import { KAFKA_TOPICS } from '../../common/constants/kafka.constant';

@Injectable({ scope: Scope.REQUEST })
export class AclService extends BaseService<ResourceAclEntity> {
  private readonly logger = new Logger(AclService.name);

  constructor(
    @InjectRepository(ResourceAclEntity)
    protected readonly defaultRepository: Repository<ResourceAclEntity>,
    @Inject(CACHE_MANAGER) private cacheManager: Cache,
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

    const saved = await this.repository.save(acl);

    // Clear the acl: lookup cache and the authz: decision that AuthorizationService
    // may have cached (allowed=false before this grant was created).
    const cacheKey = this.getCacheKey(
      tenantId,
      dto.user_id,
      dto.resource_type,
      dto.resource_id,
      dto.permission,
    );
    await this.cacheManager.del(cacheKey);
    await this.cacheService.invalidateAuthzDecision(
      tenantId,
      dto.user_id,
      dto.permission,
      dto.resource_type,
      dto.resource_id,
    );

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
  ): Promise<ResourceAclEntity[]> {
    const whereClause: any = { tenant_id: tenantId };

    if (query.user_id) whereClause.user_id = query.user_id;
    if (query.resource_type) whereClause.resource_type = query.resource_type;
    if (query.resource_id) whereClause.resource_id = query.resource_id;

    return this.repository.find({ where: whereClause });
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

    // Clear the acl: lookup cache and the authz: decision that AuthorizationService
    // may have cached (allowed=true before this grant was revoked).
    const cacheKey = this.getCacheKey(
      tenantId,
      acl.user_id,
      acl.resource_type,
      acl.resource_id,
      acl.permission,
    );
    await this.cacheManager.del(cacheKey);
    await this.cacheService.invalidateAuthzDecision(
      tenantId,
      acl.user_id,
      acl.permission,
      acl.resource_type,
      acl.resource_id,
    );

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
    const cached = await this.cacheManager.get<boolean>(cacheKey);

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

    // Cache the result. TTL could be configured, using 300s (5 min) as default
    await this.cacheManager.set(cacheKey, allowed, 300000); // cache-manager v5 expects ms

    return { allowed, source: 'db' };
  }
}
