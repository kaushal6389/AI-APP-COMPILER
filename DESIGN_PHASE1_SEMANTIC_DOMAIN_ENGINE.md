# PHASE 1: SEMANTIC DOMAIN ENGINE DESIGN

## MISSION
Replace keyword-only domain inference with true semantic understanding.
- Eliminate GenericTask (User + Task) fallback
- Infer domain-specific entities automatically
- Understand implicit features → required modules mapping

---

## CURRENT PROBLEM

```typescript
// Current: Only keyword matching
const inferDomain = (prompt: string): DomainKey => {
  const lowered = prompt.toLowerCase();
  const scored = Object.entries(DOMAIN_CATALOG)
    .filter(([key]) => key !== 'GenericTask')
    .map(([key, profile]) => ({
      domain: key as DomainKey,
      score: profile.keywords.filter((k) => lowered.includes(k)).length
    }))
    .filter((row) => row.score > 0)
    .sort((a, b) => b.score - a.score);

  return scored.length > 0 ? scored[0].domain : 'GenericTask'; // ← FALLBACK
};
```

**Issues:**
- Falls back to GenericTask when no keywords match (e.g., "build a hiring platform" → misses if not using exact keywords)
- Cannot understand synonyms or related concepts
- No feature inference (e.g., "ranking" → add ScoringEntity)
- No implicit requirement detection

---

## SOLUTION ARCHITECTURE

### **Component 1: Feature Classifier**

**Purpose:** Extract features from prompt text using semantic clustering.

**Features:**
```
Authentication Features:
  - "auth", "login", "oauth", "saml", "sso", "password", "session", "token"
  
Collaboration Features:
  - "real-time", "websocket", "notification", "messaging", "chat", "collaboration", "live"
  
AI/ML Features:
  - "ranking", "scoring", "machine learning", "ai", "prediction", "recommendation", "algorithm"
  
Document Processing Features:
  - "parsing", "ocr", "document", "pdf", "extraction", "file upload"
  
Reporting Features:
  - "analytics", "dashboard", "report", "chart", "metrics", "visualization"
  
Multi-tenant Features:
  - "multi-tenant", "organization", "workspace", "team", "group", "account"
  
Billing Features:
  - "billing", "payment", "subscription", "stripe", "invoice", "pricing"
  
Search Features:
  - "search", "filter", "query", "full-text", "fuzzy"
```

**Output:**
```typescript
interface FeatureSet {
  hasAuth: boolean;
  hasCollaboration: boolean;
  hasAI: boolean;
  hasDocumentProcessing: boolean;
  hasReporting: boolean;
  isMultiTenant: boolean;
  hasBilling: boolean;
  hasSearch: boolean;
}
```

---

### **Component 2: Entity Inference Engine**

**Purpose:** Map features → required entities.

**Mapping Rules:**
```typescript
interface EntityInference {
  features: FeatureSet;
  baseEntities: string[]; // Always required
  impliedEntities: Array<{ entity: string; reason: string; confidence: number }>;
}

const inferImpliedEntities = (features: FeatureSet): string[] => {
  const implied: string[] = [];
  
  if (features.hasAuth) implied.push('User', 'Role', 'Permission');
  if (features.hasCollaboration) implied.push('Notification', 'Message', 'Activity');
  if (features.hasAI) implied.push('MLScore', 'Ranking', 'ScoreCard');
  if (features.hasDocumentProcessing) implied.push('Document', 'DocumentParser', 'ParseResult');
  if (features.hasReporting) implied.push('Report', 'Dashboard', 'ChartData');
  if (features.isMultiTenant) implied.push('Organization', 'Workspace', 'Team');
  if (features.hasBilling) implied.push('Payment', 'Invoice', 'Subscription');
  if (features.hasSearch) implied.push('SearchIndex', 'Filter', 'Query');
  
  return [...new Set(implied)]; // Deduplicate
};
```

---

### **Component 3: Domain Selector with Confidence**

**Purpose:** Choose best-fit domain from catalog, with fallback handling.

