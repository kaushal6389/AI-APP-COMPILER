# PHASE 3: CONTRADICTION DETECTION ENGINE DESIGN

## MISSION
Detect and reject impossible or internally inconsistent architectures before they propagate.
- Classify validation issues as INFO/WARNING/ERROR/FATAL
- Reject architectures with fatal contradictions
- Provide clear conflict explanations

---

## CURRENT PROBLEM

```typescript
// Current: Only existence checks
export class ValidationAndRepairStage {
  public async execute(intent: IntentIR, manifest: AppManifest): Promise<AppManifest> {
    // Checks:
    // ✓ Required entities exist in DB
    // ✓ Each DB model has at least one API
    // ✓ Roles in APIs are in intent
    // ✓ Auth is required
    // But:
    // ✗ NO policy conflicts (e.g., "no auth" + "HIPAA")
    // ✗ NO contradiction detection (e.g., "anonymous" + "must login")
    // ✗ NO severity classification (all errors treated equally)
    // ✗ NO fatal vs. fixable distinction
  }
}
```

**Fatal Issues That Currently Pass:**
- ❌ "No authentication required" + "HIPAA compliance"
- ❌ "Anonymous users allowed" + "Mandatory login"
- ❌ "No database" + "PostgreSQL required"
- ❌ "No payments" + "Stripe integration"
- ❌ "No roles" + "Role-based access control"

---

## SOLUTION ARCHITECTURE

### **Component 1: Contradiction Graph**

**Purpose:** Model policy constraints and detect conflicts.

```typescript
interface PolicyConstraint {
  name: string;
  type: 'Feature' | 'Security' | 'Compliance' | 'Architecture' | 'Data';
  required: boolean; // true = MUST exist, false = MUST NOT exist
  conflicts: PolicyConstraint[]; // Policies that conflict with this one
  explanation: string;
}

const POLICY_CONSTRAINTS: Record<string, PolicyConstraint> = {
  // Security Policies
  hasAuth: {
    name: 'Authentication',
    type: 'Security',
    required: false,
    conflicts: [/* hipaa without auth */],
    explanation: 'System includes user authentication'
  },
  
  hipaaCompliance: {
    name: 'HIPAA Compliance',
    type: 'Compliance',
    required: false,
    conflicts: ['noAuth'], // ← CONTRADICTION
    explanation: 'System must be HIPAA compliant'
  },
  
  noAuth: {
    name: 'No Authentication',
    type: 'Security',
    required: false,
    conflicts: ['hipaaCompliance', 'sensitive Data'],
    explanation: 'System explicitly does not require authentication'
  },
  
  // Access Control Policies
  hasRoles: {
    name: 'Role-Based Access',
    type: 'Security',
    required: false,
    conflicts: ['noRoles'],
    explanation: 'System uses role-based access control'
  },
  
  noRoles: {
    name: 'No Roles',
    type: 'Security',
    required: false,
    conflicts: ['hasRoles'],
    explanation: 'System explicitly has no roles'
  },
  
  // Data Policies
  hasDatabase: {
    name: 'Persistent Database',
    type: 'Architecture',
    required: false,
    conflicts: ['noDatabase'],
    explanation: 'System requires a database'
  },
  
  noDatabase: {
    name: 'No Database',
    type: 'Architecture',
    required: false,
    conflicts: ['hasDatabase', 'hasBilling', 'multiTenant'],
    explanation: 'System does not use a database'
  },
  
  // Billing Policies
  hasBilling: {
    name: 'Billing/Payments',
    type: 'Feature',
    required: false,
    conflicts: ['noPayments'],
    explanation: 'System includes billing'
  },
  
  noPayments: {
    name: 'No Payments',
    type: 'Feature',
    required: false,
    conflicts: ['hasBilling'],
    explanation: 'System explicitly has no payments'
  },
  
  // Multi-tenancy Policies
  multiTenant: {
    name: 'Multi-tenant',
    type: 'Architecture',
    required: false,
    conflicts: ['singleTenant'],
    explanation: 'System supports multiple tenants'
  },
  
  singleTenant: {
    name: 'Single Tenant',
    type: 'Architecture',
    required: false,
    conflicts: ['multiTenant'],
    explanation: 'System is single-tenant only'
  },
};
```

---

### **Component 2: Conflict Detector**

**Purpose:** Analyze intent + manifest for contradictions.

