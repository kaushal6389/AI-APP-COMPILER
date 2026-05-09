/**
 * PHASE 1: Semantic Domain Inference Engine
 * 
 * Combines feature classification with domain matching and entity inference.
 * Intelligently selects best-fit domain with confidence scoring.
 * Infers additional required entities based on detected features.
 */

import { extractFeatures, FeatureSet, getDetectedFeatures, hasAnyFeatures } from './features';
import {
  DOMAIN_ONTOLOGY,
  DomainKey,
  DomainProfile,
  getActiveDomainKeys,
  getAllDomainKeys
} from './ontology';

export interface DomainMatch {
  domain: DomainKey;
  confidence: number; // 0-1, only accept if > 0.3
  matchedKeywords: string[];
  matchedFeatures: string[];
  impliedEntities: string[];
  reason: string;
  isExact: boolean; // true if keyword match, false if feature-based fallback
}

export interface DomainInferenceResult {
  selectedDomain: DomainMatch;
  alternativeDomains: DomainMatch[];
  features: FeatureSet;
  hallucinationRisk: 'Low' | 'Medium' | 'High';
  warnings: string[];
}

/**
 * Score domains by keyword matching
 * @param prompt User's natural language requirement
 * @returns Map of domain -> keyword match score
 */
const scoreByKeywords = (prompt: string): Map<DomainKey, number> => {
  const lowered = prompt.toLowerCase();
  const scores = new Map<DomainKey, number>();
  
  for (const domain of getActiveDomainKeys()) {
    const profile = DOMAIN_ONTOLOGY[domain];
    
    // Count keyword matches
    let matchCount = 0;
    let totalKeywords = 0;
    const matchedKeywords: string[] = [];
    
    // Main keywords
    for (const keyword of profile.keywords) {
      totalKeywords++;
      if (lowered.includes(keyword)) { matchCount++; matchedKeywords.push(keyword); }
    }
    
    // Alternate names
    if (profile.alternateNames) {
      for (const altName of profile.alternateNames) {
        totalKeywords++;
        if (lowered.includes(altName.toLowerCase())) matchCount++;
      }
    }
    
    // Score is weighted: (matches / total keywords) * 100
    const score = totalKeywords > 0 ? (matchCount / totalKeywords) * 100 : 0;
    scores.set(domain, score);
    // attach matched keywords for debug inspection
    (scores as any).__matches = (scores as any).__matches || {};
    (scores as any).__matches[domain] = matchedKeywords;
  }
  
  return scores;
};

/**
 * Score domains by feature matching
 * @param features Detected feature set
 * @returns Map of domain -> feature match score
 */
const scoreByFeatures = (features: FeatureSet, prompt: string): Map<DomainKey, number> => {
  const lowered = prompt.toLowerCase();
  const scores = new Map<DomainKey, number>();
  
  for (const domain of getActiveDomainKeys()) {
    const profile = DOMAIN_ONTOLOGY[domain];
    
    // Build feature expectations for this domain
    let expectedFeatures = 0;
    let matchedFeatures = 0;
    
    // Healthcare domain needs auth and reporting
    if (domain === 'Healthcare' || domain === 'FinTech') {
      expectedFeatures += 2;
      if (features.hasAuth) matchedFeatures++;
      if (features.hasReporting) matchedFeatures++;
    }
    
    // AI Hiring needs AI, document processing
    if (domain === 'AIHiringPlatform') {
      expectedFeatures += 2;
      if (features.hasAI) matchedFeatures++;
      if (features.hasDocumentProcessing) matchedFeatures++;
    }
    
    // Legal AI needs document processing, AI
    if (domain === 'LegalAIPlatform') {
      expectedFeatures += 2;
      if (features.hasDocumentProcessing) matchedFeatures++;
      if (features.hasAI) matchedFeatures++;
    }
    
    // Multi-tenant platforms benefit from multi-tenancy feature
    if (['SaaS', 'Marketplace', 'EdTech'].includes(domain)) {
      expectedFeatures += 1;
      if (features.isMultiTenant) matchedFeatures++;
    }
    
    // E-commerce needs billing, search
    if (domain === 'E-commerce') {
      expectedFeatures += 2;
      if (features.hasBilling) matchedFeatures++;
      if (features.hasSearch) matchedFeatures++;
    }
    
    // Social/collaboration needs notifications, websocket
    if (['SocialNetwork'].includes(domain)) {
      expectedFeatures += 2;
      if (features.hasNotifications) matchedFeatures++;
      if (features.hasCollaboration) matchedFeatures++;
    }
    
    // Abstract systems
    if (domain === 'DevOpsPlatform') {
      expectedFeatures += 3;
      if (features.hasInfrastructure) matchedFeatures++;
      if (features.hasExecutionDAG) matchedFeatures++;
      if (features.hasQueue) matchedFeatures++;
    }
    
    if (domain === 'CompilerPlatform') {
      expectedFeatures += 2;
      if (features.hasCompiler) matchedFeatures++;
      if (features.hasExecutionDAG) matchedFeatures++;
    }
    
    if (domain === 'ObservabilitySystem') {
      expectedFeatures += 2;
      if (features.hasTelemetry) matchedFeatures++;
      if (features.hasReporting) matchedFeatures++;
    }

    if (domain === 'TradingSystem') {
      expectedFeatures += 2;
      if (features.hasTrading) matchedFeatures++;
      if (features.hasAuth) matchedFeatures++;
    }

    if (domain === 'WorkflowAutomation') {
      expectedFeatures += 2;
      if (features.hasAutomation) matchedFeatures++;
      if (features.hasQueue) matchedFeatures++;
    }
    
    // Content platform benefits from search, reporting
    if (domain === 'ContentPlatform') {

      expectedFeatures += 2;
      if (features.hasSearch) matchedFeatures++;
      if (features.hasReporting) matchedFeatures++;
    }
    
    const score = expectedFeatures > 0 ? (matchedFeatures / expectedFeatures) * 100 : 0;
    scores.set(domain, score);
  }
  
  return scores;
};