**Logic:**
```typescript
interface DomainMatch {
  domain: DomainKey;
  confidence: number; // 0-1
  matchedKeywords: string[];
  impliedEntities: string[];
  reason: string;
}

const selectDomain = (
  prompt: string,
  features: FeatureSet,
  inferredEntities: string[]
): DomainMatch => {
  // Step 1: Keyword matching (existing)
  const keywordScores = scoreDomainsBy Keywords(prompt);
  
  // Step 2: Feature matching (new)
  // - Count how many inferred entities are already in domain catalog
  const featureScores = scoreDomainsBy Features(features, inferredEntities);
  
  // Step 3: Combined scoring
  // confidence = (keywordScore * 0.4) + (featureScore * 0.6)
  const combined = combineScores(keywordScores, featureScores, 0.4, 0.6);
  
  // Step 4: Pick top match
  const best = combined.sort((a, b) => b.confidence - a.confidence)[0];
  
  // Step 5: Only fallback if confidence < 0.3
  // (threshold tunable; 0.3 = must have 30% match to avoid fallback)
  if (best.confidence < 0.3) {
    return {
      domain: 'GenericTask',
      confidence: 0,
      reason: 'No confident domain match; using generic fallback',
      matchedKeywords: [],
      impliedEntities: inferredEntities
    };
  }
  
  return best;
};
```

---

### **Component 4: Extended Domain Catalog**

**Goal:** Expand catalog with AI/Platform-specific domains.

**New Domains to Add:**

```typescript
// AI Hiring Platform Domain
AIHiringPlatform: {
  keywords: ['hiring', 'recruit', 'candidate', 'job', 'interview', 'resume', 'rank'],
  requiredEntities: [
    { name: 'Candidate', fields: ['resumeUrl', 'skills', 'score'] },
    { name: 'Resume', fields: ['rawText', 'parsedData', 'candidateId'] },
    { name: 'Interview', fields: ['scheduledAt', 'feedback', 'score'] },
    { name: 'Recruiter', fields: ['email', 'department'] },
    { name: 'RankingScore', fields: ['candidateId', 'scoreValue', 'factors'] }
  ],
  optionalEntities: [
    { name: 'JobPosting', fields: ['title', 'description', 'requirements'] },
    { name: 'InterviewQuestion', fields: ['text', 'category', 'difficulty'] }
  ],
  features: { hasAI: true, hasDocumentProcessing: true, hasReporting: true }
}

// Healthcare Platform Domain
HealthcarePlatform: {
  keywords: ['patient', 'doctor', 'hospital', 'clinic', 'appointment', 'prescription', 'hipaa'],
  requiredEntities: [
    { name: 'Patient', fields: ['dateOfBirth', 'gender', 'medicalHistory'] },
    { name: 'Doctor', fields: ['specialty', 'licenseId', 'qualifications'] },
    { name: 'Appointment', fields: ['scheduledAt', 'status', 'notes'] },
    { name: 'Prescription', fields: ['drugName', 'dosage', 'frequency'] }
  ],
  features: { hasReporting: true, isMultiTenant: true }
}

// Legal AI Domain
LegalAIPlatform: {
  keywords: ['contract', 'legal', 'clause', 'risk', 'ocr', 'document'],
  requiredEntities: [
    { name: 'Contract', fields: ['text', 'status', 'uploadedAt'] },
    { name: 'Clause', fields: ['text', 'type', 'riskLevel'] },
    { name: 'RiskScore', fields: ['contractId', 'overallRisk', 'factors'] },
    { name: 'OCRDocument', fields: ['rawImage', 'extractedText'] }
  ],
  features: { hasDocumentProcessing: true, hasAI: true }
}

// Financial Platform Domain
FinancialPlatform: {
  keywords: ['transaction', 'ledger', 'wallet', 'portfolio', 'balance', 'bank'],
  requiredEntities: [
    { name: 'Account', fields: ['balance', 'currency', 'type'] },
    { name: 'Transaction', fields: ['amount', 'timestamp', 'type'] },
    { name: 'Wallet', fields: ['userId', 'balance', 'currency'] },
    { name: 'Portfolio', fields: ['userId', 'assets', 'totalValue'] }
  ],
  features: { hasBilling: true }
}

// Content Platform Domain
ContentPlatform: {
  keywords: ['content', 'post', 'blog', 'article', 'author', 'publish'],
  requiredEntities: [
    { name: 'Article', fields: ['title', 'body', 'publishedAt', 'authorId'] },
    { name: 'Author', fields: ['name', 'bio', 'email'] },
    { name: 'Comment', fields: ['text', 'articleId', 'authorId'] }
  ],
  features: { hasReporting: true, hasSearch: true }
}

// Marketplace Domain
Marketplace: {
  keywords: ['marketplace', 'vendor', 'seller', 'buyer', 'listing'],
  requiredEntities: [
    { name: 'Listing', fields: ['title', 'price', 'vendorId'] },
    { name: 'Order', fields: ['status', 'total', 'buyerId'] },
    { name: 'Vendor', fields: ['name', 'rating'] },
    { name: 'Review', fields: ['rating', 'text'] }
  ],
  features: { hasBilling: true, hasReporting: true }
}
```

