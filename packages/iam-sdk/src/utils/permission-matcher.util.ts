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
  if (effectivePermissions.has('*.*')) return true;

  // e.g. required = "expense.departments.create"
  // Should match "expense.*", "expense.departments.*", "expense.departments.create"
  
  const parts = required.split('.');
  
  // Build all wildcard prefixes to check
  // For "a.b.c", we check "a.b.c", "a.b.*", "a.*", "*"
  // Wait, '*.*' is already checked.
  // We can just build them iteratively.
  
  let current = '';
  for (let i = 0; i < parts.length; i++) {
    const wildcard = current ? `${current}.*` : '*';
    if (effectivePermissions.has(wildcard)) {
      return true;
    }
    current = current ? `${current}.${parts[i]}` : parts[i];
  }
  
  // Exact match
  if (effectivePermissions.has(required)) {
    return true;
  }

  return false;
}
