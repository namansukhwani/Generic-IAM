import { computeEffectivePermissions, hasPermission } from './permission-matcher.util';

describe('Permission Matcher Utility', () => {
  describe('computeEffectivePermissions', () => {
    it('should combine role permissions and grants, and subtract denies', () => {
      const rolePerms = new Set(['expense.read', 'expense.write']);
      const grants = new Set(['report.read', 'expense.approve']);
      const denies = new Set(['expense.write']);

      const effective = computeEffectivePermissions(rolePerms, grants, denies);
      
      expect(effective.has('expense.read')).toBe(true);
      expect(effective.has('expense.write')).toBe(false);
      expect(effective.has('report.read')).toBe(true);
      expect(effective.has('expense.approve')).toBe(true);
      expect(effective.size).toBe(3);
    });
  });

  describe('hasPermission', () => {
    it('returns true for exact match', () => {
      const perms = new Set(['expense.departments.create']);
      expect(hasPermission(perms, 'expense.departments.create')).toBe(true);
    });

    it('returns true for global wildcard', () => {
      const perms = new Set(['*.*']);
      expect(hasPermission(perms, 'expense.departments.create')).toBe(true);
    });
    
    it('returns true for single asterisk global wildcard', () => {
      const perms = new Set(['*']);
      expect(hasPermission(perms, 'expense.departments.create')).toBe(true);
    });

    it('returns true for service wildcard', () => {
      const perms = new Set(['expense.*']);
      expect(hasPermission(perms, 'expense.departments.create')).toBe(true);
      expect(hasPermission(perms, 'expense.claims.read')).toBe(true);
    });

    it('returns true for sub-resource wildcard', () => {
      const perms = new Set(['expense.departments.*']);
      expect(hasPermission(perms, 'expense.departments.create')).toBe(true);
      expect(hasPermission(perms, 'expense.departments.budget.update')).toBe(true);
    });

    it('returns false for mismatched resource', () => {
      const perms = new Set(['expense.*']);
      expect(hasPermission(perms, 'payroll.read')).toBe(false);
    });

    it('returns false for mismatched action', () => {
      const perms = new Set(['expense.departments.read']);
      expect(hasPermission(perms, 'expense.departments.write')).toBe(false);
    });
    
    it('returns false for partial match without wildcard', () => {
      const perms = new Set(['expense.departments']);
      expect(hasPermission(perms, 'expense.departments.read')).toBe(false);
    });
  });
});
