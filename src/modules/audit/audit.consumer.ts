import { Controller, Logger } from '@nestjs/common';
import { EventPattern, Payload } from '@nestjs/microservices';
import { AuditService, AuditEventPayload } from './audit.service';

import { KAFKA_TOPICS } from '../../common/constants/kafka.constant';

@Controller()
export class AuditConsumer {
  private readonly logger = new Logger(AuditConsumer.name);

  constructor(private readonly auditService: AuditService) {}

  @EventPattern(KAFKA_TOPICS.IAM_AUDIT)
  handleAuditLog(@Payload() message: AuditEventPayload) {
    this.logger.log(
      `Received audit event | event_type=${message.event_type} tenant_id=${message.tenant_id ?? 'N/A'}`,
    );
    this.auditService.pushEvent(message);
  }
}
