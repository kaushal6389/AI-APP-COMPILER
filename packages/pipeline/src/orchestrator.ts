import { IntentExtractionStage } from './stages/intent';
import { SystemDesignStage } from './stages/design';
import { SchemaGenerationStage } from './stages/schema';
import { ValidationAndRepairStage } from './stages/validation';
import { RuntimeLayer } from '../../runtime/src';
import { runDAG, DagNode } from './dag/engine';
import type { IntentIR, DesignIR, ValidatedManifest } from './ir/types';
import { runSemanticChecks } from './semantic/checker';
import { RepairEngine } from '../../repair-engine/src';
import { runRbacChecks } from './rbac/checker';
import { DeterministicPipeline } from './ir/deterministic';
import { createRBACSystem } from './rbac';
import { SimpleCache } from './cache/simpleCache';
import { compileUiSchema } from './ui/compiler';

export class CompilerOrchestrator {
  private intentStage = new IntentExtractionStage();
  private designStage = new SystemDesignStage();
  private schemaStage = new SchemaGenerationStage();
  private validationRepairStage = new ValidationAndRepairStage();
  private runtimeLayer = new RuntimeLayer();

  // Phase 9: simple in-memory cache for manifests/code artifacts
  private manifestCache = new SimpleCache<any>(600); // 10 minutes

  // PHASE 4: Initialize RBAC system
  private rbacSystem = createRBACSystem();

