export function runSemanticChecks(intentIR: any, designIR: any, manifest: any) {
  const issues: Array<{ level: 'info' | 'warning' | 'error'; message: string }> = [];

  // 1) Intent entity coverage
  const intentEntities = (intentIR?.requiredEntities || []).map((e: any) => e.name);
  const manifestEntities = (manifest?.database || []).map((d: any) => d.name);
  for (const ent of intentEntities) {
    if (!manifestEntities.includes(ent)) {
      issues.push({ level: 'error', message: `Intent requires entity '${ent}' but manifest is missing it.` });
    }
  }

  // 2) Role preservation (basic)
  const primaryRoles = (intentIR?.primaryRoles || []).map((r: any) => r.name);
  if (primaryRoles.length > 0) {
    const rolesFound = new Set<string>();
    for (const api of (manifest?.api || [])) {
      (api.rolesAllowed || []).forEach((r: string) => rolesFound.add(r));
    }
    for (const pr of primaryRoles) {
      if (!rolesFound.has(pr)) {
        issues.push({ level: 'warning', message: `Primary role '${pr}' not present in generated API role lists.` });
      }
    }
  }

  // 3) Hallucination risk
  if ((intentIR?.hallucinationRisk || 'Low') === 'High') {
    issues.push({ level: 'warning', message: 'High hallucination risk in intent; validate outputs carefully.' });
  }

  // 4) API touch verification
  const entitySet = new Set(manifestEntities);
  for (const api of (manifest?.api || [])) {
    for (const touched of (api.touchesEntities || [])) {
      if (!entitySet.has(touched)) {
        issues.push({ level: 'error', message: `API '${api.path}' touches unknown entity '${touched}'.` });
      }
    }
  }

  const passed = !issues.some(i => i.level === 'error');
  const score = 1 - (issues.length * 0.1);
  return { passed, score: Math.max(0, score), issues };
}
