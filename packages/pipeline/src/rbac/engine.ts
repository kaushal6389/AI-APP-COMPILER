/**
 * PHASE 4: TRUE RBAC ENGINE
 * Enterprise-grade Role-Based Access Control with inheritance and field-level permissions
 */

export interface Role {
  name: string;
  description: string;
  parentRoles: string[]; // Role inheritance (Admin inherits Manager permissions)
  permissions: Permission[];
  isSystem: boolean;
  metadata?: Record<string, any>;
}

export interface Permission {
  resource: string;     // "user", "contact", "deal:*", "user:email"
  action: string;       // "create", "read", "update", "delete", "execute"
  conditions?: Condition[]; // Field-level constraints
  description?: string;
}

export interface Condition {
  field: string;
  operator: "eq" | "ne" | "gt" | "lt" | "gte" | "lte" | "in" | "contains" | "not_contains";
  value: any;
  description?: string;
}

export interface Policy {
  name: string;
  description: string;
  rules: PolicyRule[];
  priority: number; // Higher priority rules evaluated first
  enabled: boolean;
}

export interface PolicyRule {
  name: string;
  condition: (context: PolicyContext) => boolean;
  effect: "allow" | "deny";
  permissions: Permission[];
  description?: string;
}

export interface PolicyContext {
  user: any;
  resource: any;
  action: string;
  environment: Record<string, any>; // time, location, device, etc.
  request?: any; // HTTP request context
}

export interface AccessDecision {
  allowed: boolean;
  reason?: string;
  appliedPolicies: string[];
  evaluatedPermissions: Permission[];
  executionTimeMs: number;
}

export interface RBACConfig {
  roles: Role[];
  policies: Policy[];
  defaultDeny: boolean; // Deny by default unless explicitly allowed
  enableAudit: boolean;
  cacheEnabled: boolean;
  cacheTTL: number; // seconds
}

/**
 * Core RBAC Engine - evaluates permissions with role inheritance and conditions
 */
export class RBACEngine {
  private roleMap: Map<string, Role> = new Map();
  private policyMap: Map<string, Policy> = new Map();
  private permissionCache: Map<string, AccessDecision> = new Map();
  private config: RBACConfig;

  constructor(config: RBACConfig) {
    this.config = config;
    this.initializeRoles();
    this.initializePolicies();
  }

  /**
   * Evaluate if user has permission for action on resource
   */
  evaluate(userRoles: string[], permission: Permission, resource?: any, context?: Partial<PolicyContext>): AccessDecision {
    const startTime = Date.now();
    const cacheKey = this.buildCacheKey(userRoles, permission, resource, context);

    // Check cache first
    if (this.config.cacheEnabled) {
      const cached = this.permissionCache.get(cacheKey);
      if (cached && (Date.now() - startTime) < (this.config.cacheTTL * 1000)) {
        return cached;
      }
    }

    // Expand roles with inheritance
    const effectiveRoles = this.expandRoles(userRoles);

    // Evaluate static permissions
    const staticResult = this.evaluateStaticPermissions(effectiveRoles, permission);

    // Evaluate conditions if permission granted and conditions exist
    let finalAllowed = staticResult.allowed;
    if (finalAllowed && permission.conditions && resource) {
      finalAllowed = this.evaluateConditions(permission.conditions, resource);
    }

    // Apply dynamic policies
    const policyResult = this.evaluatePolicies(effectiveRoles, permission, resource, context);
    finalAllowed = finalAllowed && policyResult.allowed;

    // Default deny behavior
    if (this.config.defaultDeny && !finalAllowed) {
      finalAllowed = false;
    }

    const decision: AccessDecision = {
      allowed: finalAllowed,
      reason: staticResult.reason || policyResult.reason,
      appliedPolicies: policyResult.appliedPolicies,
      evaluatedPermissions: [permission],
      executionTimeMs: Date.now() - startTime
    };

    // Cache result
    if (this.config.cacheEnabled) {
      this.permissionCache.set(cacheKey, decision);
    }

    return decision;
  }

