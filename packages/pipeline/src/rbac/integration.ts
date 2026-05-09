/**
 * PHASE 4: RBAC PIPELINE INTEGRATION
 * Integrate RBAC engine with pipeline stages for security validation
 */

import { RBACEngine, Permission, PolicyContext } from './engine';
import { IntentIR, AppManifest } from '@ai-compiler/schemas';

export interface RBACValidationResult {
  valid: boolean;
  violations: RBACViolation[];
  recommendations: string[];
}

export interface RBACViolation {
  type: 'missing_permission' | 'insecure_default' | 'privilege_escalation' | 'data_exposure';
  severity: 'low' | 'medium' | 'high' | 'critical';
  resource: string;
  action: string;
  description: string;
  recommendation: string;
}

/**
 * RBAC Pipeline Validator
 * Validates generated code for RBAC compliance
 */
export class RBACPipelineValidator {
  constructor(private rbacEngine: RBACEngine) {}

  /**
   * Validate IntentIR for RBAC requirements
   */
  validateIntent(intent: IntentIR): RBACValidationResult {
    const violations: RBACViolation[] = [];
    const recommendations: string[] = [];

    // Check for role definitions
    if (!intent.primaryRoles || intent.primaryRoles.length === 0) {
      violations.push({
        type: 'missing_permission',
        severity: 'high',
        resource: 'system',
        action: 'access',
        description: 'No roles defined in application intent',
        recommendation: 'Define at least basic user roles (Admin, User, etc.)'
      });
    }

    // Check for sensitive operations without RBAC
    const sensitiveOperations = ['delete', 'admin', 'financial', 'medical'];
    const hasSensitiveOps = (intent.requiredEntities || []).some(entity => {
      const core = (entity.corePurpose || '').toLowerCase();
      if (sensitiveOperations.some(s => core.includes(s))) return true;
      const suggested = entity.suggestedFields || [];
      return suggested.some(f => sensitiveOperations.some(s => f.toLowerCase().includes(s)));
    });

    if (hasSensitiveOps && (!intent.primaryRoles || intent.primaryRoles.length < 2)) {
      violations.push({
        type: 'privilege_escalation',
        severity: 'critical',
        resource: 'sensitive_operations',
        action: 'execute',
        description: 'Sensitive operations detected without proper role hierarchy',
        recommendation: 'Implement role-based access control for sensitive operations'
      });
    }

    // Check for data exposure risks
    if ((intent.requiredEntities || []).some(entity =>
      (entity.suggestedFields || []).some(fieldName =>
        fieldName.toLowerCase().includes('password') ||
        fieldName.toLowerCase().includes('ssn') ||
        fieldName.toLowerCase().includes('salary')
      )
    )) {
      recommendations.push('Consider field-level encryption for sensitive data fields');
      recommendations.push('Implement data classification policies');
    }

    return {
      valid: violations.length === 0,
      violations,
      recommendations
    };
  }

  /**
   * Validate AppManifest for RBAC compliance
   */
  validateManifest(manifest: AppManifest): RBACValidationResult {
    const violations: RBACViolation[] = [];
    const recommendations: string[] = [];

    // Check for RBAC enforcement in API endpoints
    const hasRBACMiddleware = manifest.api?.some(endpoint =>
      endpoint.authRequired === true || (endpoint.rolesAllowed && endpoint.rolesAllowed.length > 0)
    );

    if (!hasRBACMiddleware && manifest.api?.length > 0) {
      violations.push({
        type: 'missing_permission',
        severity: 'high',
        resource: 'api',
        action: 'access',
        description: 'API routes defined without RBAC middleware',
        recommendation: 'Add RBAC middleware to all API routes'
      });
    }

    // Check for potential insecure role defaults in database models
    const hasRoleRisk = (manifest.database || []).some((model: any) => {
      const roleField = (model.fields || []).find((f: any) => (f.name || '').toLowerCase() === 'role');
      // Risk if role field exists and default is not explicitly least-privilege 'User'
      return Boolean(roleField && roleField.default !== 'User');
    });

    if (hasRoleRisk) {
      violations.push({
        type: 'insecure_default',
        severity: 'high',
        resource: 'user_model',
        action: 'create',
        description: 'User model contains a role field without a least-privilege default',
        recommendation: 'Ensure default role for new users is `User` and not `Admin`'
      });
    }

    // Check for unauthenticated API endpoints touching user entities
    if (manifest.api?.some(endpoint =>
      (endpoint.touchesEntities || []).some(e => e.toLowerCase().includes('user')) && !endpoint.authRequired
    )) {
      violations.push({
        type: 'data_exposure',
        severity: 'medium',
        resource: 'user_data',
        action: 'read',
        description: 'Unauthenticated API endpoints touching `user` model may expose sensitive data',
        recommendation: 'Require authentication and role checks on endpoints that touch user data'
      });
    }

    return {
      valid: violations.length === 0,
      violations,
      recommendations
    };
  }

