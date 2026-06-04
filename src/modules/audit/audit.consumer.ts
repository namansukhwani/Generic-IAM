import { Controller } from '@nestjs/common';
import { EventPattern, Payload } from '@nestjs/microservices';
import { AuditService } from './audit.service';

@Controller()
export class AuditConsumer {
  constructor(private readonly auditService: AuditService) {}

  @EventPattern('iam.audit')
  handleAuditLog(@Payload() message: any) {
    this.auditService.pushEvent(message);
  }
}