/**
 * Combine keyword and feature scores with weighted averaging
 * @param keywordScores Keyword match scores
 * @param featureScores Feature match scores
 * @param keywordWeight Weight for keywords (0-1)
 * @param featureWeight Weight for features (0-1)
 * @returns Combined scores
 */
const combineScores = (
  keywordScores: Map<DomainKey, number>,
  featureScores: Map<DomainKey, number>,
  keywordWeight: number = 0.5,
  featureWeight: number = 0.5
): Map<DomainKey, number> => {
  const combined = new Map<DomainKey, number>();
  
  for (const domain of getActiveDomainKeys()) {
    const kScore = keywordScores.get(domain) || 0;
    const fScore = featureScores.get(domain) || 0;
    const combined_score = (kScore * keywordWeight) + (fScore * featureWeight);
    combined.set(domain, combined_score);
  }
  
  return combined;
};

/**
 * Infer entities that should be added based on features
 * @param features Detected feature set
 * @returns Array of additional entity names to consider
 */
const inferImpliedEntities = (features: FeatureSet): string[] => {
  const implied = new Set<string>();
  
  if (features.hasAuth) {
    implied.add('User');
    implied.add('Role');
  }
  if (features.hasCollaboration || features.hasNotifications) {
    implied.add('Notification');
    implied.add('Message');
    implied.add('Activity');
  }
  if (features.hasAI) {
    implied.add('MLScore');
    implied.add('Ranking');
    implied.add('ScoreCard');
  }
  if (features.hasDocumentProcessing) {
    implied.add('Document');
    implied.add('DocumentParser');
    implied.add('ParseResult');
  }
  if (features.hasReporting) {
    implied.add('Report');
    implied.add('Dashboard');
    implied.add('ChartData');
  }
  if (features.isMultiTenant) {
    implied.add('Organization');
    implied.add('Workspace');
    implied.add('Team');
  }
  if (features.hasBilling) {
    implied.add('Payment');
    implied.add('Invoice');
    implied.add('Subscription');
  }
  if (features.hasSearch || features.hasFullText) {
    implied.add('SearchIndex');
    implied.add('Filter');
  }
  
  return Array.from(implied);
};

/**
 * Main semantic domain inference function
 * @param prompt User's natural language requirement
 * @returns Domain inference result with selected domain and alternatives
 */
