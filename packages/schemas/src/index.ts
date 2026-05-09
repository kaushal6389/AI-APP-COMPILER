import { z } from 'zod';

// ==========================================
// STAGE 1: DETERMINISTIC INTENT IR
// ==========================================

export const DomainEnum = z.enum([
  'CRM', 
  'Healthcare', 
  'E-commerce', 
  'SaaS', 
  'Marketplace', 
  'SocialNetwork', 
  'EdTech', 
  'FinTech', 
  'InternalTool',
  'AIHiringPlatform',      // Phase 1: New domain
  'LegalAIPlatform',       // Phase 1: New domain
  'ContentPlatform',       // Phase 1: New domain
  'GenericTask'
]);

export const RoleSchema = z.object({
  name: z.string().describe("Exact role name, e.g. Admin, Patient, Doctor."),
  description: z.string(),
  isSystem: z.boolean().default(false).describe("True if it's a hidden system role.")
});

export const EntitySchema = z.object({
  name: z.string().describe("PascalCase singular name, e.g. Patient, Invoice"),
  corePurpose: z.string(),
  isDomainCritical: z.boolean().describe("True if the app cannot function without this entity"),
  suggestedFields: z.array(z.string()).describe("List of implied properties based on domain")
});

export const IntegrationSchema = z.object({
  provider: z.string().describe("e.g. Stripe, SendGrid, Twilio, AWS S3"),
  purpose: z.string()
});

export const IntentSchema = z.object({
  domain: DomainEnum,
  summary: z.string(),
  primaryRoles: z.array(RoleSchema).min(1, "At least one role is required"),
  requiredEntities: z.array(EntitySchema).min(2, "At least two core entities are required"),
  impliedIntegrations: z.array(IntegrationSchema),
  businessRules: z.array(z.string()).describe("Hard constraints, e.g., 'A Doctor must verify an appointment before prescription'"),
  hallucinationRisk: z.enum(['Low', 'Medium', 'High']).describe("Model's own assessment of ambiguity in the prompt.")
});
export type IntentIR = z.infer<typeof IntentSchema>;

// ==========================================
// STAGE 2: ARCHITECTURE (DAG) SCHEMA
// ==========================================

export const DbFieldSchema = z.object({
  name: z.string(),
  type: z.enum(['String', 'Int', 'Float', 'Boolean', 'DateTime', 'JSON']),
  isUnique: z.boolean().default(false),
  isOptional: z.boolean().default(false),
  isList: z.boolean().default(false)
});

export const DbRelationSchema = z.object({
  name: z.string().optional(),
  type: z.enum(['hasOne', 'hasMany', 'belongsTo', 'ManyToMany']),
  targetModel: z.string(),
  foreignKey: z.string().optional()
});

export const DatabaseModelSchema = z.object({
  name: z.string().describe("Must match an entity from Intent IR"),
  fields: z.array(DbFieldSchema).min(1),
  relations: z.array(DbRelationSchema).default([])
});

export const ApiEndpointSchema = z.object({
  method: z.enum(['GET', 'POST', 'PUT', 'PATCH', 'DELETE']),
  path: z.string().describe("e.g. /api/users"),
  purpose: z.string(),
  authRequired: z.boolean(),
  rolesAllowed: z.array(z.string()).describe("Must match roles from Intent IR"),
  touchesEntities: z.array(z.string()).describe("Which DB models this hits")
});

export const AppSchema = z.object({
  database: z.array(DatabaseModelSchema),
  api: z.array(ApiEndpointSchema),
});
export type AppManifest = z.infer<typeof AppSchema>;

export const DesignModuleSchema = z.object({
  name: z.string(),
  responsibility: z.string(),
  dependencies: z.array(z.string()).describe('Other modules this module depends on')
});

export const DesignRelationshipSchema = z.object({
  from: z.string(),
  to: z.string(),
  relationType: z.string()
});

export const UserFlowSchema = z.object({
  role: z.string(),
  entryPoint: z.string(),
  paths: z.array(z.string())
});

export const DesignSchema = z.object({
  architecture: z.string(),
  modules: z.array(DesignModuleSchema),
  entityRelationships: z.array(DesignRelationshipSchema),
  userFlows: z.array(UserFlowSchema),
  serviceBoundaries: z.record(z.array(z.string()))
});
export type DesignIR = z.infer<typeof DesignSchema>;

// ==========================================
// STAGE 3: VALIDATION & REPAIR SCHEMAS
// ==========================================

export const ValidationErrorSchema = z.object({
  code: z.enum(['MISSING_ENTITY', 'ROLE_MISMATCH', 'ORPHAN_ROUTE', 'RELATION_MISMATCH', 'MISSING_AUTH']),
  message: z.string(),
  context: z.any()
});

export const ValidationReportSchema = z.object({
  isValid: z.boolean(),
  errors: z.array(ValidationErrorSchema),
});

export const RepairActionSchema = z.object({
  targetModule: z.enum(['Database', 'API', 'Roles']),
  instruction: z.string().describe("Exact system prompt addition to fix the hallucination")
});
