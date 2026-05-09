/**
 * PHASE 4: TRUE RBAC ENGINE - MAIN EXPORTS
 * Complete RBAC system for enterprise applications
 */

export * from './engine';
export * from './middleware';
export * from './config';
export * from './integration';

// Re-export commonly used types
export type {
  Role,
  Permission,
  Policy,
  PolicyContext,
  AccessDecision,
  RBACConfig
} from './engine';

export type {
  RBACRequest
} from './middleware';

export type {
  RBACValidationResult,
  RBACViolation
} from './integration';

/**
 * Convenience function to create a complete RBAC system
 */
export function createRBACSystem(domain?: string) {
  const { createDomainRBACConfig } = require('./config');
  const { RBACEngine } = require('./engine');
  const { createRBACMiddleware } = require('./middleware');
  const { RBACPipelineValidator, RBACStageIntegration } = require('./integration');

  const config = createDomainRBACConfig(domain || 'default');
  const engine = new RBACEngine(config);
  const middleware = createRBACMiddleware(engine);
  const validator = new RBACPipelineValidator(engine);
  const integration = new RBACStageIntegration(validator);

  return {
    config,
    engine,
    middleware,
    validator,
    integration
  };
}