import { CompilerOrchestrator } from '../orchestrator';
import { BENCHMARKS, BenchmarkCase } from './benchmarks';

export type BenchmarkResult = {
  id: string;
  category: BenchmarkCase['category'];
  expectedDomain: string;
  resolvedDomain: string;
  entityCoverage: number;
  roleCoverage: number;
  integrationCoverage: number;
  routeCoverage: number;
  hallucinationRate: number;
  latencyMs: number;
  runtimeSuccess: boolean;
  issues: string[];
};

export type BenchmarkSummary = {
  total: number;
  avgEntityCoverage: number;
  avgRoleCoverage: number;
  avgIntegrationCoverage: number;
  avgRouteCoverage: number;
  avgHallucinationRate: number;
  avgLatencyMs: number;
  runtimeSuccessRate: number;
};

const ratio = (numerator: number, denominator: number) =>
  denominator === 0 ? 0 : Number((numerator / denominator).toFixed(2));

const buildIssues = (result: BenchmarkResult) => {
  const issues: string[] = [];
  if (result.entityCoverage < 1) issues.push('Missing required entities');
  if (result.roleCoverage < 1) issues.push('Role mismatch');
  if (result.integrationCoverage < 1) issues.push('Integration mismatch');
  if (result.routeCoverage < 1) issues.push('Routes missing');
  if (!result.runtimeSuccess) issues.push('Runtime artifacts missing');
  return issues;
};

export const runBenchmarks = async () => {
  const orchestrator = new CompilerOrchestrator();
  const results: BenchmarkResult[] = [];

  for (const test of BENCHMARKS) {
    const start = Date.now();
    const artifacts = await orchestrator.compile(test.prompt);
    const end = Date.now();

    const dbEntities = artifacts.manifest.database.map((db) => db.name);
    const apiEntities = new Set(artifacts.manifest.api.flatMap((route) => route.touchesEntities));

    const requiredEntityHits = test.requiredEntities.filter((entity) => dbEntities.includes(entity));
    const requiredRoleHits = test.requiredRoles.filter((role) =>
      artifacts.intentIR.primaryRoles.some((r) => r.name === role)
    );
    const integrationHits = test.expectedIntegrations.filter((provider) =>
      artifacts.intentIR.impliedIntegrations.some((integration) =>
        integration.provider.toLowerCase() === provider.toLowerCase()
      )
    );
    const routeHits = test.requiredEntities.filter((entity) => apiEntities.has(entity));

    const extraEntities = dbEntities.filter((entity) => !test.requiredEntities.includes(entity));

    const result: BenchmarkResult = {
      id: test.id,
      category: test.category,
      expectedDomain: test.expectedDomain,
      resolvedDomain: artifacts.intentIR.domain,
      entityCoverage: ratio(requiredEntityHits.length, test.requiredEntities.length),
      roleCoverage: ratio(requiredRoleHits.length, test.requiredRoles.length),
      integrationCoverage: ratio(integrationHits.length, test.expectedIntegrations.length),
      routeCoverage: ratio(routeHits.length, test.requiredEntities.length),
      hallucinationRate: ratio(extraEntities.length, dbEntities.length),
      latencyMs: end - start,
      runtimeSuccess: Array.isArray(artifacts.codeArtifacts?.files),
      issues: []
    };

    result.issues = buildIssues(result);
    results.push(result);
  }

  const summary: BenchmarkSummary = {
    total: results.length,
    avgEntityCoverage: ratio(results.reduce((sum, r) => sum + r.entityCoverage, 0), results.length),
    avgRoleCoverage: ratio(results.reduce((sum, r) => sum + r.roleCoverage, 0), results.length),
    avgIntegrationCoverage: ratio(results.reduce((sum, r) => sum + r.integrationCoverage, 0), results.length),
    avgRouteCoverage: ratio(results.reduce((sum, r) => sum + r.routeCoverage, 0), results.length),
    avgHallucinationRate: ratio(results.reduce((sum, r) => sum + r.hallucinationRate, 0), results.length),
    avgLatencyMs: ratio(results.reduce((sum, r) => sum + r.latencyMs, 0), results.length),
    runtimeSuccessRate: ratio(results.filter((r) => r.runtimeSuccess).length, results.length)
  };

  return { summary, results };
};
