export type RbacPermission = string;

export type RbacRole = {
  name: string;
  inherits?: string[];
  permissions: RbacPermission[];
};

export type RbacApiPermission = {
  method: string;
  path: string;
  permission: RbacPermission;
  roles: string[];
};

export type RbacPolicy = {
  version: '1.0';
  roles: RbacRole[];
  resources: Array<{ name: string; actions: string[] }>;
  apiPermissions: RbacApiPermission[];
};

const actionForMethod = (method: string) => {
  const m = method.toUpperCase();
  if (m === 'GET') return 'read';
  if (m === 'POST') return 'create';
  if (m === 'PUT' || m === 'PATCH') return 'update';
  if (m === 'DELETE') return 'delete';
  return 'execute';
};

export const permissionForRoute = (route: any) => {
  const entity = (route.touchesEntities && route.touchesEntities[0]) || 'resource';
  const action = actionForMethod(route.method || 'GET');
  return `${String(entity).toLowerCase()}:${action}`;
};

export const buildRbacPolicy = (manifest: any): RbacPolicy => {
  const roleSet = new Set<string>();
  const resources = new Map<string, Set<string>>();
  const rolePermissions = new Map<string, Set<string>>();
  const apiPermissions: RbacApiPermission[] = [];

  for (const route of manifest.api || []) {
    const roles = (route.rolesAllowed || []).map((r: any) => String(r).trim()).filter(Boolean);
    const permission = permissionForRoute(route);
    apiPermissions.push({ method: route.method, path: route.path, permission, roles });

    const entity = (route.touchesEntities && route.touchesEntities[0]) || 'resource';
    const action = actionForMethod(route.method || 'GET');
    if (!resources.has(entity)) resources.set(entity, new Set());
    resources.get(entity)!.add(action);

    for (const role of roles) {
      roleSet.add(role);
      if (!rolePermissions.has(role)) rolePermissions.set(role, new Set());
      rolePermissions.get(role)!.add(permission);
    }
  }

  const roles: RbacRole[] = Array.from(roleSet).map((name) => ({
    name,
    permissions: Array.from(rolePermissions.get(name) || [])
  }));

  const resourceList = Array.from(resources.entries()).map(([name, actions]) => ({
    name,
    actions: Array.from(actions)
  }));

  return {
    version: '1.0',
    roles,
    resources: resourceList,
    apiPermissions
  };
};
