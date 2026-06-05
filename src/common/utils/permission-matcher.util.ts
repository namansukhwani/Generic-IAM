export function computeEffectivePermissions(
  rolePermissions: Set<string>,
  userGrants: Set<string>,
  userDenies: Set<string>,
): Set<string> {
  const effective = new Set(rolePermissions);

  userGrants.forEach((p) => effective.add(p));
  userDenies.forEach((p) => effective.delete(p));

  return effective;
}

export function hasPermission(
  effectivePermissions: Set<string>,
  required: string,
): boolean {
  if (effectivePermissions.has(required)) return true;
  if (effectivePermissions.has('*:*')) return true;

  const [resource] = required.split(':');
  if (effectivePermissions.has(`${resource}:*`)) return true;

  return false;
}
