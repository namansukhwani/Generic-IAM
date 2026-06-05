import {
  Injectable,
  OnModuleInit,
  OnModuleDestroy,
  Logger,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { AuditLogEntity } from './entities/audit-log.entity';
import { AuditQueryDto } from './dto/audit-query.dto';
import { Subject, Subscription } from 'rxjs';
import { bufferTime, filter } from 'rxjs/operators';

export class AuditEventPayload {
  event_type: string;
  tenant_id?: string;
  actor_id?: string;
  user_id?: string;
  resource_type?: string;
  resource_id?: string;
  correlation_id?: string;
  payload?: Record<string, any>;
  changes?: any;
}

@Injectable()
export class AuditService implements OnModuleInit, OnModuleDestroy {
  private readonly logger = new Logger(AuditService.name);
  private eventSubject = new Subject<AuditEventPayload>();
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
        void this.flushBatch(batch);
      });
  }

  onModuleDestroy() {
    // complete() causes bufferTime to emit any remaining buffered events before finishing
    this.eventSubject.complete();
    if (this.subscription) {
      this.subscription.unsubscribe();
    }
  }

  pushEvent(eventPayload: AuditEventPayload) {
    this.logger.log(
      `Queuing audit event | event_type=${eventPayload.event_type} tenant_id=${eventPayload.tenant_id ?? 'N/A'}`,
    );
    this.eventSubject.next(eventPayload);
  }

  private async flushBatch(batch: AuditEventPayload[]) {
    const start = Date.now();
    this.logger.log(`Flushing audit batch | size=${batch.length}`);
    try {
      const entities = batch.map((event) => {
        return this.auditRepository.create({
          event_type: event.event_type || 'UNKNOWN',
          tenant_id: event.tenant_id,
          actor_id: event.actor_id,
          actor_type: event.user_id ? 'user' : 'system',
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
      this.logger.log(
        `Audit batch flushed | size=${batch.length} duration_ms=${Date.now() - start}`,
      );
    } catch (err) {
      this.logger.error(
        `Failed to flush audit logs batch | size=${batch.length}`,
        (err as Error).stack,
      );
    }
  }

  async queryLogs(query: AuditQueryDto): Promise<{
    data: AuditLogEntity[];
    total: number;
    page: number;
    limit: number;
  }> {
    const page = query.page || 1;
    const limit = query.limit || 100;

    const qb = this.auditRepository
      .createQueryBuilder('audit')
      .orderBy('audit.created_at', 'DESC')
      .skip((page - 1) * limit)
      .take(limit);

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

    const [data, total] = await qb.getManyAndCount();
    return { data, total, page, limit };
  }
}