  public async compile(prompt: string, sendEvent?: (data: any) => void) {
    const notifyType = (type: string, data?: any) => {
      console.log(`[STAGE] ${type}`);
      if (sendEvent) sendEvent({ type, data });
    };

    const stageStart: Record<string, number> = {};
    const markStart = (stage: string) => {
      stageStart[stage] = Date.now();
    };
    const markEnd = (stage: string) => {
      const start = stageStart[stage];
      return typeof start === 'number' ? Date.now() - start : 0;
    };

    notifyType('START');

    try {
      // PHASE 8: Initialize deterministic pipeline
      let deterministicPipeline: DeterministicPipeline | null = null;

      // Build DAG nodes for stages. Each node returns its output into the shared results map.
      const nodes: DagNode[] = [
        {
          name: 'INTENT_EXTRACTION',
          run: async () => {
            notifyType('INTENT_EXTRACTION_START');
            const start = Date.now();
            const intentIR = await this.intentStage.execute(prompt);
            const durationMs = Date.now() - start;
            // Use authoritative normalized confidence from intent debug data when available
            const intentConfidence = intentIR?.debug?.selectedDomain?.confidence ?? intentIR?.confidence ?? (intentIR.hallucinationRisk === 'Low' ? 0.95 : intentIR.hallucinationRisk === 'Medium' ? 0.78 : 0.6);
            notifyType('INTENT_EXTRACTION_END', { intentIR, durationMs, confidence: intentConfidence });
            return intentIR;
          }
        },
        {
          name: 'SYSTEM_DESIGN',
          deps: ['INTENT_EXTRACTION'],
          run: async (r) => {
            notifyType('SYSTEM_DESIGN_START');
            const start = Date.now();
            const designIR = await this.designStage.execute(r['INTENT_EXTRACTION']);
            const durationMs = Date.now() - start;
            notifyType('SYSTEM_DESIGN_END', { designIR, durationMs });
            return designIR;
          }
        },
        {
          name: 'SCHEMA_GENERATION',
          deps: ['INTENT_EXTRACTION', 'SYSTEM_DESIGN'],
          run: async (r) => {
            notifyType('SCHEMA_GENERATION_START');
            const start = Date.now();
            const appManifest = await this.schemaStage.execute(r['INTENT_EXTRACTION'], r['SYSTEM_DESIGN']);
            const durationMs = Date.now() - start;

            // PHASE 8: Initialize deterministic pipeline with intent + design + manifest
            deterministicPipeline = new DeterministicPipeline(
              r['INTENT_EXTRACTION'],
              r['SYSTEM_DESIGN'],
              appManifest
            );

            // Apply deterministic transforms to manifest
            const deterministicManifest = deterministicPipeline.applyDeterministicTransforms();

            notifyType('SCHEMA_GENERATION_END', {
              appManifest: deterministicManifest,
              durationMs,
              deterministic: deterministicPipeline.getDeterminismReport()
            });
            return deterministicManifest;
          }
        },
        {
          name: 'RBAC_VALIDATION',
          deps: ['INTENT_EXTRACTION', 'SCHEMA_GENERATION'],
          run: async (r) => {
            notifyType('RBAC_VALIDATION_START');
            const start = Date.now();

            // PHASE 4: Enhanced RBAC validation using new engine
            const rbacValidation = await this.rbacSystem.integration.validateAndEnhance(
              r['INTENT_EXTRACTION'],
              r['SCHEMA_GENERATION']
            );

            const durationMs = Date.now() - start;
            notifyType('RBAC_VALIDATION_END', {
              rbacValidation,
              durationMs,
              violations: rbacValidation.rbacValidation.violations.length,
              recommendations: rbacValidation.rbacValidation.recommendations.length
            });

            // Fail fast on critical RBAC violations
            if (!rbacValidation.rbacValidation.valid) {
              const criticalViolations = rbacValidation.rbacValidation.violations.filter(
                v => v.severity === 'critical'
              );
              if (criticalViolations.length > 0) {
                sendEvent?.({ type: 'RBAC_CRITICAL_VIOLATIONS', data: criticalViolations });
                throw new Error('Critical RBAC violations detected; aborting pipeline');
              }
            }

            return rbacValidation;
          }
        },
        {
          name: 'VALIDATION',
          deps: ['RBAC_VALIDATION'],
          run: async (r) => {
            notifyType('VALIDATION_START');
            const start = Date.now();

            // Use RBAC-enhanced manifest
            const rbacResult = r['RBAC_VALIDATION'];
            const validatedManifest = await this.validationRepairStage.execute(
              rbacResult.intent,
              rbacResult.manifest,
              sendEvent,
              prompt
            );

            const durationMs = Date.now() - start;
            notifyType('VALIDATION_END', { validatedManifest, durationMs });
            return validatedManifest;
          }
        },
        {
          name: 'UI_SCHEMA',
          deps: ['VALIDATION'],
          run: async (r) => {
            notifyType('UI_SCHEMA_START');
            const start = Date.now();
            const validatedManifest = r['VALIDATION'];

            const uiSchema = compileUiSchema(validatedManifest);

            try {
              const fs = require('fs');
              const path = require('path');
              const outDir = path.join(process.cwd(), '.out', 'app');
              fs.mkdirSync(outDir, { recursive: true });
              fs.writeFileSync(path.join(outDir, 'ui-schema.json'), JSON.stringify(uiSchema, null, 2));
            } catch (e) {
              sendEvent?.({ type: 'UI_SCHEMA_WRITE_ERROR', data: String(e) });
            }

            const durationMs = Date.now() - start;
            notifyType('UI_SCHEMA_END', { uiSchema, durationMs });
            return uiSchema;
          }
        },
        {
          name: 'SEMANTIC_CHECK',
          deps: ['VALIDATION'],
          run: async (r) => {
            notifyType('SEMANTIC_CHECK_START');
            const start = Date.now();
            const outcome = runSemanticChecks(r['INTENT_EXTRACTION'], r['SYSTEM_DESIGN'], r['VALIDATION']);
            const durationMs = Date.now() - start;
            notifyType('SEMANTIC_CHECK_END', { outcome, durationMs });

            if (!outcome.passed) {
              // Emit the semantic issues
              sendEvent?.({ type: 'SEMANTIC_ISSUES', data: outcome.issues });

              // Trigger repair engine to attempt fixes based on semantic issues
              try {
                console.log('[SEMANTIC] Triggering RepairEngine due to semantic failures...');
                const repairer = new RepairEngine();
                let attempts = 0;
                const maxAttempts = 3;
                let totalRepairsApplied = 0;
                let currentManifest = r['VALIDATION'];
                let currentOutcome = outcome;

                while (!currentOutcome.passed && attempts < maxAttempts) {
                  attempts++;
                  const repaired = await repairer.attemptRepair(currentManifest, currentOutcome.issues || []);
                  // replace the validation manifest in the running DAG results so downstream nodes use repaired manifest
                  r['VALIDATION'] = repaired;
                  currentManifest = repaired;

                  const applied = (repaired as any)?.repairCount ?? (currentOutcome.issues || []).length;
                  totalRepairsApplied += applied;
                  sendEvent?.({ type: 'REPAIR_APPLIED', data: { message: `Semantic repair engine applied patches to manifest (attempt ${attempts}).`, repairCount: applied } });

                  // Re-run semantic checks on the repaired manifest
                  currentOutcome = runSemanticChecks(r['INTENT_EXTRACTION'], r['SYSTEM_DESIGN'], currentManifest);
                  sendEvent?.({ type: 'SEMANTIC_RECHECK', data: { attempt: attempts, outcome: currentOutcome } });
                }

                if (!currentOutcome.passed) {
                  sendEvent?.({ type: 'REPAIR_FAILED', data: { message: 'Semantic repairs did not resolve all issues after multiple attempts.', attempts, issues: currentOutcome.issues } });
                  throw new Error('Unresolvable semantic issues after repair attempts; aborting pipeline');
                }

                // final success
                notifyType('SEMANTIC_REPAIRS_COMPLETE');
                console.log(`[SEMANTIC] Repairs completed after ${attempts} attempt(s). Total fixes applied: ${totalRepairsApplied}`);
              } catch (repairErr) {
                console.error('[SEMANTIC] Repair engine failed:', String(repairErr));
                sendEvent?.({ type: 'REPAIR_FAILED', data: String(repairErr) });
                throw repairErr;
              }
            }

            return outcome;
          }
        },
        {
          name: 'RBAC_CHECK',
          deps: ['SEMANTIC_CHECK', 'RBAC_VALIDATION'],
          run: async (r) => {
            notifyType('RBAC_CHECK_START');
            const start = Date.now();

            // Use both old checker for compatibility and new engine for enhanced validation
            const legacyOutcome = runRbacChecks(r['RBAC_VALIDATION'].intent, r['VALIDATION']);
            const rbacValidation = r['RBAC_VALIDATION'].rbacValidation;

            // Combine results
            const combinedOutcome = {
              ...legacyOutcome,
              rbacValidation,
              passed: legacyOutcome.passed && rbacValidation.valid,
              issues: [
                ...(legacyOutcome.issues || []),
                ...rbacValidation.violations.map(v => ({
                  level: v.severity === 'critical' ? 'error' : v.severity === 'high' ? 'warning' : 'info',
                  message: `${v.type}: ${v.description}`,
                  recommendation: v.recommendation
                }))
              ]
            };

            const durationMs = Date.now() - start;
            notifyType('RBAC_CHECK_END', { outcome: combinedOutcome, durationMs });

            if (!combinedOutcome.passed) {
              sendEvent?.({ type: 'RBAC_ISSUES', data: combinedOutcome.issues });
            }

            // Persist enhanced RBAC artifacts
            try {
              const fs = require('fs');
              const path = require('path');
              const outDir = path.join(process.cwd(), '.out', 'app');
              fs.mkdirSync(outDir, { recursive: true });

              // Enhanced RBAC report
              const enhancedReport = {
                legacy: legacyOutcome,
                rbacValidation,
                combined: combinedOutcome,
                rbacConfig: this.rbacSystem.config,
                generatedCode: this.rbacSystem.validator.generateRBACCode(r['RBAC_VALIDATION'].intent)
              };

              fs.writeFileSync(path.join(outDir, 'rbac-enhanced-report.json'), JSON.stringify(enhancedReport, null, 2));

              // RBAC test harness
              const testFile = `
const assert = require('assert');
const fs = require('fs');
const path = require('path');
const report = JSON.parse(fs.readFileSync(path.join(__dirname, 'rbac-enhanced-report.json'), 'utf8'));

// Test legacy compatibility
assert(report.legacy, 'Legacy RBAC check should be present');
assert(typeof report.legacy.passed === 'boolean', 'Legacy passed should be boolean');

// Test new RBAC validation
assert(report.rbacValidation, 'RBAC validation should be present');
assert(typeof report.rbacValidation.valid === 'boolean', 'RBAC validation valid should be boolean');

// Test combined outcome
assert(report.combined, 'Combined outcome should be present');
assert(typeof report.combined.passed === 'boolean', 'Combined passed should be boolean');

// Test RBAC config
assert(report.rbacConfig, 'RBAC config should be present');
assert(Array.isArray(report.rbacConfig.roles), 'RBAC config should have roles array');

// Test generated code
assert(report.generatedCode, 'Generated RBAC code should be present');
assert(typeof report.generatedCode === 'string', 'Generated code should be string');

console.log('Enhanced RBAC tests OK');
`;

              fs.writeFileSync(path.join(outDir, 'rbac-enhanced-tests.js'), testFile);
            } catch (e) {
              sendEvent?.({ type: 'RBAC_WRITE_ERROR', data: String(e) });
            }

            // Fail fast on critical RBAC errors
            if (combinedOutcome.issues && combinedOutcome.issues.some((it: any) => it.level === 'error')) {
              const err = new Error('Critical RBAC validation failed; aborting pipeline');
              sendEvent?.({ type: 'RBAC_CRITICAL', data: combinedOutcome.issues });
              throw err;
            }

            return combinedOutcome;
          }
        },
        {
          name: 'CODE_GENERATION',
          deps: ['VALIDATION', 'UI_SCHEMA'],
          run: async (r) => {
            notifyType('CODE_GENERATION_START');
            const start = Date.now();

            // PHASE 8: Ensure deterministic manifest is used
            const finalManifest = deterministicPipeline
              ? deterministicPipeline.applyDeterministicTransforms()
              : r['VALIDATION'];

            // Phase 9: Check cache by semantic combined hash using atomic getOrSet
            let cacheKey: string | null = null;
            let codeArtifacts: any = null;
            try {
              if (deterministicPipeline) {
                const hash = deterministicPipeline.getSemanticHash();
                cacheKey = hash.combinedHash;

                const result = await this.manifestCache.getOrSet(cacheKey, async () => {
                  notifyType('CODE_GENERATION_CACHE_MISS', { key: cacheKey });
                  const artifacts = await this.runtimeLayer.execute(finalManifest, 'app');
                  return { manifest: finalManifest, codeArtifacts: artifacts, uiSchema: r['UI_SCHEMA'] };
                });

                codeArtifacts = result.codeArtifacts;
                notifyType('CODE_GENERATION_CACHE_SET', { key: cacheKey });
                // emit stats
                const stats = this.manifestCache.getStats();
                notifyType('CACHE_STATS', { stats });
              } else {
                codeArtifacts = await this.runtimeLayer.execute(finalManifest, 'app');
              }
            } catch (e) {
              // fallback to direct generation
              codeArtifacts = await this.runtimeLayer.execute(finalManifest, 'app');
            }

            const durationMs = Date.now() - start;
            notifyType('CODE_GENERATION_END', { codeArtifacts, durationMs });
            return codeArtifacts;
          }
        }
      ];

      const results = await runDAG(nodes, { cache: true, sendEvent: sendEvent });

      notifyType('PIPELINE_COMPLETE');

      // Cast stage outputs to typed IRs where possible
      const intentIR = results['INTENT_EXTRACTION'] as IntentIR;
      const designIR = results['SYSTEM_DESIGN'] as DesignIR;
      const validatedManifest = results['VALIDATION'] as ValidatedManifest;
      const codeArtifacts = results['CODE_GENERATION'];

      return {
        intentIR,
        designIR,
        manifest: validatedManifest,
        codeArtifacts,
        deterministic: deterministicPipeline?.getDeterminismReport()
      };
    } catch (error: any) {
      console.error(error);
      notifyType('PIPELINE_FAILED', { error: error.message });
      throw error;
    }
  }
}
