export const KAFKA_TOPICS = {
  IAM_AUDIT: 'iam.audit',
  IAM_PERMISSION_CHANGED: 'iam.permission.changed',
  IAM_USER_CHANGED: 'iam.user.changed',
  IAM_ROLE_CHANGED: 'iam.role.changed',
} as const;

export const KAFKA_CONSUMER_GROUPS = {
  IAM_AUDIT_CONSUMER: 'iam-audit-consumer',
  IAM_CACHE_INVALIDATION: 'iam-cache-invalidation',
} as const;
