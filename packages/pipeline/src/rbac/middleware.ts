/**
 * PHASE 4: RBAC MIDDLEWARE
 * Express middleware for enforcing RBAC permissions on API routes
 */

import { Request, Response, NextFunction } from 'express';
import { RBACEngine, Permission, PolicyContext } from './engine';

export interface RBACRequest extends Request {
  user?: {
    id: string;
    roles: string[];
    [key: string]: any;
  };
  rbac?: {
    evaluated: boolean;
    allowed: boolean;
    decision?: any;
  };
}

/**
 * RBAC Middleware Factory
 */
export class RBACMiddleware {
  constructor(private rbacEngine: RBACEngine) {}

  /**
   * Create middleware for protecting routes
   */
  protect(resource: string, action: string, conditions?: Permission['conditions']) {
    return (req: RBACRequest, res: Response, next: NextFunction) => {
      try {
        // Extract user roles from request
        const userRoles = this.extractUserRoles(req);
        if (!userRoles || userRoles.length === 0) {
          return res.status(401).json({
            error: 'Authentication required',
            message: 'No user roles found in request'
          });
        }

        // Build permission
        const permission: Permission = {
          resource,
          action,
          conditions
        };

        // Build policy context
        const context: Partial<PolicyContext> = {
          user: req.user,
          resource: this.extractResourceData(req),
          action,
          environment: {
            method: req.method,
            path: req.path,
            userAgent: req.get('User-Agent'),
            ip: req.ip,
            timestamp: new Date().toISOString()
          },
          request: req
        };

        // Evaluate permission
        const decision = this.rbacEngine.evaluate(userRoles, permission, context.resource, context);

        // Store decision in request for later use
        req.rbac = {
          evaluated: true,
          allowed: decision.allowed,
          decision
        };

        if (!decision.allowed) {
          return res.status(403).json({
            error: 'Access denied',
            message: decision.reason || 'Insufficient permissions',
            resource,
            action,
            appliedPolicies: decision.appliedPolicies
          });
        }

        next();
      } catch (error) {
        console.error('RBAC middleware error:', error);
        res.status(500).json({
          error: 'Authorization error',
          message: 'Failed to evaluate permissions'
        });
      }
    };
  }

  /**
   * Create conditional middleware that only protects if condition is met
   */
  conditionalProtect(condition: (req: RBACRequest) => boolean, resource: string, action: string, conditions?: Permission['conditions']) {
    return (req: RBACRequest, res: Response, next: NextFunction) => {
      if (condition(req)) {
        return this.protect(resource, action, conditions)(req, res, next);
      }
      next();
    };
  }

  /**
   * Create field-level filtering middleware
   */
  fieldFilter(resource: string, action: string = 'read') {
    return (req: RBACRequest, res: Response, next: NextFunction) => {
      // This would filter response data based on field-level permissions
      // For now, just pass through - full implementation in Phase 4.2
      next();
    };
  }

  /**
   * Check permission without blocking (for conditional logic)
   */
  checkPermission(resource: string, action: string, conditions?: Permission['conditions']) {
    return (req: RBACRequest, res: Response, next: NextFunction) => {
      const userRoles = this.extractUserRoles(req);
      if (!userRoles) {
        req.rbac = { evaluated: true, allowed: false };
        return next();
      }

      const permission: Permission = { resource, action, conditions };
      const context: Partial<PolicyContext> = {
        user: req.user,
        resource: this.extractResourceData(req),
        action,
        environment: { method: req.method, path: req.path }
      };

      const decision = this.rbacEngine.evaluate(userRoles, permission, context.resource, context);
      req.rbac = {
        evaluated: true,
        allowed: decision.allowed,
        decision
      };

      next();
    };
  }

  // Private helper methods

  private extractUserRoles(req: RBACRequest): string[] | null {
    // Try multiple sources for user roles
    if (req.user?.roles) {
      return Array.isArray(req.user.roles) ? req.user.roles : [req.user.roles];
    }

    // Check JWT token payload
    if (req.user && typeof req.user === 'object') {
      const user = req.user as any;
      if (user.role) return [user.role];
      if (user.roles) return Array.isArray(user.roles) ? user.roles : [user.roles];
    }

    // Check session
    if ((req as any).session?.user?.roles) {
      return (req as any).session.user.roles;
    }

    return null;
  }

  private extractResourceData(req: RBACRequest): any {
    // Extract resource data from request body, params, or query
    const data = {
      ...req.body,
      ...req.params,
      ...req.query
    };

    // Add request context
    return {
      ...data,
      _request: {
        method: req.method,
        path: req.path,
        params: req.params,
        query: req.query
      }
    };
  }
}

/**
 * Convenience functions for common RBAC patterns
 */
export const createRBACMiddleware = (rbacEngine: RBACEngine) => new RBACMiddleware(rbacEngine);

/**
 * Standard CRUD permission helpers
 */
export const crudPermissions = {
  create: (resource: string) => ({ resource, action: 'create' }),
  read: (resource: string) => ({ resource, action: 'read' }),
  update: (resource: string) => ({ resource, action: 'update' }),
  delete: (resource: string) => ({ resource, action: 'delete' }),
  execute: (resource: string) => ({ resource, action: 'execute' })
};

/**
 * Common conditions for field-level security
 */
export const commonConditions = {
  // User can only access their own records
  ownsRecord: (userIdField: string = 'userId'): Permission['conditions'] => [{
    field: userIdField,
    operator: 'eq',
    value: '${user.id}', // Template variable
    description: 'User can only access their own records'
  }],

  // User cannot access admin records
  notAdmin: (roleField: string = 'role'): Permission['conditions'] => [{
    field: roleField,
    operator: 'ne',
    value: 'Admin',
    description: 'Cannot access admin-level records'
  }],

  // Time-based restrictions
  businessHours: (): Permission['conditions'] => [{
    field: '_request.timestamp',
    operator: 'in',
    value: 'businessHours', // Would be evaluated by policy engine
    description: 'Access restricted to business hours'
  }]
};