import { computeEffectivePermissions, hasPermission } from './permission-matcher.util';

describe('Permission Matcher Utility', () => {
  describe('computeEffectivePermissions', () => {
    it('should combine role permissions and grants, and subtract denies', () => {
      const rolePerms = new Set(['expense:read', 'expense:write']);
      const grants = new Set(['report:read', 'expense:approve']);
      const denies = new Set(['expense:write']);

      const effective = computeEffectivePermissions(rolePerms, grants, denies);
      
      expect(effective.has('expense:read')).toBe(true);
      expect(effective.has('expense:write')).toBe(false);
      expect(effective.has('report:read')).toBe(true);
      expect(effective.has('expense:approve')).toBe(true);
      expect(effective.size).toBe(3);
    });

    it('deny always wins over grant', () => {
      const rolePerms = new Set(['expense:read']);
      const grants = new Set(['expense:write']);
      const denies = new Set(['expense:write']);

      const effective = computeEffectivePermissions(rolePerms, grants, denies);
      
      expect(effective.has('expense:write')).toBe(false);
    });
  });

  describe('hasPermission', () => {
    it('returns true for exact match', () => {
      const perms = new Set(['expense:read']);
      expect(hasPermission(perms, 'expense:read')).toBe(true);
    });

    it('returns true for global wildcard', () => {
      const perms = new Set(['*:*']);
      expect(hasPermission(perms, 'expense:read')).toBe(true);
    });

    it('returns true for resource wildcard', () => {
      const perms = new Set(['expense:*']);
      expect(hasPermission(perms, 'expense:read')).toBe(true);
      expect(hasPermission(perms, 'expense:delete')).toBe(true);
    });

    it('returns false for mismatched resource', () => {
      const perms = new Set(['expense:*']);
      expect(hasPermission(perms, 'payroll:read')).toBe(false);
    });

    it('returns false for mismatched action', () => {
      const perms = new Set(['expense:read']);
      expect(hasPermission(perms, 'expense:write')).toBe(false);
    });
  });
});
