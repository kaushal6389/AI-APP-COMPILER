/**
 * PHASE 3: Contradiction Detection Engine
 *
 * Detects and rejects impossible or internally inconsistent architectures
 * before they propagate through the pipeline.
 *
 * Classifies issues as: INFO, WARNING, ERROR, or FATAL
 * FATAL contradictions block compilation entirely.
 */

import { IntentIR } from '@ai-compiler/schemas';
import type { AppManifest } from '@ai-compiler/schemas';

export type ValidationLevel = 'INFO' | 'WARNING' | 'ERROR' | 'FATAL';

export interface ValidationIssue {
  level: ValidationLevel;
  code: string;
  message: string;
  affectedPolicies: string[];
  suggestedResolution: string;
  context?: Record<string, any>;
}

export interface ConflictDetectionResult {
  passed: boolean;
  findings: ValidationIssue[];
  fatalities: ValidationIssue[];
  summary: {
    infoCount: number;
    warningCount: number;
    errorCount: number;
    fatalCount: number;
  };
}

/**
 * Policy Constraint Model
 * Maps policies to their conflicts and requirements
 */
interface PolicyConstraint {
  name: string;
  type: 'Feature' | 'Security' | 'Compliance' | 'Architecture' | 'Data';
  required: boolean;
  conflicts: string[]; // Policy names that conflict with this one
  explanation: string;
}

const POLICY_CONSTRAINTS: Record<string, PolicyConstraint> = {
  // Security Policies
  hasAuth: {
    name: 'Authentication Required',
    type: 'Security',
    required: false,
    conflicts: ['noAuth', 'anonymousAllowed'],
    explanation: 'System requires user authentication'
  },

  noAuth: {
    name: 'No Authentication',
    type: 'Security',
    required: false,
    conflicts: ['hasAuth', 'hipaaCompliance', 'gdprCompliance', 'pciDssCompliance', 'mandatoryLogin'],
    explanation: 'System explicitly has no authentication'
  },

  anonymousAllowed: {
    name: 'Anonymous Access',
    type: 'Security',
    required: false,
    conflicts: ['mandatoryLogin', 'hipaaCompliance', 'gdprCompliance'],
    explanation: 'System allows anonymous (unauthenticated) access'
  },

  mandatoryLogin: {
    name: 'Mandatory Login',
    type: 'Security',
    required: false,
    conflicts: ['anonymousAllowed', 'noAuth'],
    explanation: 'All users must authenticate before accessing system'
  },

  // Role-Based Access Policies
  hasRoles: {
    name: 'Role-Based Access Control',
    type: 'Security',
    required: false,
    conflicts: ['noRoles'],
    explanation: 'System uses role-based access control'
  },

  noRoles: {
    name: 'No Roles',
    type: 'Security',
    required: false,
    conflicts: ['hasRoles', 'rbacEnforced'],
    explanation: 'System explicitly has no roles'
  },

  rbacEnforced: {
    name: 'Strict RBAC',
    type: 'Security',
    required: false,
    conflicts: ['noRoles', 'openApi'],
    explanation: 'Role-based access is strictly enforced on all endpoints'
  },

  // Data Persistence Policies
  hasDatabase: {
    name: 'Persistent Database',
    type: 'Architecture',
    required: false,
    conflicts: ['noDatabase', 'stateless'],
    explanation: 'System requires persistent data storage'
  },

  noDatabase: {
    name: 'No Database',
    type: 'Architecture',
    required: false,
    conflicts: ['hasDatabase', 'hasBilling', 'multiTenant', 'hasCollaboration'],
    explanation: 'System explicitly has no database'
  },

  stateless: {
    name: 'Stateless',
    type: 'Architecture',
    required: false,
    conflicts: ['hasDatabase', 'multiTenant'],
    explanation: 'System maintains no persistent state'
  },

  // Billing Policies
  hasBilling: {
    name: 'Billing/Payments',
    type: 'Feature',
    required: false,
    conflicts: ['noPayments'],
    explanation: 'System includes billing and payments'
  },

  noPayments: {
    name: 'No Payments',
    type: 'Feature',
    required: false,
    conflicts: ['hasBilling', 'pciDssCompliance'],
    explanation: 'System explicitly has no payment processing'
  },

  // Multi-tenancy Policies
  multiTenant: {
    name: 'Multi-tenant',
    type: 'Architecture',
    required: false,
    conflicts: ['singleTenant', 'noDatabase'],
    explanation: 'System supports multiple isolated tenants'
  },

  singleTenant: {
    name: 'Single Tenant',
    type: 'Architecture',
    required: false,
    conflicts: ['multiTenant'],
    explanation: 'System is single-tenant only'
  },

  // Compliance Policies
  hipaaCompliance: {
    name: 'HIPAA Compliance',
    type: 'Compliance',
    required: false,
    conflicts: ['noAuth', 'anonymousAllowed', 'noDatabase', 'noEncryption'],
    explanation: 'System must be HIPAA compliant (healthcare data)'
  },

  gdprCompliance: {
    name: 'GDPR Compliance',
    type: 'Compliance',
    required: false,
    conflicts: ['noAuth', 'noDatabase', 'noDataDeletion'],
    explanation: 'System must be GDPR compliant (EU user data)'
  },

  pciDssCompliance: {
    name: 'PCI-DSS Compliance',
    type: 'Compliance',
    required: false,
    conflicts: ['noAuth', 'noPayments', 'noEncryption'],
    explanation: 'System must be PCI-DSS compliant (payment card data)'
  },

  // Data Protection
  noEncryption: {
    name: 'No Encryption',
    type: 'Data',
    required: false,
    conflicts: ['hipaaCompliance', 'gdprCompliance', 'pciDssCompliance'],
    explanation: 'System explicitly has no encryption'
  },

  noDataDeletion: {
    name: 'No Data Deletion',
    type: 'Data',
    required: false,
    conflicts: ['gdprCompliance'],
    explanation: 'System cannot delete user data'
  },

  // Integration Policies
  hasCollaboration: {
    name: 'Real-time Collaboration',
    type: 'Feature',
    required: false,
    conflicts: ['noDatabase', 'stateless'],
    explanation: 'System requires real-time collaboration features'
  },

  openApi: {
    name: 'Open/Public API',
    type: 'Feature',
    required: false,
    conflicts: ['rbacEnforced', 'hipaaCompliance'],
    explanation: 'System exposes public APIs without authentication'
  },
};

