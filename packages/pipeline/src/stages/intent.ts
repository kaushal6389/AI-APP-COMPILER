import { IntentIR } from '@ai-compiler/schemas';
import { inferDomain, extractRoles } from '../domain/inferenceEngine';
import { DOMAIN_ONTOLOGY } from '../domain/ontology';

/**
 * Stage 1: Intent Extraction with Semantic Domain Understanding
 * 
 * PHASE 1 UPGRADE: Now uses semantic domain engine instead of keyword-only matching.
 * - Feature classification
 * - Multi-scoring (keywords + features)
 * - Intelligent fallback with warnings
 * - Entity inference
 */
export class IntentExtractionStage {
  public async execute(prompt: string): Promise<IntentIR> {
    console.log('Analyzing prompt semantics with semantic domain engine...');

    // PHASE 1: Use new semantic domain inference
    const inferenceResult = inferDomain(prompt);
    const selectedDomainMatch = inferenceResult.selectedDomain;
    const domain = selectedDomainMatch.domain;
    const profile = DOMAIN_ONTOLOGY[domain];

    // Extract explicitly defined roles, fallback to domain defaults
    const rawRoles = extractRoles(prompt, profile.defaultRoles);
    const primaryRoles = rawRoles;

    // Detect integrations from prompt
    const lowered = prompt.toLowerCase();
    const impliedIntegrations = Object.entries(profile.integrationKeywords || {})
      .filter(([keyword]) => lowered.includes(keyword))
      .map(([provider, purpose]) => ({ provider, purpose }));

    // Build required entities from domain profile
    const requiredEntities = [...profile.requiredEntities];
    
    // Match optional entities from domain profile
    const optionalMatches = profile.optionalEntities.filter((entity) =>
      lowered.includes(entity.name.toLowerCase()) ||
      entity.suggestedFields.some((field) => lowered.includes(field.toLowerCase()))
    );

    // Merge required + matched optional entities
    const mergedEntities = [...requiredEntities, ...optionalMatches];

    // Log inference details for transparency
    if (inferenceResult.warnings.length > 0) {
      for (const warning of inferenceResult.warnings) {
        console.warn(`[INTENT] ${warning}`);
      }
    }

    console.log(`[INTENT] Domain: ${domain} (confidence: ${Math.round(selectedDomainMatch.confidence * 100)}%)`);
    console.log(`[INTENT] Matched keywords: ${selectedDomainMatch.matchedKeywords.join(', ') || 'none'}`);
    console.log(`[INTENT] Detected features: ${selectedDomainMatch.matchedFeatures.join(', ') || 'none'}`);
    console.log(`[INTENT] Entities: ${mergedEntities.map(e => e.name).join(', ')}`);

    return {
      domain,
      summary: `Semantic domain inference (${domain}) - Confidence: ${Math.round(selectedDomainMatch.confidence * 100)}%`,
      primaryRoles,
      requiredEntities: mergedEntities,
      impliedIntegrations,
      businessRules: [
        'Roles strictly preserved',
        'Domain models semantically matched',
        `Inferred from ${selectedDomainMatch.matchedKeywords.length} domain keywords and ${selectedDomainMatch.matchedFeatures.length} features`
      ],
      hallucinationRisk: 
        inferenceResult.hallucinationRisk === 'High' ? 'High' :
        inferenceResult.hallucinationRisk === 'Medium' ? 'Medium' :
        mergedEntities.length >= profile.requiredEntities.length ? 'Low' : 'Medium'
    };
  }
}