export const inferDomain = (prompt: string): DomainInferenceResult => {
  console.log('[INFER][DEBUG] prompt:', prompt);
  // Step 1: Extract features
  const features = extractFeatures(prompt);
  const detectedFeatures = getDetectedFeatures(features);
  
  // Step 2: Score domains by keywords
  const keywordScores = scoreByKeywords(prompt);
  
  // Step 3: Score domains by features
  const featureScores = scoreByFeatures(features, prompt);
  
  // Step 4: Combine scores (60% keywords, 40% features for early matching)
  const combinedScores = combineScores(keywordScores, featureScores, 0.6, 0.4);
  
  // Step 5: Sort and get matches
  const sortedDomains = Array.from(combinedScores.entries())
    .map(([domain, score]) => ({ domain, score }))
    .sort((a, b) => b.score - a.score);

  // DEBUG: emit score tables for inspection
  try {
    const kvKeywords = Array.from(keywordScores.entries()).map(([d,s])=>`${d}:${s.toFixed(1)}`).join(', ');
    const kvFeatures = Array.from(featureScores.entries()).map(([d,s])=>`${d}:${s.toFixed(1)}`).join(', ');
    const kvCombined = Array.from(combinedScores.entries()).map(([d,s])=>`${d}:${s.toFixed(1)}`).join(', ');
    console.log(`[INFER][DEBUG] keywordScores=${kvKeywords}`);
    console.log(`[INFER][DEBUG] featureScores=${kvFeatures}`);
    console.log(`[INFER][DEBUG] combinedScores=${kvCombined}`);
  } catch (e) {}
  
  // Step 6: Build domain matches with details
  const buildMatch = (domain: DomainKey, score: number, isExact: boolean): DomainMatch => {
    const profile = DOMAIN_ONTOLOGY[domain];
    const lowered = prompt.toLowerCase();
    
    // Find which keywords matched
    const matchedKeywords = profile.keywords.filter(k => lowered.includes(k));
    if (profile.alternateNames) {
      matchedKeywords.push(...profile.alternateNames.filter(a => lowered.includes(a.toLowerCase())));
    }
    
    // Infer additional entities
    const impliedEntities = inferImpliedEntities(features);
    
    return {
      domain,
      confidence: Math.min(1, score / 100), // Normalize to 0-1
      matchedKeywords,
      matchedFeatures: detectedFeatures,
      impliedEntities,
      reason: `Domain selected via ${isExact ? 'exact keyword' : 'feature'} matching`,
      isExact
    };
  };
  
  // Step 7: Select primary domain
  const topMatch = sortedDomains[0];
  const selectedDomain = buildMatch(
    topMatch.domain,
    topMatch.score,
    topMatch.score > 0 // isExact if we found keywords
  );
  
  // Step 8: Get alternatives (top 3 after selected)
  const alternatives = sortedDomains
    .slice(1, 4)
    .map(d => buildMatch(d.domain, d.score, d.score > 0));
  
  // Step 9: Determine hallucination risk and warnings
  const warnings: string[] = [];
  let hallucinationRisk: 'Low' | 'Medium' | 'High' = 'Low';
  
  // Risk assessment
  if (selectedDomain.confidence < 0.3) {
    hallucinationRisk = 'High';
    warnings.push(`⚠️ Low confidence domain match (${Math.round(selectedDomain.confidence * 100)}%). System may misunderstand requirements.`);
  } else if (selectedDomain.confidence < 0.5) {
    hallucinationRisk = 'Medium';
    warnings.push(`Moderate confidence domain match (${Math.round(selectedDomain.confidence * 100)}%). Verify domain is correct.`);
  }
  
  // Additional warnings
  if (!hasAnyFeatures(features) && selectedDomain.domain === 'GenericTask') {
    warnings.push(`⚠️ CRITICAL: No domain keywords or features detected. Defaulting to generic User + Task. Prompt may be too vague.`);
    hallucinationRisk = 'High';
  }
  
  if (selectedDomain.matchedFeatures.length === 0 && selectedDomain.matchedKeywords.length === 0) {
    warnings.push(`No domain-specific keywords or features detected. Using fallback domain.`);
  }
  
  return {
    selectedDomain,
    alternativeDomains: alternatives,
    features,
    hallucinationRisk,
    warnings
  };
};

/**
 * Extract roles from prompt if explicitly defined
 * @param prompt User's natural language requirement
 * @param fallbackRoles Fallback roles from domain profile
 * @returns Array of role names
 */
export const extractRoles = (prompt: string, fallbackRoles: any[]): any[] => {
  // Look for explicit role definition patterns
  const rolePattern = /roles?\s*[:=]\s*([a-z0-9,\s\-_]+)/i;
  const match = rolePattern.exec(prompt);
  
  if (!match) return fallbackRoles;
  
  const raw = match[1]
    .split(/[,;\s]+/)
    .map((item) => item.trim())
    .filter(Boolean);
  
  if (raw.length === 0) return fallbackRoles;
  
  return raw.map((role) => ({
    name: role.charAt(0).toUpperCase() + role.slice(1), // Capitalize
    description: `Prompt-defined role ${role}`,
    isSystem: role.toLowerCase() === 'admin'
  }));
};