---

### **Component 5: Intelligent Fallback Handling**

**Never silently default to User + Task.**

```typescript
interface FallbackReport {
  domain: 'GenericTask';
  confidence: 0;
  reason: string;
  detectedFeatures: FeatureSet;
  inferredEntities: string[];
  hallucinationRisk: 'Critical'; // Always critical for fallback
  warning: string;
}

const handleFallback = (prompt: string, features: FeatureSet): FallbackReport => {
  // If fallback occurs, emit critical warning
  const hasAnyFeatures = Object.values(features).some(f => f === true);
  const reason = hasAnyFeatures
    ? `No domain matched with sufficient confidence despite detecting features: ${Object.keys(features).filter(k => features[k as keyof FeatureSet]).join(', ')}`
    : 'Could not classify domain from prompt text';
  
  return {
    domain: 'GenericTask',
    confidence: 0,
    reason,
    detectedFeatures: features,
    inferredEntities: inferImpliedEntities(features),
    hallucinationRisk: 'Critical',
    warning: `⚠️ FALLBACK: System defaulting to User + Task. This is a sign that domain inference failed.`
  };
};
```

---

## IMPLEMENTATION STEPS

### **Step 1: Create `packages/pipeline/src/domain/features.ts`**
- Implement feature classifier
- Extract features from prompt text
- Return FeatureSet structure

### **Step 2: Create `packages/pipeline/src/domain/ontology.ts`**
- Extend DOMAIN_CATALOG with new domains
- Add feature→entity mappings
- Create domain profile enrichment

### **Step 3: Create `packages/pipeline/src/domain/inferenceEngine.ts`**
- Implement entity inference logic
- Feature-driven entity selection
- Confidence scoring

### **Step 4: Update `packages/pipeline/src/stages/intent.ts`**
- Replace `inferDomain()` with new semantic classifier
- Integrate feature extraction
- Use confidence scores
- Improve fallback reporting

### **Step 5: Add Tests**
- Test feature extraction on diverse prompts
- Test entity inference accuracy
- Test domain selection with edge cases
- Test fallback warning generation

---

## SUCCESS CRITERIA

✅ **No more silent User + Task fallback**
✅ **Domain confidence > 0.3 required to accept domain**
✅ **Feature inference working (e.g., "ranking" → add ScoringEntity)**
✅ **Fallback generates critical warning**
✅ **System handles 100+ prompt variations**
✅ **AI Hiring, Healthcare, Legal, Finance domains work perfectly**

---

## EXAMPLE: Expected Behavior Change

**OLD BEHAVIOR:**
```
Prompt: "Build a platform to rank job candidates by ML scoring"
→ No exact keywords match
→ Fallback to GenericTask
→ Output: User + Task entities ❌

Domain: GenericTask
Primary Roles: [User]
Required Entities: [User, Task]
```

**NEW BEHAVIOR:**
```
Prompt: "Build a platform to rank job candidates by ML scoring"
→ Feature extraction: hasAI=true, domain="hiring" detected
→ Entity inference: [Candidate, Resume, Ranking, MLScore]
→ Domain match: AIHiringPlatform (confidence: 0.87)
→ Output: Correct hiring platform entities ✅

Domain: AIHiringPlatform
Primary Roles: [Recruiter, Candidate]
Required Entities: [Candidate, Resume, Interview, Recruiter, RankingScore]
Implied: [MLScoreEntity, JobPosting]
Confidence: 0.87
```

---

## PHASE 1 READINESS GATES

Before marking Phase 1 complete:
1. ✅ Feature classifier implemented and tested
2. ✅ Domain catalog extended with 8+ domains
3. ✅ Entity inference working for all feature combinations
4. ✅ Confidence scoring accurate (validated on 50+ test prompts)
5. ✅ Fallback handling generates critical warnings
6. ✅ No prompt uses GenericTask fallback without warning
7. ✅ IntentExtractionStage fully updated
8. ✅ All 15 pipeline tests pass with new domain engine
