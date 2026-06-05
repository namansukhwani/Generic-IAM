export const SYSTEM_PERMISSIONS = {
  GLOBAL_ALL: '*.*',
  EXPENSE: {
    ALL: 'expense.*',
    DEPARTMENTS: {
      CREATE: 'expense.departments.create',
      LIST: 'expense.departments.list',
      READ: 'expense.departments.read',
      UPDATE: 'expense.departments.update',
      BUDGET: {
        UPDATE: 'expense.departments.budget.update',
      },
    },
    CATEGORIES: {
      CREATE: 'expense.categories.create',
      LIST: 'expense.categories.list',
      UPDATE: 'expense.categories.update',
    },
    EXCHANGE_RATES: {
      CREATE: 'expense.exchange-rates.create',
      LIST: 'expense.exchange-rates.list',
      DELETE: 'expense.exchange-rates.delete',
    },
    SETTINGS: {
      READ: 'expense.settings.read',
      UPDATE: 'expense.settings.update',
    },
    EXPENSES: {
      CREATE: 'expense.expenses.create',
      LIST: 'expense.expenses.list',
      READ: 'expense.expenses.read',
      UPDATE: 'expense.expenses.update',
      DELETE: 'expense.expenses.delete',
      RECEIPT: {
        UPLOAD: 'expense.expenses.receipt.upload',
        DOWNLOAD: 'expense.expenses.receipt.download',
        DELETE: 'expense.expenses.receipt.delete',
      },
    },
    CLAIMS: {
      CREATE: 'expense.claims.create',
      LIST: 'expense.claims.list',
      READ: 'expense.claims.read',
      UPDATE: 'expense.claims.update',
      SUBMIT: 'expense.claims.submit',
      WITHDRAW: 'expense.claims.withdraw',
    },
    APPROVALS: {
      PENDING: { LIST: 'expense.approvals.pending.list' },
      HISTORY: { LIST: 'expense.approvals.history.list' },
      CLAIMS: {
        READ: 'expense.approvals.claims.read',
        APPROVE: 'expense.approvals.claims.approve',
        PARTIAL_APPROVE: 'expense.approvals.claims.partial-approve',
        REJECT: 'expense.approvals.claims.reject',
      },
    },
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
