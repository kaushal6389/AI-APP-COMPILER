import { DOMAIN_ONTOLOGY, DomainKey } from '../domain/ontology';

export function runSemanticChecks(intentIR: any, designIR: any, manifest: any) {
  const issues: Array<{ level: 'info' | 'warning' | 'error'; message: string }> = [];

  // PHASE 6: Strict Architecture Validation (RELAXED)
  const domainKey = intentIR?.domain as DomainKey;
  if (!domainKey) {
    throw new Error('SemanticArchitectureMismatchError: Missing domain in intent.');
  }

  console.log(`[SEMANTIC][DEBUG] Selected domain: ${domainKey}`);
  console.log(`[SEMANTIC][DEBUG] Ontology match score (if available): ${intentIR?.debug?.ontologyScore ?? 'n/a'}`);

  // Use the normalized confidence from intent stage when available
  const selectedDomainConfidence = intentIR?.debug?.selectedDomain?.confidence ?? intentIR?.confidence ?? 0;
  console.log(`[SEMANTIC][DEBUG] Selected domain confidence: ${selectedDomainConfidence}`);

  // If the orchestrator selected a non-generic domain but confidence is very low, block progression
  if (domainKey !== 'GenericTask' && selectedDomainConfidence < 0.3) {
    issues.push({ level: 'error', message: `LowDomainConfidenceError: Selected domain '${domainKey}' has low confidence (${selectedDomainConfidence}). Aborting unless clarified.` });
    return { passed: false, score: 0, issues };
  }

  // Treat GenericTask as an error only when hallucination risk is High.
  if (domainKey === 'GenericTask') {
    if ((intentIR?.hallucinationRisk || 'Low') === 'High') {
      throw new Error('SemanticArchitectureMismatchError: Domain is GenericTask with high hallucination risk. Refusing to proceed.');
    } else {
      // Demote to warning to allow simple apps like notes to proceed
      issues.push({ level: 'warning', message: 'Domain inferred as GenericTask — proceeding but consider providing more domain details.' });
    }
  }

  const profile = DOMAIN_ONTOLOGY[domainKey];
  if (profile) {
    const modules: string[] = (designIR?.modules || []).map((m: any) => m.name.toLowerCase());
    
    if (profile.expectedAIModules && profile.expectedAIModules.length > 0) {
      for (const expected of profile.expectedAIModules) {
        if (!modules.some(m => m.includes(expected.toLowerCase()))) {
          issues.push({ level: 'error', message: `SemanticArchitectureMismatchError: Missing required AI module '${expected}' for domain ${domainKey}.` });
        }
      }
    }

    if (profile.infrastructurePatterns && profile.infrastructurePatterns.length > 0) {
      for (const expected of profile.infrastructurePatterns) {
        if (!modules.some(m => m.includes(expected.toLowerCase()))) {
          issues.push({ level: 'error', message: `SemanticArchitectureMismatchError: Missing required infrastructure pattern '${expected}' for domain ${domainKey}.` });
        }
      }
    }
  }

  // 1) Intent entity coverage
  const intentEntities = (intentIR?.requiredEntities || []).map((e: any) => e.name);
  const manifestEntities = (manifest?.database || []).map((d: any) => d.name);
  for (const ent of intentEntities) {
    if (!manifestEntities.includes(ent)) {
      issues.push({ level: 'error', message: `Intent requires entity '${ent}' but manifest is missing it.` });
    }
  }

  // Additional rule: If intent fell back to Generic entities (User/Task)
  // but domain profile suggests advanced entities or AI modules, treat as error
  try {
    const profile = DOMAIN_ONTOLOGY[domainKey];
    const isGenericEntityOnly = intentEntities.length > 0 && intentEntities.every((n: string) => ['User', 'Task'].includes(n));
    const domainHasAdvanced = !!(profile && (profile.expectedAIModules?.length || profile.infrastructurePatterns?.length || profile.expectedWorkflows?.length));
    if (isGenericEntityOnly && domainHasAdvanced) {
      issues.push({ level: 'error', message: `SemanticArchitectureMismatchError: Intent entities collapsed to generic [${intentEntities.join(', ')}] while domain ${domainKey} expects advanced entities.` });
    }
  } catch (e) {
    // ignore
  }

  // 2) Role preservation (now blocking)
  const primaryRoles = (intentIR?.primaryRoles || []).map((r: any) => r.name);
  if (primaryRoles.length > 0) {
    const rolesFound = new Set<string>();
    for (const api of (manifest?.api || [])) {
      (api.rolesAllowed || []).forEach((r: string) => rolesFound.add(r));
    }
    for (const pr of primaryRoles) {
      if (!rolesFound.has(pr)) {
        // ROLE_MISMATCH is considered an error now, not a warning
        issues.push({ level: 'error', message: `RoleConsistencyError: Primary role '${pr}' not present in generated API role lists.` });
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
  console.log(`[SEMANTIC][DEBUG] issues=${JSON.stringify(issues, null, 2)}`);
  return { passed, score: Math.max(0, score), issues };
}
