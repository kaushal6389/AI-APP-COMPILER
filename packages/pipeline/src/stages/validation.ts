import { IntentIR, AppManifest } from '@ai-compiler/schemas';
import { CONTRACT, pluralize } from '../config/contract';
import { ContradictionDetectionEngine } from '../validation/contradictionEngine';

export class ValidationAndRepairStage {
  public async execute(intent: IntentIR, manifest: AppManifest, sendEvent?: (data: any) => void, prompt?: string): Promise<AppManifest> {
    console.log("Validating Cross-Layer References...");
    
    const errors: any[] = [];

    // PHASE 3: Contradiction Detection (BLOCKING)
    if (prompt) {
      const contradictionEngine = new ContradictionDetectionEngine();
      const contradictions = contradictionEngine.detect(intent, manifest, prompt);
      
      // FATAL contradictions block compilation
      if (!contradictions.passed) {
        console.error('\n[CONTRADICTION DETECTION] FATAL contradictions found:');
        for (const fatal of contradictions.fatalities) {
          console.error(`  ❌ [${fatal.code}] ${fatal.message}`);
          console.error(`     → ${fatal.suggestedResolution}`);
        }
        throw new Error(`Fatal contradictions detected (${contradictions.summary.fatalCount}). Architecture is impossible.`);
      }
      
      // Warnings and errors are logged but don't block
      if (contradictions.summary.warningCount > 0 || contradictions.summary.errorCount > 0) {
        console.warn('[CONTRADICTION DETECTION] Issues found:');
        for (const issue of contradictions.findings.filter(f => f.level === 'WARNING' || f.level === 'ERROR')) {
          console.warn(`  ⚠️  [${issue.level}] ${issue.message}`);
        }
      }
    }
    
    const dbModels = manifest.database.map((d) => d.name);
    const apiEntities = new Set(manifest.api.flatMap((route) => route.touchesEntities));
    const validRoles = intent.primaryRoles.map((r) => r.name);
    const requiredEntities = intent.requiredEntities.map((entity) => entity.name);

    // Check 1: Required entities must exist in DB
    for (const req of requiredEntities) {
      if (!dbModels.includes(req)) {
        errors.push({
          code: 'MISSING_ENTITY',
          message: `Critical Entity ${req} is missing from the Database graph.`,
          context: { entityName: req }
        });
      }
    }

    // Check 2: Each DB model must have at least one API route
    for (const model of dbModels) {
      if (!apiEntities.has(model)) {
        errors.push({
          code: 'ORPHAN_ROUTE',
          message: `No API route defined for entity ${model}.`,
          context: { entityName: model }
        });
      }
    }

    // Check 3: Role consistency
    for (const route of manifest.api) {
      for (const routeRole of route.rolesAllowed) {
        if (!validRoles.includes(routeRole)) {
          errors.push({
            code: 'ROLE_MISMATCH',
            message: `API Route ${route.path} allows hallucinated role '${routeRole}'.`,
            context: { route: route.path, invalidRole: routeRole }
          });
        }
      }
    }

    // Check 4: Auth coverage on protected routes
    for (const route of manifest.api) {
      if (!route.authRequired) {
        errors.push({
          code: 'MISSING_AUTH',
          message: `API Route ${route.path} is missing authRequired=true.`,
          context: { route: route.path }
        });
      }
    }

    // Check 5: Integration driven entities
    const hasBillingIntegration = intent.impliedIntegrations.some(
      (integration) => integration.purpose.toLowerCase() === 'billing'
    );
    if (hasBillingIntegration && !dbModels.includes('Payment')) {
      errors.push({
        code: 'MISSING_ENTITY',
        message: 'Billing integration detected but Payment entity is missing.',
        context: { entityName: 'Payment' }
      });
    }
    const hasAnalyticsIntegration = intent.impliedIntegrations.some(
      (integration) => integration.purpose.toLowerCase() === 'analytics'
    );
    if (hasAnalyticsIntegration && !dbModels.includes('AnalyticsEvent')) {
      errors.push({
        code: 'MISSING_ENTITY',
        message: 'Analytics integration detected but AnalyticsEvent entity is missing.',
        context: { entityName: 'AnalyticsEvent' }
      });
    }

    // Check 6: Contract enforcement for id field
    for (const model of manifest.database) {
      const hasId = model.fields.some((field) => field.name === CONTRACT.idFieldName);
      if (!hasId) {
        errors.push({
          code: 'RELATION_MISMATCH',
          message: `Entity ${model.name} is missing contract id field '${CONTRACT.idFieldName}'.`,
          context: { entityName: model.name }
        });
      }
    }

    // Check 7: API route path must match contract base path
    for (const route of manifest.api) {
      const model = route.touchesEntities[0];
      const expectedPath = `${CONTRACT.apiBasePath}/${pluralize(model)}`;
      if (route.path !== expectedPath) {
        errors.push({
          code: 'RELATION_MISMATCH',
          message: `Route ${route.path} does not match contract path ${expectedPath}.`,
          context: { route: route.path, expectedPath }
        });
      }
    }

    // Check 8: Each entity must expose GET + POST routes
    for (const model of dbModels) {
      const expectedPath = `${CONTRACT.apiBasePath}/${pluralize(model)}`;
      const hasGet = manifest.api.some((route) => route.path === expectedPath && route.method === 'GET');
      const hasPost = manifest.api.some((route) => route.path === expectedPath && route.method === 'POST');
      if (!hasGet || !hasPost) {
        errors.push({
          code: 'ORPHAN_ROUTE',
          message: `Route contract missing for ${model}. Required GET + POST on ${expectedPath}.`,
          context: { entityName: model, expectedPath, missing: { get: !hasGet, post: !hasPost } }
        });
      }
    }
    
    if (errors.length > 0) {
      console.log(`FOUND ${errors.length} ERRORS. DECLINING AUTOMATIC STRUCTURAL REPAIRS.`);
      if (sendEvent) sendEvent({ type: 'VALIDATION_FAILED', data: errors });

      // Attach validation errors to manifest for downstream semantic engine to decide
      try { (manifest as any).__validationErrors = errors; } catch (e) {}

      // Do NOT auto-apply structural repairs here — delegate to the RepairEngine
      // which will perform targeted, semantic-aware repairs. Returning the
      // original manifest (with errors attached) ensures semantic checks and
      // repair orchestration see the true failure modes instead of being masked.
      return manifest;
    }

    return manifest;
  }
}