/**
 * Compliance Rule Engine
 * Maps compliance frameworks to their requirements
 */
interface ComplianceRule {
  name: string;
  framework: 'HIPAA' | 'GDPR' | 'SOC2' | 'PCI-DSS';
  requires: string[]; // Required policies
  forbids: string[]; // Forbidden policies
  severity: 'WARNING' | 'ERROR' | 'FATAL';
  explanation: string;
}

const COMPLIANCE_RULES: ComplianceRule[] = [
  {
    name: 'HIPAA Requires Authentication',
    framework: 'HIPAA',
    requires: ['hasAuth'],
    forbids: ['noAuth', 'anonymousAllowed'],
    severity: 'FATAL',
    explanation: 'HIPAA requires authentication and audit trails for PHI access'
  },
  {
    name: 'HIPAA Requires Encryption',
    framework: 'HIPAA',
    requires: [],
    forbids: ['noEncryption'],
    severity: 'FATAL',
    explanation: 'HIPAA requires encryption of PHI at rest and in transit'
  },
  {
    name: 'HIPAA Requires Database',
    framework: 'HIPAA',
    requires: ['hasDatabase'],
    forbids: ['noDatabase'],
    severity: 'FATAL',
    explanation: 'HIPAA-compliant systems must have persistent audit logs'
  },
  {
    name: 'GDPR Requires Data Deletion',
    framework: 'GDPR',
    requires: [],
    forbids: ['noDataDeletion'],
    severity: 'FATAL',
    explanation: 'GDPR requires users have right to be forgotten (data deletion)'
  },
  {
    name: 'GDPR Requires Authentication',
    framework: 'GDPR',
    requires: ['hasAuth'],
    forbids: ['noAuth', 'anonymousAllowed'],
    severity: 'FATAL',
    explanation: 'GDPR requires authentication for user data access'
  },
  {
    name: 'PCI-DSS Requires Authentication',
    framework: 'PCI-DSS',
    requires: ['hasAuth'],
    forbids: ['noAuth'],
    severity: 'FATAL',
    explanation: 'PCI-DSS requires authentication for payment processing'
  },
  {
    name: 'PCI-DSS Requires Encryption',
    framework: 'PCI-DSS',
    requires: [],
    forbids: ['noEncryption'],
    severity: 'FATAL',
    explanation: 'PCI-DSS requires encryption of cardholder data'
  },
  {
    name: 'PCI-DSS Forbids Open APIs',
    framework: 'PCI-DSS',
    requires: [],
    forbids: ['openApi'],
    severity: 'FATAL',
    explanation: 'PCI-DSS forbids unauthenticated payment APIs'
  },
];