```typescript
interface ContradictionFinding {
  severity: 'INFO' | 'WARNING' | 'ERROR' | 'FATAL';
  code: string;
  message: string;
  affectedPolicies: string[];
  suggestedResolution: string;
}

const detectContradictions = (
  intent: IntentIR,
  manifest: AppManifest
): ContradictionFinding[] => {
  const findings: ContradictionFinding[] = [];
  
  // Extract detected policies from intent + manifest
  const detectedPolicies = new Set<string>();
  
  // From intent
  if (intent.businessRules) {
    if (intent.businessRules.some(r => r.toLowerCase().includes('auth'))) {
      detectedPolicies.add('hasAuth');
    }
    if (intent.businessRules.some(r => r.toLowerCase().includes('hipaa'))) {
      detectedPolicies.add('hipaaCompliance');
    }
    if (intent.businessRules.some(r => r.toLowerCase().includes('role'))) {
      detectedPolicies.add('hasRoles');
    }
  }
  
  // From manifest
  if (manifest.api.some(api => api.authRequired)) {
    detectedPolicies.add('hasAuth');
  }
  
  if (manifest.api.some(api => api.rolesAllowed.length > 0)) {
    detectedPolicies.add('hasRoles');
  }
  
  if (manifest.database.length > 0) {
    detectedPolicies.add('hasDatabase');
  }
  
  // Check for conflicts
  for (const policy of detectedPolicies) {
    const constraint = POLICY_CONSTRAINTS[policy];
    if (!constraint) continue;
    
    for (const conflictingPolicy of constraint.conflicts) {
      if (detectedPolicies.has(conflictingPolicy)) {
        findings.push({
          severity: 'FATAL',
          code: `CONTRADICTION_${policy}_vs_${conflictingPolicy}`,
          message: `Policy "${constraint.name}" contradicts "${POLICY_CONSTRAINTS[conflictingPolicy]?.name || conflictingPolicy}"`,
          affectedPolicies: [policy, conflictingPolicy],
          suggestedResolution: `Remove one of: ${constraint.name} or ${POLICY_CONSTRAINTS[conflictingPolicy]?.name || conflictingPolicy}`
        });
      }
    }
  }
  
  return findings;
};
```

---

### **Component 3: Compliance Rule Engine**

**Purpose:** Check against compliance frameworks (HIPAA, GDPR, SOC2, etc).

```typescript
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
    forbids: [],
    severity: 'FATAL',
    explanation: 'HIPAA compliance requires user authentication and audit trails'
  },
  {
    name: 'HIPAA Requires Encryption',
    framework: 'HIPAA',
    requires: ['hasEncryption'],
    forbids: [],
    severity: 'FATAL',
    explanation: 'HIPAA requires data encryption at rest and in transit'
  },
  {
    name: 'GDPR Requires Data Privacy',
    framework: 'GDPR',
    requires: ['hasDataDeletion', 'hasConsentManagement'],
    forbids: ['unrestricted Data Sharing'],
    severity: 'FATAL',
    explanation: 'GDPR requires ability to delete data and manage consent'
  },
  {
    name: 'PCI-DSS Requires Secure Payments',
    framework: 'PCI-DSS',
    requires: ['hasPaymentEncryption', 'hasAuthForPayments'],
    forbids: ['plaintext Passwords'],
    severity: 'FATAL',
    explanation: 'PCI-DSS requires secure payment processing'
  },
];

const validateCompliance = (
  prompt: string,
  intent: IntentIR
): ContradictionFinding[] => {
  const findings: ContradictionFinding[] = [];
  const lowered = prompt.toLowerCase();
  
  // Detect which compliance frameworks are required
  const requiredFrameworks = new Set<string>();
  if (lowered.includes('hipaa')) requiredFrameworks.add('HIPAA');
  if (lowered.includes('gdpr')) requiredFrameworks.add('GDPR');
  if (lowered.includes('pci') || lowered.includes('payment')) requiredFrameworks.add('PCI-DSS');
  
  // Check each framework's rules
  for (const rule of COMPLIANCE_RULES) {
    if (!requiredFrameworks.has(rule.framework)) continue;
    
    // Check requires
    for (const required of rule.requires) {
      // (simplified: would check manifest for actual implementation)
      if (!lowered.includes(required.toLowerCase())) {
        findings.push({
          severity: rule.severity,
          code: `COMPLIANCE_MISSING_${required}`,
          message: `${rule.framework} requires "${required}" but not detected in architecture`,
          affectedPolicies: [required],
          suggestedResolution: rule.explanation
        });
      }
    }
    
    // Check forbids
    for (const forbidden of rule.forbids) {
      if (lowered.includes(forbidden.toLowerCase())) {
        findings.push({
          severity: rule.severity,
          code: `COMPLIANCE_FORBIDDEN_${forbidden}`,
          message: `${rule.framework} forbids "${forbidden}" but detected in prompt`,
          affectedPolicies: [forbidden],
          suggestedResolution: rule.explanation
        });
      }
    }
  }
  
  return findings;
};
```

---