  /**
   * Check if user can perform action on resource (convenience method)
   */
  can(userRoles: string[], action: string, resource: string, resourceData?: any, context?: Partial<PolicyContext>): boolean {
    const permission: Permission = {
      resource,
      action
    };
    return this.evaluate(userRoles, permission, resourceData, context).allowed;
  }

  /**
   * Get all permissions for given roles (expanded with inheritance)
   */
  getEffectivePermissions(userRoles: string[]): Permission[] {
    const effectiveRoles = this.expandRoles(userRoles);
    const permissions: Permission[] = [];

    for (const roleName of effectiveRoles) {
      const role = this.roleMap.get(roleName);
      if (role) {
        permissions.push(...role.permissions);
      }
    }

    return permissions;
  }

  /**
   * Add or update a role
   */
  setRole(role: Role): void {
    this.roleMap.set(role.name, role);
    this.clearCache(); // Invalidate cache on role changes
  }

  /**
   * Add or update a policy
   */
  setPolicy(policy: Policy): void {
    this.policyMap.set(policy.name, policy);
    this.clearCache(); // Invalidate cache on policy changes
  }

  /**
   * Validate RBAC configuration for consistency
   */
  validateConfiguration(): { valid: boolean; errors: string[] } {
    const errors: string[] = [];

    // Check for circular role inheritance
    for (const role of this.config.roles) {
      if (this.hasCircularInheritance(role.name, new Set())) {
        errors.push(`Circular role inheritance detected for role: ${role.name}`);
      }
    }

    // Check for duplicate permissions
    const seenPermissions = new Set<string>();
    for (const role of this.config.roles) {
      for (const perm of role.permissions) {
        const key = `${role.name}:${perm.resource}:${perm.action}`;
        if (seenPermissions.has(key)) {
          errors.push(`Duplicate permission in role ${role.name}: ${perm.resource}:${perm.action}`);
        }
        seenPermissions.add(key);
      }
    }

    // Check policy priorities are unique
    const priorities = new Set<number>();
    for (const policy of this.config.policies) {
      if (priorities.has(policy.priority)) {
        errors.push(`Duplicate policy priority: ${policy.priority}`);
      }
      priorities.add(policy.priority);
    }

    return {
      valid: errors.length === 0,
      errors
    };
  }

  // Private methods

  private initializeRoles(): void {
    for (const role of this.config.roles) {
      this.roleMap.set(role.name, role);
    }
  }

  private initializePolicies(): void {
    for (const policy of this.config.policies) {
      this.policyMap.set(policy.name, policy);
    }
  }

  private expandRoles(userRoles: string[]): string[] {
    const expanded = new Set<string>();

    const expandRole = (roleName: string) => {
      if (expanded.has(roleName)) return; // Prevent infinite recursion

      expanded.add(roleName);
      const role = this.roleMap.get(roleName);
      if (role && role.parentRoles) {
        for (const parent of role.parentRoles) {
          expandRole(parent);
        }
      }
    };

    for (const role of userRoles) {
      expandRole(role);
    }

    return Array.from(expanded);
  }

  private evaluateStaticPermissions(effectiveRoles: string[], permission: Permission): { allowed: boolean; reason?: string } {
    for (const roleName of effectiveRoles) {
      const role = this.roleMap.get(roleName);
      if (!role) continue;

      for (const rolePerm of role.permissions) {
        if (this.permissionsMatch(rolePerm, permission)) {
          return { allowed: true, reason: `Role ${roleName} grants permission` };
        }
      }
    }

    return { allowed: false, reason: 'No matching role permission found' };
  }

  private permissionsMatch(rolePerm: Permission, requestedPerm: Permission): boolean {
    // Check resource pattern matching (support wildcards)
    if (!this.resourceMatches(rolePerm.resource, requestedPerm.resource)) {
      return false;
    }

    // Check action matching
    if (rolePerm.action !== requestedPerm.action && rolePerm.action !== '*') {
      return false;
    }

    return true;
  }

