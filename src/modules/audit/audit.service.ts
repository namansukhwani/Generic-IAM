import { Injectable, OnModuleInit, OnModuleDestroy } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { AuditLogEntity } from './entities/audit-log.entity';
import { AuditQueryDto } from './dto/audit-query.dto';
import { Subject, Subscription } from 'rxjs';
import { bufferTime, filter } from 'rxjs/operators';

@Injectable()
export class AuditService implements OnModuleInit, OnModuleDestroy {
  private eventSubject = new Subject<any>();
  private subscription: Subscription;

  constructor(
    @InjectRepository(AuditLogEntity)
    private readonly auditRepository: Repository<AuditLogEntity>,
  ) {}

  onModuleInit() {
    this.subscription = this.eventSubject
      .pipe(
        bufferTime(1000, null, 100),
        filter((batch) => batch.length > 0),
      )
      .subscribe((batch) => {
        this.flushBatch(batch);
      });
  }

  onModuleDestroy() {
    if (this.subscription) {
      this.subscription.unsubscribe();
    }
  }

  pushEvent(eventPayload: any) {
    this.eventSubject.next(eventPayload);
  }

  private async flushBatch(batch: any[]) {
    try {
      const entities = batch.map((event) => {
        return this.auditRepository.create({
          event_type: event.event_type || 'UNKNOWN',
          tenant_id: event.tenant_id,
          actor_id: event.actor_id,
          actor_type: event.user_id ? 'user' : 'system', // naive inference
          resource: {
            type: event.resource_type,
            id: event.resource_id,
          },
          metadata: {
            correlation_id: event.correlation_id,
            ...event.payload,
          },
          changes: event.changes || null,
        });
      });

      await this.auditRepository.insert(entities);
    } catch (err) {
      console.error('Failed to flush audit logs batch', err);
    }
  }

  async queryLogs(query: AuditQueryDto): Promise<AuditLogEntity[]> {
    const qb = this.auditRepository
      .createQueryBuilder('audit')
      .orderBy('audit.created_at', 'DESC')
      .limit(100);

    if (query.tenant_id) {
      qb.andWhere('audit.tenant_id = :tenantId', { tenantId: query.tenant_id });
    }
    if (query.actor_id) {
      qb.andWhere('audit.actor_id = :actorId', { actorId: query.actor_id });
    }
    if (query.event_type) {
      qb.andWhere('audit.event_type = :eventType', {
        eventType: query.event_type,
      });
    }
    if (query.resource_type) {
      qb.andWhere(`audit.resource->>'type' = :resourceType`, {
        resourceType: query.resource_type,
      });
    }
    if (query.correlation_id) {
      qb.andWhere(`audit.metadata->>'correlation_id' = :correlationId`, {
        correlationId: query.correlation_id,
      });
    }
    if (query.date_from) {
      qb.andWhere('audit.created_at >= :dateFrom', {
        dateFrom: query.date_from,
      });
    }
    if (query.date_to) {
      qb.andWhere('audit.created_at <= :dateTo', { dateTo: query.date_to });
    }

    return qb.getMany();
  }
}