### **Component 4: Fatal Validation**

**Purpose:** Block impossible architectures with clear messages.

```typescript
export class ContradictionDetectionEngine {
  private contradictions: ContradictionFinding[] = [];
  
  public detect(intent: IntentIR, manifest: AppManifest, prompt: string): {
    passed: boolean;
    findings: ContradictionFinding[];
    fatalities: ContradictionFinding[];
  } {
    const findings: ContradictionFinding[] = [];
    
    // Layer 1: Direct contradictions
    findings.push(...detectContradictions(intent, manifest));
    
    // Layer 2: Compliance rules
    findings.push(...validateCompliance(prompt, intent));
    
    // Layer 3: Architecture feasibility
    findings.push(...validateArchitectureFeasibility(intent, manifest));
    
    // Separate fatalities
    const fatalities = findings.filter(f => f.severity === 'FATAL');
    
    return {
      passed: fatalities.length === 0,
      findings,
      fatalities
    };
  }
}
```

---

### **Component 5: Severity Classification**

**Purpose:** Clearly categorize each validation issue.

```typescript
interface ValidationIssue {
  level: 'INFO' | 'WARNING' | 'ERROR' | 'FATAL';
  code: string;
  message: string;
  context?: Record<string, any>;
  resolution?: string;
}

// INFO: Non-blocking informational notes
// "Entity 'User' detected in primary roles"

// WARNING: Attention needed but doesn't block
// "Role 'Manager' not used in any API routes"
// "Analytics integration detected but no AnalyticsEvent entity"

// ERROR: Should be fixed before deployment
// "Critical entity 'Patient' missing from database"
// "API route '/users' has no authentication"

// FATAL: Blocks compilation entirely
// "Authentication required + No authentication allowed" (impossible)
// "HIPAA compliance required + No database" (impossible)
// "No payments allowed + Stripe integration required" (impossible)
```

---

## INTEGRATION POINTS

### **Update ValidationAndRepairStage**
```typescript
export class ValidationAndRepairStage {
  public async execute(intent: IntentIR, manifest: AppManifest): Promise<AppManifest> {
    // Existing checks...
    
    // NEW: Contradiction detection
    const contradictionEngine = new ContradictionDetectionEngine();
    const contradictions = contradictionEngine.detect(intent, manifest, prompt);
    
    if (!contradictions.passed) {
      // FATAL contradictions block the pipeline
      for (const fatal of contradictions.fatalities) {
        console.error(`[FATAL] ${fatal.message}`);
        console.error(`  Code: ${fatal.code}`);
        console.error(`  Resolution: ${fatal.suggestedResolution}`);
      }
      throw new Error('Fatal contradictions detected; architecture is impossible');
    }
    
    // Warnings and errors are reported but don't block
    for (const finding of contradictions.findings.filter(f => f.severity === 'WARNING' || f.severity === 'ERROR')) {
      console.warn(`[${finding.severity}] ${finding.message}`);
    }
    
    return manifest;
  }
}
```

---

## SUCCESS CRITERIA

✅ **FATAL contradictions block compilation**
✅ **"No auth + HIPAA" → FATAL**
✅ **"Anonymous + mandatory login" → FATAL**
✅ **"No DB + PostgreSQL" → FATAL**
✅ **"No payments + Stripe" → FATAL**
✅ **Severity levels properly classified**
✅ **Clear resolution suggestions provided**
✅ **All 15 validation tests pass**

---

## EXAMPLE: Expected Behavior Change

**OLD BEHAVIOR:**
```
Prompt: "Build a healthcare app. No authentication. HIPAA compliant."
→ Validation passes (all entities exist)
→ No contradiction detected
→ System generates invalid architecture ❌
```

**NEW BEHAVIOR:**
```
Prompt: "Build a healthcare app. No authentication. HIPAA compliant."
→ Detects: hasAuth=false, hipaaCompliance=true
→ Detects contradiction: HIPAA requires authentication
→ Classification: FATAL
→ Compilation BLOCKED ✅
→ Message: "HIPAA Requires Authentication - Healthcare systems must include user authentication and audit trails. Either enable authentication or remove HIPAA compliance requirement."
```

---

## PHASE 3 READINESS GATES

1. ✅ Policy constraints graph implemented
2. ✅ Conflict detector working (tests for all mutual exclusions)
3. ✅ Compliance rules engine complete (HIPAA, GDPR, SOC2, PCI-DSS)
4. ✅ Architecture feasibility checks implemented
5. ✅ Severity classification (INFO/WARNING/ERROR/FATAL) working
6. ✅ FATAL contradictions block pipeline
7. ✅ 30+ test cases covering all contradiction scenarios
8. ✅ Clear resolution messages for each contradiction type