/**
 * Detect direct contradictions between policies
 */
const detectDirectContradictions = (
  detectedPolicies: Set<string>
): ValidationIssue[] => {
  const findings: ValidationIssue[] = [];

  for (const policy of detectedPolicies) {
    const constraint = POLICY_CONSTRAINTS[policy];
    if (!constraint) continue;

    for (const conflicting of constraint.conflicts) {
      if (detectedPolicies.has(conflicting)) {
        findings.push({
          level: 'FATAL',
          code: `CONTRADICTION_${policy}_vs_${conflicting}`,
          message: `Policy "${constraint.name}" contradicts "${POLICY_CONSTRAINTS[conflicting]?.name || conflicting}"`,
          affectedPolicies: [policy, conflicting],
          suggestedResolution: `Remove one of: ${constraint.name} or ${POLICY_CONSTRAINTS[conflicting]?.name || conflicting}`
        });
      }
    }
  }

  return findings;
};

/**
 * Validate compliance framework requirements
 */
const validateComplianceRules = (
  detectedPolicies: Set<string>,
  prompt: string
): ValidationIssue[] => {
  const findings: ValidationIssue[] = [];
  const lowered = prompt.toLowerCase();

  // Detect which frameworks are required by the prompt
  const requiredFrameworks = new Set<string>();
  if (lowered.includes('hipaa')) requiredFrameworks.add('HIPAA');
  if (lowered.includes('gdpr')) requiredFrameworks.add('GDPR');
  if (lowered.includes('pci') || lowered.includes('pci-dss')) requiredFrameworks.add('PCI-DSS');
  if (lowered.includes('soc2') || lowered.includes('soc 2')) requiredFrameworks.add('SOC2');

  // Check each compliance rule
  for (const rule of COMPLIANCE_RULES) {
    if (!requiredFrameworks.has(rule.framework)) continue;

    // Check forbidden policies
    for (const forbidden of rule.forbids) {
      if (detectedPolicies.has(forbidden)) {
        findings.push({
          level: rule.severity,
          code: `COMPLIANCE_CONFLICT_${rule.framework}_${forbidden}`,
          message: `${rule.framework} compliance forbids "${POLICY_CONSTRAINTS[forbidden]?.name || forbidden}", but it is detected in the architecture`,
          affectedPolicies: [forbidden],
          suggestedResolution: rule.explanation
        });
      }
    }

    // Check required policies
    for (const required of rule.requires) {
      if (!detectedPolicies.has(required)) {
        findings.push({
          level: rule.severity,
          code: `COMPLIANCE_MISSING_${rule.framework}_${required}`,
          message: `${rule.framework} compliance requires "${POLICY_CONSTRAINTS[required]?.name || required}", but it is not detected in the architecture`,
          affectedPolicies: [required],
          suggestedResolution: rule.explanation
        });
      }
    }
  }

  return findings;
};

/**
 * Infer policies from intent and manifest
 */