  /**
   * Generate RBAC-aware code snippets
   */
  generateRBACCode(intent: IntentIR): string {
    const roles = (intent.primaryRoles || []).map(r => r.name) || ['User', 'Admin'];
    const entities = intent.requiredEntities || [];

    let code = `// RBAC Configuration
const rbacConfig = ${JSON.stringify(this.generateRBACConfig(roles, entities), null, 2)};

// Initialize RBAC Engine
const rbacEngine = new RBACEngine(rbacConfig);

// Middleware for API routes
`;

    // Generate middleware for each entity
    entities.forEach(entity => {
      const entityName = entity.name.toLowerCase();
      code += `
// ${entity.name} CRUD operations with RBAC
app.get('/api/${entityName}', rbacMiddleware.protect('${entityName}', 'read'));
app.post('/api/${entityName}', rbacMiddleware.protect('${entityName}', 'create'));
app.put('/api/${entityName}/:id', rbacMiddleware.protect('${entityName}', 'update'));
app.delete('/api/${entityName}/:id', rbacMiddleware.protect('${entityName}', 'delete'));
`;
    });

    return code;
  }

  // Private methods

  private generateRBACConfig(roles: string[], entities: any[]): any {
    const config = {
      roles: roles.map(role => ({
        name: role,
        description: `${role} role`,
        parentRoles: role === 'Admin' ? [] : ['User'],
        permissions: this.generateRolePermissions(role, entities)
      })),
      policies: [],
      defaultDeny: true,
      enableAudit: true,
      cacheEnabled: true,
      cacheTTL: 300
    };

    return config;
  }

  private generateRolePermissions(role: string, entities: any[]): Permission[] {
    const permissions: Permission[] = [];

    entities.forEach(entity => {
      const entityName = entity.name.toLowerCase();

      if (role === 'Admin') {
        permissions.push({
          resource: entityName,
          action: '*',
          description: `Full access to ${entity.name}`
        });
      } else if (role === 'Manager') {
        permissions.push(
          { resource: entityName, action: 'read', description: `Read ${entity.name}` },
          { resource: entityName, action: 'create', description: `Create ${entity.name}` },
          { resource: entityName, action: 'update', description: `Update ${entity.name}` }
        );
      } else {
        permissions.push(
          { resource: entityName, action: 'read', description: `Read ${entity.name}` },
          { resource: entityName, action: 'create', description: `Create ${entity.name}` }
        );
      }
    });

    return permissions;
  }
}

/**
 * RBAC Pipeline Stage Integration
 */
export class RBACStageIntegration {
  constructor(private validator: RBACPipelineValidator) {}

