const actionForMethod = (method: string) => {
  const m = String(method || 'GET').toUpperCase();
  if (m === 'GET') return 'read';
  if (m === 'POST') return 'create';
  if (m === 'PUT' || m === 'PATCH') return 'update';
  if (m === 'DELETE') return 'delete';
  return 'execute';
};

const permissionForRoute = (route: any) => {
  const entity = (route.touchesEntities && route.touchesEntities[0]) || 'resource';
  return `${String(entity).toLowerCase()}:${actionForMethod(route.method)}`;
};

export function runRbacChecks(intentIR: any, manifest: any) {
  const issues: Array<{ level: 'info'|'warning'|'error'; message: string }> = [];

  const intentRoles = new Set<string>((intentIR?.primaryRoles || []).map((r: any) => String(r.name).trim()));
  const manifestRoles = new Set<string>();
  for (const api of (manifest?.api || [])) {
    for (const r of (api.rolesAllowed || [])) manifestRoles.add(String(r).trim());
  }

  // Missing roles: roles declared in intent but not used in API
  for (const r of intentRoles) {
    if (!manifestRoles.has(r as string)) {
      issues.push({ level: 'warning', message: `Role '${r}' declared by intent but not used in APIs.` });
    }
  }

  // Orphan roles: roles used in API but not declared in intent
  for (const r of manifestRoles) {
    if (!intentRoles.has(r)) {
      issues.push({ level: 'info', message: `Role '${r}' used in APIs but not declared in intent.` });
    }
  }

  // Critical: no roles defined in manifest APIs while intent declares roles
  const hasApiWithRoles = (manifest?.api || []).some((a: any) => Array.isArray(a.rolesAllowed) && a.rolesAllowed.length > 0);
  if (!hasApiWithRoles && intentRoles.size > 0) {
    issues.push({ level: 'error', message: 'No roles defined on any API but intent declares primary roles.' });
  }

  // Simple overlap detection: roles with very similar names
  const roleList: string[] = Array.from(new Set([...intentRoles, ...manifestRoles]));
  for (let i = 0; i < roleList.length; i++) {
    for (let j = i+1; j < roleList.length; j++) {
      const a = roleList[i].toLowerCase();
      const b = roleList[j].toLowerCase();
      if (a.includes(b) || b.includes(a)) {
        issues.push({ level: 'info', message: `Possible overlap between roles '${roleList[i]}' and '${roleList[j]}'.` });
      }
    }
  }

  // Build a simple role matrix (API path -> roles)
  const roleMatrix: Record<string, string[]> = {};
  for (const api of (manifest?.api || [])) {
    roleMatrix[api.path] = (api.rolesAllowed || []).map((r: any) => String(r).trim());
  }

  // Build an explicit RBAC policy mapping (role -> permissions)
  const rolePermissions: Record<string, Set<string>> = {};
  const apiPermissions: Array<{ method: string; path: string; permission: string; roles: string[] }> = [];
  for (const api of (manifest?.api || [])) {
    const permission = permissionForRoute(api);
    const roles = (api.rolesAllowed || []).map((r: any) => String(r).trim()).filter(Boolean);
    apiPermissions.push({ method: api.method, path: api.path, permission, roles });
    for (const role of roles) {
      if (!rolePermissions[role]) rolePermissions[role] = new Set<string>();
      rolePermissions[role].add(permission);
    }
  }

  for (const r of intentRoles) {
    if (!rolePermissions[r] || rolePermissions[r].size === 0) {
      issues.push({ level: 'warning', message: `Role '${r}' has no permissions mapped from APIs.` });
    }
  }

  const passed = !issues.some(i => i.level === 'error');
  const policy = {
    version: '1.0',
    roles: Object.entries(rolePermissions).map(([name, perms]) => ({ name, permissions: Array.from(perms) })),
    apiPermissions
  };

  return { passed, issues, roleMatrix, policy };
}