const inferDetectedPolicies = (
  intent: IntentIR,
  manifest: AppManifest
): Set<string> => {
  const policies = new Set<string>();
  const summaryLower = (intent.summary || '').toLowerCase();
  const businessRulesLower = (intent.businessRules || []).map(r => r.toLowerCase());

  // From intent business rules
  for (const rule of businessRulesLower) {
    if (rule.includes('auth') || rule.includes('login') || rule.includes('authentication')) {
      // Distinguish between "no auth" and "require auth"
      if (rule.includes('no ') || rule.includes('without') || rule.includes('not required')) {
        policies.add('noAuth');
        policies.delete('hasAuth');
      } else {
        policies.add('hasAuth');
        policies.delete('noAuth');
      }
    }
    
    if (rule.includes('anonymous') || rule.includes('unauthenticated')) {
      policies.add('anonymousAllowed');
    }
    
    if ((rule.includes('mandatory') || rule.includes('required')) && rule.includes('login')) {
      policies.add('mandatoryLogin');
    }
    
    if (rule.includes('hipaa')) {
      policies.add('hipaaCompliance');
    }
    if (rule.includes('gdpr')) {
      policies.add('gdprCompliance');
    }
    if (rule.includes('pci')) {
      policies.add('pciDssCompliance');
    }
    if (rule.includes('soc2') || rule.includes('soc 2')) {
      policies.add('pciDssCompliance');
    }
    
    if ((rule.includes('role') || rule.includes('rbac')) && !rule.includes('no ')) {
      policies.add('hasRoles');
    }
    if (rule.includes('no ') && (rule.includes('role') || rule.includes('rbac'))) {
      policies.add('noRoles');
    }
    
    if ((rule.includes('multi') || rule.includes('tenant')) && !rule.includes('single')) {
      policies.add('multiTenant');
    }
    if (rule.includes('single') && rule.includes('tenant')) {
      policies.add('singleTenant');
    }
    
    if (rule.includes('encrypt')) {
      policies.add('hasEncryption');
    }
    if (rule.includes('no ') && rule.includes('encrypt')) {
      policies.add('noEncryption');
    }
    
    if ((rule.includes('payment') || rule.includes('billing')) && !rule.includes('no ')) {
      policies.add('hasBilling');
    }
    if (rule.includes('no ') && (rule.includes('payment') || rule.includes('billing'))) {
      policies.add('noPayments');
    }
    
    if ((rule.includes('database') || rule.includes('storage')) && !rule.includes('no ')) {
      policies.add('hasDatabase');
    }
    if (rule.includes('no ') && (rule.includes('database') || rule.includes('storage'))) {
      policies.add('noDatabase');
    }
    
    if ((rule.includes('collab') || rule.includes('real-time')) && !rule.includes('no ')) {
      policies.add('hasCollaboration');
    }
    
    if (rule.includes('strict') && rule.includes('rbac')) {
      policies.add('rbacEnforced');
    }
    
    if ((rule.includes('open') && rule.includes('api')) || rule.includes('public api')) {
      policies.add('openApi');
    }
    
    if ((rule.includes('no data deletion') || rule.includes('cannot delete') || rule.includes('delete not allowed')) && !rule.includes('can')) {
      policies.add('noDataDeletion');
    }
  }

  // From intent domain
  if (intent.domain === 'Healthcare') {
    policies.add('hipaaCompliance');
  }
  if (intent.domain === 'FinTech') {
    policies.add('pciDssCompliance');
  }

  // From manifest API configuration
  const apiRequiresAuth = manifest.api.some(api => api.authRequired);
  const apiHasRoles = manifest.api.some(api => api.rolesAllowed?.length > 0);
  const allApiRequireAuth = manifest.api.length > 0 && manifest.api.every(api => api.authRequired);

  if (apiRequiresAuth && !policies.has('noAuth')) {
    policies.add('hasAuth');
  }
  if (apiHasRoles) {
    policies.add('hasRoles');
  }
  if (allApiRequireAuth && manifest.api.length > 0) {
    policies.add('mandatoryLogin');
  }

  // From manifest database
  if (manifest.database?.length > 0) {
    policies.add('hasDatabase');
  }

  return policies;
};

/**
 * Architecture Feasibility Checks
 */
