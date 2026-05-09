/**
 * PHASE 1: Feature Classifier
 * 
 * Extracts semantic features from prompt text to understand implicit requirements.
 * Features are categories of functionality that suggest certain architectural needs.
 * 
 * Examples:
 * - "ranking" + "AI" → hasAI = true
 * - "real-time" + "notification" → hasCollaboration = true
 * - "HIPAA" + "patient data" → requires healthcare entities
 */

export interface FeatureSet {
  hasAuth: boolean;
  hasCollaboration: boolean;
  hasAI: boolean;
  hasDocumentProcessing: boolean;
  hasReporting: boolean;
  isMultiTenant: boolean;
  hasBilling: boolean;
  hasSearch: boolean;
  hasFullText: boolean;
  hasWebSocket: boolean;
  hasNotifications: boolean;
}

// Feature keyword mappings
const FEATURE_KEYWORDS: Record<keyof FeatureSet, string[]> = {
  hasAuth: [
    'auth', 'login', 'oauth', 'saml', 'sso', 'password', 'session', 'token',
    'authenticate', 'authorization', 'identity', 'credential', 'jwt'
  ],
  hasCollaboration: [
    'real-time', 'websocket', 'notification', 'messaging', 'chat', 'collaboration',
    'live', 'collaborative', 'shared', 'sync', 'broadcast'
  ],
  hasAI: [
    'ranking', 'scoring', 'machine learning', 'ml', 'ai', 'artificial intelligence',
    'prediction', 'recommendation', 'algorithm', 'neural', 'model', 'inference',
    'llm', 'language model', 'deep learning'
  ],
  hasDocumentProcessing: [
    'parsing', 'ocr', 'document', 'pdf', 'extraction', 'file upload', 'upload',
    'scan', 'text extraction', 'parser', 'process document'
  ],
  hasReporting: [
    'analytics', 'dashboard', 'report', 'chart', 'metrics', 'visualization', 'graph',
    'statistic', 'insight', 'analytics engine', 'business intelligence'
  ],
  isMultiTenant: [
    'multi-tenant', 'organization', 'workspace', 'team', 'group', 'account',
    'tenant', 'org', 'multi tenant', 'saas', 'cloud', 'shared platform'
  ],
  hasBilling: [
    'billing', 'payment', 'subscription', 'stripe', 'invoice', 'pricing', 'charge',
    'pay', 'purchase', 'checkout', 'payment processing', 'monetization'
  ],
  hasSearch: [
    'search', 'filter', 'query', 'full-text', 'fuzzy', 'find', 'lookup', 'index',
    'elasticsearch', 'search engine', 'full text'
  ],
  hasFullText: [
    'full-text', 'full text', 'text search', 'search index'
  ],
  hasWebSocket: [
    'websocket', 'real-time', 'live update', 'push', 'socket', 'ws'
  ],
  hasNotifications: [
    'notification', 'notify', 'alert', 'push notification', 'email notification',
    'messaging', 'message', 'broadcast', 'event stream'
  ]
};

/**
 * Extract features from a prompt text
 * @param prompt The user's natural language requirement
 * @returns FeatureSet with boolean flags for each detected feature
 */
export const extractFeatures = (prompt: string): FeatureSet => {
  const lowered = prompt.toLowerCase();
  
  const features: FeatureSet = {
    hasAuth: false,
    hasCollaboration: false,
    hasAI: false,
    hasDocumentProcessing: false,
    hasReporting: false,
    isMultiTenant: false,
    hasBilling: false,
    hasSearch: false,
    hasFullText: false,
    hasWebSocket: false,
    hasNotifications: false
  };
  
  // Check each feature type
  for (const [featureKey, keywords] of Object.entries(FEATURE_KEYWORDS)) {
    for (const keyword of keywords) {
      if (lowered.includes(keyword)) {
        (features as any)[featureKey] = true;
        break;
      }
    }
  }
  
  return features;
};

/**
 * Get a summary of detected features
 * @param features The feature set
 * @returns Array of detected feature names
 */
export const getDetectedFeatures = (features: FeatureSet): string[] => {
  const detected: string[] = [];
  
  if (features.hasAuth) detected.push('Authentication');
  if (features.hasCollaboration) detected.push('Collaboration');
  if (features.hasAI) detected.push('AI/ML');
  if (features.hasDocumentProcessing) detected.push('Document Processing');
  if (features.hasReporting) detected.push('Reporting');
  if (features.isMultiTenant) detected.push('Multi-Tenancy');
  if (features.hasBilling) detected.push('Billing');
  if (features.hasSearch) detected.push('Search');
  if (features.hasFullText) detected.push('Full-Text Search');
  if (features.hasWebSocket) detected.push('WebSocket');
  if (features.hasNotifications) detected.push('Notifications');
  
  return detected;
};

/**
 * Check if feature set has any features
 * @param features The feature set
 * @returns true if any feature is detected
 */
export const hasAnyFeatures = (features: FeatureSet): boolean => {
  return Object.values(features).some(v => v === true);
};

/**
 * Get feature confidence score (0-1)
 * Higher score = more features detected = more confident domain matching
 * @param features The feature set
 * @returns Confidence score
 */
export const getFeatureConfidence = (features: FeatureSet): number => {
  const detectedCount = Object.values(features).filter(v => v === true).length;
  const totalFeatures = Object.keys(features).length;
  return detectedCount / totalFeatures;
};