  /**
   * Integrate RBAC validation into pipeline execution
   */
  async validateAndEnhance(intent: IntentIR, manifest: AppManifest): Promise<{
    intent: IntentIR;
    manifest: AppManifest;
    rbacValidation: RBACValidationResult;
  }> {
    // Validate intent
    const intentValidation = this.validator.validateIntent(intent);

    // First, attempt to enhance manifest with RBAC defaults (auto-fix least-privilege)
    const enhancedManifestAttempt = this.enhanceManifestWithRBAC(manifest, intent);

    // Validate the enhanced manifest so we don't flag issues that were auto-fixed
    const manifestValidation = this.validator.validateManifest(enhancedManifestAttempt);

    // Combine validations
    const combinedValidation: RBACValidationResult = {
      valid: intentValidation.valid && manifestValidation.valid,
      violations: [...intentValidation.violations, ...manifestValidation.violations],
      recommendations: [...intentValidation.recommendations, ...manifestValidation.recommendations]
    };

    // Use the enhanced manifest as the result (we auto-applied defaults and generated code)
    let enhancedManifest = enhancedManifestAttempt;

    return {
      intent,
      manifest: enhancedManifest,
      rbacValidation: combinedValidation
    };
  }

  private enhanceManifestWithRBAC(manifest: AppManifest, intent: IntentIR): AppManifest {
    // Add RBAC middleware to API endpoints
    const enhancedApi = manifest.api?.map(endpoint => ({
      ...endpoint,
      authRequired: true,
      rolesAllowed: [...(endpoint.rolesAllowed || [])]
    })) || [];

    // Add RBAC models
    const rbacModels: any = [
      {
        name: 'Role',
        fields: [
          { name: 'name', type: 'String', isOptional: false },
          { name: 'description', type: 'String', isOptional: true },
          { name: 'permissions', type: 'JSON', isOptional: true }
        ]
      },
      {
        name: 'Permission',
        fields: [
          { name: 'resource', type: 'String', isOptional: false },
          { name: 'action', type: 'String', isOptional: false },
          { name: 'conditions', type: 'JSON', isOptional: true }
        ]
      }
    ];

    // Persist generated RBAC code externally and also alter manifest to set safe defaults
    try {
      const fs = require('fs');
      const path = require('path');
      const outDir = path.join(process.cwd(), '.out', 'app');
      fs.mkdirSync(outDir, { recursive: true });

      // Generate RBAC code and include a default-role enforcer for User creation
      const baseCode = this.validator.generateRBACCode(intent);
      // find user model presence
      const userModel = (manifest.database || []).find((m: any) => (m.name || '').toLowerCase() === 'user');
      let defaultRoleSnippet = '';
      if (userModel) {
        defaultRoleSnippet = `\n// Default role enforcement: ensure new users get least-privilege 'User' role\napp.use((req, res, next) => {\n  if (req.path.startsWith('/api/users') && req.method === 'POST') {\n    if (!req.body) req.body = {};\n    if (!req.body.role) req.body.role = 'User';\n  }\n  next();\n});\n`;
      }

      fs.writeFileSync(path.join(outDir, 'rbac-generated.js'), baseCode + defaultRoleSnippet);

      // Also write a small defaults file for runtime seeds
      const defaults = userModel ? { userDefaultRole: { model: 'User', field: 'role', default: 'User' } } : {};
      fs.writeFileSync(path.join(outDir, 'rbac-defaults.json'), JSON.stringify(defaults, null, 2));

      // Modify manifest-level user role default (least-privilege) when user model exists
      if (userModel) {
        const updatedDatabase = (manifest.database || []).map((m: any) => {
          if ((m.name || '').toLowerCase() === 'user') {
            const updatedFields = (m.fields || []).map((f: any) => {
              if ((f.name || '').toLowerCase() === 'role') {
                return { ...f, default: 'User', isOptional: false };
              }
              return f;
            });
            return { ...m, fields: updatedFields };
          }
          return m;
        });

        // return updated manifest database below
        manifest = { ...manifest, database: updatedDatabase } as AppManifest;
      }
    } catch (e) {
      // ignore write errors here; caller will handle
    }

    return {
      ...manifest,
      api: enhancedApi,
      database: [...(manifest.database || []), ...rbacModels]
    };
  }
}