const validateArchitectureFeasibility = (
  intent: IntentIR,
  manifest: AppManifest,
  detectedPolicies: Set<string>
): ValidationIssue[] => {
  const findings: ValidationIssue[] = [];

  // Check 1: If RBAC is enforced, roles must exist
  if (detectedPolicies.has('rbacEnforced')) {
    if (!detectedPolicies.has('hasRoles')) {
      findings.push({
        level: 'ERROR',
        code: 'RBAC_NO_ROLES',
        message: 'RBAC is enforced but no roles are defined',
        affectedPolicies: ['rbacEnforced', 'hasRoles'],
        suggestedResolution: 'Define at least one role in business rules or add roles to the domain'
      });
    }
  }

  // Check 2: If there are entities, database is needed
  if (intent.requiredEntities?.length > 0 && !detectedPolicies.has('hasDatabase')) {
    findings.push({
      level: 'WARNING',
      code: 'ENTITIES_NO_DATABASE',
      message: `${intent.requiredEntities.length} entities defined but no database detected`,
      affectedPolicies: ['hasDatabase'],
      suggestedResolution: 'Add "database" or "storage" to business rules'
    });
  }

  // Check 3: If billing is detected, database is needed
  if (detectedPolicies.has('hasBilling') && !detectedPolicies.has('hasDatabase')) {
    findings.push({
      level: 'ERROR',
      code: 'BILLING_NO_DATABASE',
      message: 'Billing/Payments require persistent database for transaction records',
      affectedPolicies: ['hasBilling', 'hasDatabase'],
      suggestedResolution: 'Add database storage for billing transactions'
    });
  }

  // Check 4: Open API conflicts with RBAC
  if (detectedPolicies.has('openApi') && detectedPolicies.has('rbacEnforced')) {
    findings.push({
      level: 'ERROR',
      code: 'OPEN_API_RBAC_CONFLICT',
      message: 'Open/Public API contradicts strict role-based access control',
      affectedPolicies: ['openApi', 'rbacEnforced'],
      suggestedResolution: 'Either restrict API access or reduce RBAC strictness'
    });
  }

  return findings;
};

/**
 * Main Contradiction Detection Engine
 */
export class ContradictionDetectionEngine {
  /**
   * Detect all contradictions in the architecture
   */
  public detect(
    intent: IntentIR,
    manifest: AppManifest,
    prompt: string
  ): ConflictDetectionResult {
    const findings: ValidationIssue[] = [];

    // Step 1: Infer detected policies
    const detectedPolicies = inferDetectedPolicies(intent, manifest);

    // Step 2: Check direct contradictions
    findings.push(...detectDirectContradictions(detectedPolicies));

    // Step 3: Check compliance rules
    findings.push(...validateComplianceRules(detectedPolicies, prompt));

    // Step 4: Check architecture feasibility
    findings.push(...validateArchitectureFeasibility(intent, manifest, detectedPolicies));

    // Separate fatalities
    const fatalities = findings.filter(f => f.level === 'FATAL');

    // Count by level
    const summary = {
      infoCount: findings.filter(f => f.level === 'INFO').length,
      warningCount: findings.filter(f => f.level === 'WARNING').length,
      errorCount: findings.filter(f => f.level === 'ERROR').length,
      fatalCount: fatalities.length
    };

    return {
      passed: fatalities.length === 0,
      findings,
      fatalities,
      summary
    };
  }

  /**
   * Get a human-readable report of findings
   */
  public formatReport(result: ConflictDetectionResult): string {
    const lines: string[] = [];

    if (result.passed) {
      lines.push('✅ No fatal contradictions detected');
    } else {
      lines.push(`❌ FATAL contradictions found (${result.summary.fatalCount})`);
      for (const fatal of result.fatalities) {
        lines.push(`   [${fatal.code}] ${fatal.message}`);
        lines.push(`   → ${fatal.suggestedResolution}`);
      }
    }

    if (result.summary.errorCount > 0) {
      lines.push(`⚠️  ${result.summary.errorCount} error(s)`);
    }

    if (result.summary.warningCount > 0) {
      lines.push(`ℹ️  ${result.summary.warningCount} warning(s)`);
    }

    return lines.join('\n');
  }
}
