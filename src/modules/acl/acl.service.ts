import { Injectable, NotFoundException, Inject } from '@nestjs/common';
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

@Injectable()
export class AclService extends BaseService<ResourceAclEntity> {
  constructor(
    @InjectRepository(ResourceAclEntity)
    protected readonly aclRepository: Repository<ResourceAclEntity>,
    @Inject(CACHE_MANAGER) private cacheManager: Cache,
    private readonly eventProducer: EventProducer,
  ) {
    super(aclRepository);
  }

  private getCacheKey(tenantId: string, userId: string, resourceType: string, resourceId: string, permission: string): string {
    return `acl:${tenantId}:${userId}:${resourceType}:${resourceId}:${permission}`;
  }

  async createAcl(tenantId: string, dto: CreateAclDto, actorId: string): Promise<ResourceAclEntity> {
    const existing = await this.aclRepository.findOne({
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

    const acl = this.aclRepository.create({
      tenant_id: tenantId,
      user_id: dto.user_id,
      resource_type: dto.resource_type,
      resource_id: dto.resource_id,
      permission: dto.permission,
    });

    const saved = await this.aclRepository.save(acl);

    // Invalidate cache since permission is added
    const cacheKey = this.getCacheKey(tenantId, dto.user_id, dto.resource_type, dto.resource_id, dto.permission);
    await this.cacheManager.del(cacheKey);

    this.eventProducer.emit('iam.audit', {
      event_type: 'ACL_CREATED',
      tenant_id: tenantId,
      actor_id: actorId,
      resource_type: dto.resource_type,
      resource_id: dto.resource_id,
      payload: { user_id: dto.user_id, permission: dto.permission },
    });

    return saved;
  }

  async findAllAcls(tenantId: string, query: AclQueryDto): Promise<ResourceAclEntity[]> {
    const whereClause: any = { tenant_id: tenantId };
    
    if (query.user_id) whereClause.user_id = query.user_id;
    if (query.resource_type) whereClause.resource_type = query.resource_type;
    if (query.resource_id) whereClause.resource_id = query.resource_id;

    return this.aclRepository.find({ where: whereClause });
  }

  async deleteAcl(id: string, tenantId: string, actorId: string): Promise<void> {
    const acl = await this.aclRepository.findOne({ where: { id, tenant_id: tenantId } });
    if (!acl) throw new NotFoundException('ACL not found');

    await this.aclRepository.remove(acl);

    // Invalidate cache
    const cacheKey = this.getCacheKey(tenantId, acl.user_id, acl.resource_type, acl.resource_id, acl.permission);
    await this.cacheManager.del(cacheKey);

    this.eventProducer.emit('iam.audit', {
      event_type: 'ACL_DELETED',
      tenant_id: tenantId,
      actor_id: actorId,
      resource_type: acl.resource_type,
      resource_id: acl.resource_id,
      payload: { user_id: acl.user_id, permission: acl.permission },
    });
  }

  async check(tenantId: string, dto: CheckAclDto): Promise<{ allowed: boolean; source: string }> {
    const cacheKey = this.getCacheKey(tenantId, dto.user_id, dto.resource_type, dto.resource_id, dto.permission);
    const cached = await this.cacheManager.get<boolean>(cacheKey);

    if (cached !== undefined && cached !== null) {
      return { allowed: cached, source: 'cache' };
    }

    const count = await this.aclRepository.count({
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
