export const SYSTEM_PERMISSIONS = {
  GLOBAL_ALL: '*.*',
  EXPENSE: {
    ALL: 'expense.*',
    READ: 'expense.read',
    WRITE: 'expense.write',
    DELETE: 'expense.delete',
    APPROVE: 'expense.approve',
  },
  PAYROLL: {
    ALL: 'payroll.*',
    READ: 'payroll.read',
    WRITE: 'payroll.write',
    APPROVE: 'payroll.approve',
  },
  USER: {
    ALL: 'user.*',
    READ: 'user.read',
    WRITE: 'user.write',
    DELETE: 'user.delete',
  },
  ROLE: {
    ALL: 'role.*',
    READ: 'role.read',
    WRITE: 'role.write',
    ASSIGN: 'role.assign',
  },
  INVOICE: {
    ALL: 'invoice.*',
    READ: 'invoice.read',
    WRITE: 'invoice.write',
    DELETE: 'invoice.delete',
    APPROVE: 'invoice.approve',
  },
  REPORT: {
    ALL: 'report.*',
    READ: 'report.read',
    WRITE: 'report.write',
    EXPORT: 'report.export',
  },
  WORKFLOW: {
    ALL: 'workflow.*',
    READ: 'workflow.read',
    WRITE: 'workflow.write',
    EXECUTE: 'workflow.execute',
  },
  TENANT: {
    ALL: 'tenant.*',
    READ: 'tenant.read',
    WRITE: 'tenant.write',
  },
  ACL: {
    ALL: 'acl.*',
  },
  AUDIT: {
    ALL: 'audit.*',
    READ: 'audit.read',
  },
};
