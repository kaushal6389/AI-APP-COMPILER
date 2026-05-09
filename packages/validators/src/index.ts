import { IntentIR, AppManifest, ValidationReportSchema } from '@ai-compiler/schemas';
import { z } from 'zod';

export function validateCrossSchemaIntegrity(
  intent: IntentIR, 
  manifest: AppManifest
): z.infer<typeof ValidationReportSchema> {
  const errors: any[] = [];
  
  // Extract canonical lists from previous validated stages
  const validRoles = new Set(intent.primaryRoles.map(r => r.name));
  const validModels = new Set(manifest.database.map(m => m.name));

  // ==========================================
  // RULE 1: API Roles must belong to Intent Roles
  // ==========================================
  manifest.api.forEach((route, apiIndex) => {
    if (route.rolesAllowed) {
      route.rolesAllowed.forEach((role, roleIndex) => {
        if (!validRoles.has(role)) {
          errors.push({
            stage: "Stage 4 (Validation)",
            path: `api[${apiIndex}].rolesAllowed[${roleIndex}]`,
            message: `Hallucinated Role: '${role}' is not defined in Stage 1 Intent. Valid roles are: ${Array.from(validRoles).join(', ')}`,
            severity: "Critical"
          });
        }
      });
    }
  });

  // ==========================================
  // RULE 2: DB Relations must point to valid Models
  // ==========================================
  manifest.database.forEach((model, modelIndex) => {
    if (model.relations) {
      model.relations.forEach((relation, relIndex) => {
        if (!validModels.has(relation.targetModel)) {
          errors.push({
            stage: "Stage 4 (Validation)",
            path: `database[${modelIndex}].relations[${relIndex}].targetModel`,
            message: `Broken Relationship: Target model '${relation.targetModel}' does not exist in the database schema.`,
            severity: "Critical"
          });
        }
      });
    }
  });

  return {
    isValid: errors.length === 0,
    errors
  };
}
