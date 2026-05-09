export interface IntentIR {
  domain: string;
  summary: string;
  primaryRoles: Array<{ name: string; description?: string; isSystem?: boolean }>;
  requiredEntities: Array<{ name: string; corePurpose?: string; isDomainCritical?: boolean; suggestedFields?: string[] }>;
  impliedIntegrations?: Array<{ provider: string; purpose: string }>;
  businessRules?: string[];
  hallucinationRisk?: 'Low' | 'Medium' | 'High';
}

export interface DesignIR {
  architecture: string;
  modules: Array<{ name: string; responsibility?: string; dependencies?: string[] }>;
  entityRelationships?: Array<{ from: string; to: string; relationType: string }>;
  userFlows?: Array<{ role: string; entryPoint: string; paths: string[] }>;
  serviceBoundaries?: Record<string, string[]>;
}

export interface SchemaIR {
  database: any[]; // refined later
  api: any[];
}

export interface ValidatedManifest extends SchemaIR {
}