  private resourceMatches(pattern: string, resource: string): boolean {
    // Support wildcards: "user:*" matches "user:email", "user" matches "user"
    if (pattern === resource) return true;
    if (pattern === '*') return true;
    if (pattern.endsWith(':*') && resource.startsWith(pattern.slice(0, -1))) return true;
    return false;
  }

  private evaluateConditions(conditions: Condition[], resource: any): boolean {
    for (const condition of conditions) {
      if (!this.evaluateCondition(condition, resource)) {
        return false;
      }
    }
    return true;
  }

  private evaluateCondition(condition: Condition, resource: any): boolean {
    const fieldValue = this.getFieldValue(resource, condition.field);
    if (fieldValue === undefined) return false;

    switch (condition.operator) {
      case 'eq': return fieldValue === condition.value;
      case 'ne': return fieldValue !== condition.value;
      case 'gt': return fieldValue > condition.value;
      case 'lt': return fieldValue < condition.value;
      case 'gte': return fieldValue >= condition.value;
      case 'lte': return fieldValue <= condition.value;
      case 'in': return Array.isArray(condition.value) && condition.value.includes(fieldValue);
      case 'contains': return String(fieldValue).includes(String(condition.value));
      case 'not_contains': return !String(fieldValue).includes(String(condition.value));
      default: return false;
    }
  }

  private getFieldValue(obj: any, fieldPath: string): any {
    return fieldPath.split('.').reduce((current, key) => current?.[key], obj);
  }

  private evaluatePolicies(effectiveRoles: string[], permission: Permission, resource?: any, context?: Partial<PolicyContext>): { allowed: boolean; reason?: string; appliedPolicies: string[] } {
    const appliedPolicies: string[] = [];
    let finalAllowed = true; // Policies are additive unless explicitly denied

    // Sort policies by priority (highest first)
    const sortedPolicies = Array.from(this.policyMap.values())
      .filter(p => p.enabled)
      .sort((a, b) => b.priority - a.priority);

    for (const policy of sortedPolicies) {
      for (const rule of policy.rules) {
        const ruleContext: PolicyContext = {
          user: { roles: effectiveRoles },
          resource: resource || {},
          action: permission.action,
          environment: context?.environment || {},
          request: context?.request,
          ...context
        };

        if (rule.condition(ruleContext)) {
          appliedPolicies.push(`${policy.name}:${rule.name}`);

          // Check if rule applies to this permission
          const ruleApplies = rule.permissions.some(rulePerm =>
            this.permissionsMatch(rulePerm, permission)
          );

          if (ruleApplies) {
            if (rule.effect === 'deny') {
              return {
                allowed: false,
                reason: `Policy ${policy.name} rule ${rule.name} denies access`,
                appliedPolicies
              };
            }
            // Allow rules are additive
            finalAllowed = true;
          }
        }
      }
    }

    return { allowed: finalAllowed, appliedPolicies };
  }

  private buildCacheKey(userRoles: string[], permission: Permission, resource?: any, context?: Partial<PolicyContext>): string {
    const roleKey = userRoles.sort().join(',');
    const permKey = `${permission.resource}:${permission.action}`;
    const resourceKey = resource ? JSON.stringify(resource) : '';
    const contextKey = context ? JSON.stringify(context) : '';
    return `${roleKey}|${permKey}|${resourceKey}|${contextKey}`;
  }

  private hasCircularInheritance(roleName: string, visited: Set<string>): boolean {
    if (visited.has(roleName)) return true;

    visited.add(roleName);
    const role = this.roleMap.get(roleName);
    if (!role) return false;

    for (const parent of role.parentRoles) {
      if (this.hasCircularInheritance(parent, new Set(visited))) {
        return true;
      }
    }

    return false;
  }

  private clearCache(): void {
    this.permissionCache.clear();
  }
}