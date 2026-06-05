const fs = require('fs');

const controllers = [
  'src/modules/acl/acl.controller.ts',
  'src/modules/rbac/permission.controller.ts',
  'src/modules/rbac/role.controller.ts',
  'src/modules/rbac/assignment.controller.ts',
  'src/modules/auth/auth.controller.ts',
  'src/modules/super-admin/super-admin.controller.ts',
];

for (const file of controllers) {
  let content = fs.readFileSync(file, 'utf8');
  // Add import if missing
  if (!content.includes('JwtPayload')) {
    content = "import { JwtPayload } from '../../common/interfaces/jwt-payload.interface';\n" + content;
  }
  content = content.replace(/@CurrentUser\(\) user: any/g, '@CurrentUser() user: JwtPayload');
  content = content.replace(/user\.tenantId/g, '(user.tenant_id as string)');
  content = content.replace(/user\.userId/g, 'user.sub');
  fs.writeFileSync(file, content);
}

// User controller specific
let userController = fs.readFileSync('src/modules/user/user.controller.ts', 'utf8');
userController = userController.replace(/order: \{ created_at: 'DESC' \} as any/g, "order: { created_at: 'DESC' }");
userController = userController.replace(/\(u: any\)/g, '(u: any)'); // Actually let's type it as UserEntity
userController = userController.replace(/\(u: any\) => new UserResponseDto\(u\)/g, '(u) => new UserResponseDto(u)');
fs.writeFileSync('src/modules/user/user.controller.ts', userController);

// Other fixes
const auditService = 'src/modules/audit/audit.service.ts';
let auditContent = fs.readFileSync(auditService, 'utf8');
auditContent = auditContent.replace(/pushEvent\(eventPayload: any\)/g, 'pushEvent(eventPayload: AuditEventPayload)');
auditContent = auditContent.replace(/flushBatch\(batch: any\[\]\)/g, 'flushBatch(batch: AuditEventPayload[])');
if (!auditContent.includes('export interface AuditEventPayload')) {
  auditContent = auditContent.replace("import { Injectable, Logger } from '@nestjs/common';", "import { Injectable, Logger } from '@nestjs/common';\n\nexport interface AuditEventPayload {\n  event_type: string;\n  tenant_id?: string;\n  actor_id?: string;\n  resource_type?: string;\n  resource_id?: string;\n  payload?: Record<string, unknown>;\n}");
}
fs.writeFileSync(auditService, auditContent);

const auditConsumer = 'src/modules/audit/audit.consumer.ts';
let acContent = fs.readFileSync(auditConsumer, 'utf8');
if (!acContent.includes('AuditEventPayload')) {
  acContent = acContent.replace("import { AuditService } from './audit.service';", "import { AuditService, AuditEventPayload } from './audit.service';");
}
acContent = acContent.replace(/@Payload\(\) message: any/g, '@Payload() message: AuditEventPayload');
fs.writeFileSync(auditConsumer, acContent);

const eventProducer = 'src/event/event.producer.ts';
let epContent = fs.readFileSync(eventProducer, 'utf8');
epContent = epContent.replace(/payload\?: any;/g, 'payload?: Record<string, unknown>;');
fs.writeFileSync(eventProducer, epContent);

const eventConsumer = 'src/event/event.consumer.ts';
let ecContent = fs.readFileSync(eventConsumer, 'utf8');
if (!ecContent.includes('PermissionChangedEvent')) {
  ecContent = ecContent.replace("import { EventPattern, Payload } from '@nestjs/microservices';", "import { EventPattern, Payload } from '@nestjs/microservices';\n\nexport interface PermissionChangedEvent {\n  tenant_id: string;\n  user_id?: string;\n  role_id?: string;\n}");
}
ecContent = ecContent.replace(/@Payload\(\) message: any/g, '@Payload() message: PermissionChangedEvent');
fs.writeFileSync(eventConsumer, ecContent);

const overrideService = 'src/modules/rbac/override.service.ts';
let osContent = fs.readFileSync(overrideService, 'utf8');
osContent = osContent.replace(/let rolePermissions: any\[\] = \[\];/g, 'let rolePermissions: PermissionEntity[] = [];');
osContent = osContent.replace(/dto: any/g, 'dto: CreateOverrideDto');
if (!osContent.includes('PermissionEntity')) {
  osContent = osContent.replace("import { OverrideEntity }", "import { PermissionEntity } from './entities/permission.entity';\nimport { OverrideEntity }"); // adjust if needed
}
fs.writeFileSync(overrideService, osContent);

const saController = 'src/modules/super-admin/super-admin.controller.ts';
let saContent = fs.readFileSync(saController, 'utf8');
if (!saContent.includes('AuditLogFilterDto')) {
  saContent = "export interface AuditLogFilterDto { [key: string]: string; }\n" + saContent;
}
saContent = saContent.replace(/@Query\(\) filters: any/g, '@Query() filters: AuditLogFilterDto');
fs.writeFileSync(saController, saContent);

const jwtStrategy = 'src/modules/auth/strategies/jwt.strategy.ts';
let jwtContent = fs.readFileSync(jwtStrategy, 'utf8');
jwtContent = jwtContent.replace(/validate\(payload: any\)/g, 'validate(payload: JwtPayload)');
fs.writeFileSync(jwtStrategy, jwtContent);

const tenantPipe = 'src/common/pipes/tenant-validation.pipe.ts';
let pipeContent = fs.readFileSync(tenantPipe, 'utf8');
pipeContent = pipeContent.replace(/transform\(value: any, /g, 'transform(value: string, ');
fs.writeFileSync(tenantPipe, pipeContent);

console.log('done');
