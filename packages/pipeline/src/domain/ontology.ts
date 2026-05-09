/**
 * PHASE 1: Extended Domain Ontology
 * 
 * Comprehensive domain catalog with multiple domain types.
 * Each domain defines required and optional entities, roles, and integrations.
 * 
 * This replaces and extends the original DOMAIN_CATALOG in intent.ts
 */

import { IntentIR } from '@ai-compiler/schemas';

export type DomainKey = 
  | 'CRM'
  | 'Healthcare'
  | 'E-commerce'
  | 'SaaS'
  | 'Marketplace'
  | 'SocialNetwork'
  | 'EdTech'
  | 'FinTech'
  | 'InternalTool'
  | 'AIHiringPlatform'
  | 'LegalAIPlatform'
  | 'ContentPlatform'
  | 'DevOpsPlatform'
  | 'CompilerPlatform'
  | 'ObservabilitySystem'
  | 'TradingSystem'
  | 'WorkflowAutomation'
  | 'DistributedSystem'
  | 'GenericTask';

export interface DomainEntity {
  name: string;
  corePurpose: string;
  isDomainCritical: boolean;
  suggestedFields: string[];
}

export interface DomainRole {
  name: string;
  description: string;
  isSystem: boolean;
}

export interface DomainProfile {
  keywords: string[];
  alternateNames?: string[]; // Synonyms for matching
  defaultRoles: DomainRole[];
  requiredEntities: DomainEntity[];
  optionalEntities: DomainEntity[];
  integrationKeywords: Record<string, string>;
  architecturePattern?: string; // e.g., "Multi-tenant SaaS", "Event-driven Microservices"
  complianceRequirements?: string[]; // e.g., ["HIPAA", "GDPR"]
  
  // Semantic Architecture Synthesis Features
  expectedWorkflows?: string[];
  expectedAIModules?: string[];
  infrastructurePatterns?: string[];
  collaborationPatterns?: string[];
}

export const DOMAIN_ONTOLOGY: Record<DomainKey, DomainProfile> = {
  // ============================================================
  // EXISTING DOMAINS (Enhanced)
  // ============================================================
  
  CRM: {
    keywords: ['crm', 'lead', 'deal', 'sales', 'pipeline', 'contact', 'prospect'],
    alternateNames: ['customer relationship', 'sales management', 'lead management'],
    defaultRoles: [
      { name: 'Admin', description: 'System administrator', isSystem: true },
      { name: 'Manager', description: 'Sales manager', isSystem: false },
      { name: 'SalesAgent', description: 'Sales representative', isSystem: false }
    ],
    requiredEntities: [
      { name: 'User', corePurpose: 'System user', isDomainCritical: true, suggestedFields: ['email', 'name', 'role'] },
      { name: 'Contact', corePurpose: 'Customer contact', isDomainCritical: true, suggestedFields: ['firstName', 'lastName', 'phone', 'email'] },
      { name: 'Lead', corePurpose: 'Sales prospect', isDomainCritical: true, suggestedFields: ['status', 'source', 'value', 'score'] },
      { name: 'Deal', corePurpose: 'Sales opportunity', isDomainCritical: true, suggestedFields: ['amount', 'stage', 'closeDate', 'probability'] }
    ],
    optionalEntities: [
      { name: 'Activity', corePurpose: 'Engagement record', isDomainCritical: false, suggestedFields: ['type', 'notes', 'timestamp'] },
      { name: 'Subscription', corePurpose: 'Plan tracking', isDomainCritical: false, suggestedFields: ['plan', 'status', 'renewalDate'] },
      { name: 'Payment', corePurpose: 'Billing record', isDomainCritical: false, suggestedFields: ['amount', 'currency', 'status'] },
      { name: 'AnalyticsEvent', corePurpose: 'Usage analytics', isDomainCritical: false, suggestedFields: ['eventType', 'createdAt'] }
    ],
    integrationKeywords: {
      stripe: 'Billing',
      payment: 'Billing',
      analytics: 'Analytics'
    },
    architecturePattern: 'Multi-tenant SaaS'
  },

  Healthcare: {
    keywords: ['health', 'hospital', 'clinic', 'doctor', 'patient', 'prescription', 'medical', 'healthcare'],
    alternateNames: ['medical', 'health care', 'patient portal', 'telemedicine'],
    defaultRoles: [
      { name: 'Admin', description: 'System administrator', isSystem: true },
      { name: 'Doctor', description: 'Medical provider', isSystem: false },
      { name: 'Nurse', description: 'Care assistant', isSystem: false },
      { name: 'Patient', description: 'Patient account', isSystem: false }
    ],
    requiredEntities: [
      { name: 'Patient', corePurpose: 'Patient record', isDomainCritical: true, suggestedFields: ['dateOfBirth', 'bloodGroup', 'gender', 'medicalHistory'] },
      { name: 'Doctor', corePurpose: 'Medical professional', isDomainCritical: true, suggestedFields: ['specialty', 'licenseId', 'qualifications'] },
      { name: 'Appointment', corePurpose: 'Clinical visit', isDomainCritical: true, suggestedFields: ['scheduledAt', 'status', 'notes', 'duration'] },
      { name: 'Prescription', corePurpose: 'Medication order', isDomainCritical: true, suggestedFields: ['drugName', 'dosage', 'frequency', 'duration'] }
    ],
    optionalEntities: [
      { name: 'Invoice', corePurpose: 'Billing record', isDomainCritical: false, suggestedFields: ['amount', 'status', 'issuedAt'] },
      { name: 'MedicalRecord', corePurpose: 'Patient history', isDomainCritical: false, suggestedFields: ['type', 'recordedAt', 'findings'] }
    ],
    integrationKeywords: {
      payment: 'Billing',
      stripe: 'Billing'
    },
    complianceRequirements: ['HIPAA', 'GDPR']
  },

  'E-commerce': {
    keywords: ['store', 'shop', 'ecommerce', 'cart', 'checkout', 'order', 'product', 'marketplace'],
    alternateNames: ['online store', 'shopping', 'retail'],
    defaultRoles: [
      { name: 'Admin', description: 'Store administrator', isSystem: true },
      { name: 'Vendor', description: 'Seller', isSystem: false },
      { name: 'Customer', description: 'Shopper', isSystem: false }
    ],
    requiredEntities: [
      { name: 'Product', corePurpose: 'Catalog item', isDomainCritical: true, suggestedFields: ['name', 'price', 'sku', 'description', 'category'] },
      { name: 'Order', corePurpose: 'Purchase record', isDomainCritical: true, suggestedFields: ['status', 'total', 'orderDate', 'shippingAddress'] },
      { name: 'Customer', corePurpose: 'Buyer profile', isDomainCritical: true, suggestedFields: ['email', 'name', 'phone', 'address'] }
    ],
    optionalEntities: [
      { name: 'Payment', corePurpose: 'Billing record', isDomainCritical: false, suggestedFields: ['amount', 'status', 'method'] },
      { name: 'Review', corePurpose: 'Product review', isDomainCritical: false, suggestedFields: ['rating', 'text', 'reviewedAt'] },
      { name: 'CartItem', corePurpose: 'Shopping cart', isDomainCritical: false, suggestedFields: ['productId', 'quantity', 'price'] }
    ],
    integrationKeywords: {
      stripe: 'Billing',
      payment: 'Billing',
      shipping: 'Fulfillment'
    }
  },

  SaaS: {
    keywords: ['saas', 'subscription', 'tenant', 'workspace', 'enterprise', 'cloud app'],
    alternateNames: ['software as a service', 'multi-tenant', 'cloud service'],
    defaultRoles: [
      { name: 'Admin', description: 'Workspace admin', isSystem: true },
      { name: 'Member', description: 'Standard user', isSystem: false }
    ],
    requiredEntities: [
      { name: 'Organization', corePurpose: 'Tenant workspace', isDomainCritical: true, suggestedFields: ['name', 'plan', 'createdAt'] },
      { name: 'User', corePurpose: 'Account holder', isDomainCritical: true, suggestedFields: ['email', 'name', 'role', 'organizationId'] }
    ],
    optionalEntities: [
      { name: 'Subscription', corePurpose: 'Plan record', isDomainCritical: false, suggestedFields: ['plan', 'status', 'startDate', 'renewalDate'] },
      { name: 'Payment', corePurpose: 'Billing record', isDomainCritical: false, suggestedFields: ['amount', 'status', 'method'] },
      { name: 'AuditLog', corePurpose: 'Audit trail', isDomainCritical: false, suggestedFields: ['action', 'userId', 'timestamp'] }
    ],
    integrationKeywords: {
      stripe: 'Billing',
      payment: 'Billing'
    },
    architecturePattern: 'Multi-tenant SaaS',
    complianceRequirements: ['SOC2', 'GDPR']
  },

  Marketplace: {
    keywords: ['marketplace', 'vendor', 'seller', 'buyer', 'listing', 'auction'],
    alternateNames: ['platform marketplace', 'multi-vendor'],
    defaultRoles: [
      { name: 'Admin', description: 'Platform admin', isSystem: true },
      { name: 'Seller', description: 'Vendor', isSystem: false },
      { name: 'Buyer', description: 'Customer', isSystem: false }
    ],
    requiredEntities: [
      { name: 'Listing', corePurpose: 'Product listing', isDomainCritical: true, suggestedFields: ['title', 'price', 'vendorId', 'description'] },
      { name: 'Order', corePurpose: 'Purchase', isDomainCritical: true, suggestedFields: ['status', 'total', 'buyerId', 'sellerId'] },
      { name: 'Vendor', corePurpose: 'Seller profile', isDomainCritical: true, suggestedFields: ['name', 'rating', 'commission'] }
    ],
    optionalEntities: [
      { name: 'Payment', corePurpose: 'Billing record', isDomainCritical: false, suggestedFields: ['amount', 'status', 'vendorId'] },
      { name: 'Review', corePurpose: 'Product review', isDomainCritical: false, suggestedFields: ['rating', 'text', 'vendorId'] },
      { name: 'Dispute', corePurpose: 'Order dispute', isDomainCritical: false, suggestedFields: ['orderId', 'reason', 'status'] }
    ],
    integrationKeywords: {
      payment: 'Billing',
      stripe: 'Billing'
    }
  },

  SocialNetwork: {
    keywords: ['social', 'community', 'feed', 'post', 'tweet', 'social network'],
    alternateNames: ['social media', 'community platform', 'social app'],
    defaultRoles: [
      { name: 'Admin', description: 'Community admin', isSystem: true },
      { name: 'Moderator', description: 'Content moderator', isSystem: false },
      { name: 'Member', description: 'Community member', isSystem: false }
    ],
    requiredEntities: [
      { name: 'User', corePurpose: 'Profile owner', isDomainCritical: true, suggestedFields: ['email', 'name', 'bio', 'profilePicture'] },
      { name: 'Post', corePurpose: 'User content', isDomainCritical: true, suggestedFields: ['content', 'createdAt', 'userId', 'likes'] }
    ],
    optionalEntities: [
      { name: 'Comment', corePurpose: 'Discussion', isDomainCritical: false, suggestedFields: ['content', 'createdAt', 'postId', 'userId'] },
      { name: 'Like', corePurpose: 'Engagement', isDomainCritical: false, suggestedFields: ['userId', 'postId', 'createdAt'] },
      { name: 'Follow', corePurpose: 'User connection', isDomainCritical: false, suggestedFields: ['followerId', 'followeeId'] }
    ],
    integrationKeywords: {}
  },

  EdTech: {
    keywords: ['course', 'lesson', 'student', 'teacher', 'learning', 'education', 'class', 'school'],
    alternateNames: ['e-learning', 'online education', 'training platform'],
    defaultRoles: [
      { name: 'Admin', description: 'Platform admin', isSystem: true },
      { name: 'Instructor', description: 'Course owner', isSystem: false },
      { name: 'Student', description: 'Learner', isSystem: false }
    ],
    requiredEntities: [
      { name: 'Course', corePurpose: 'Learning unit', isDomainCritical: true, suggestedFields: ['title', 'status', 'instructorId', 'description'] },
      { name: 'Lesson', corePurpose: 'Course module', isDomainCritical: true, suggestedFields: ['title', 'order', 'courseId', 'content'] },
      { name: 'Student', corePurpose: 'Learner enrollment', isDomainCritical: true, suggestedFields: ['userId', 'courseId', 'enrolledAt', 'progress'] }
    ],
    optionalEntities: [
      { name: 'Assignment', corePurpose: 'Course work', isDomainCritical: false, suggestedFields: ['lessonId', 'instructions', 'dueDate'] },
      { name: 'Grade', corePurpose: 'Performance record', isDomainCritical: false, suggestedFields: ['studentId', 'lessonId', 'score'] }
    ],
    integrationKeywords: {}
  },

  FinTech: {
    keywords: ['wallet', 'transaction', 'bank', 'finance', 'payment', 'account', 'ledger', 'portfolio'],
    alternateNames: ['financial', 'banking', 'money management'],
    defaultRoles: [
      { name: 'Admin', description: 'System admin', isSystem: true },
      { name: 'Customer', description: 'Account holder', isSystem: false },
      { name: 'Auditor', description: 'Financial auditor', isSystem: false }
    ],
    requiredEntities: [
      { name: 'Account', corePurpose: 'Ledger account', isDomainCritical: true, suggestedFields: ['balance', 'currency', 'accountType', 'userId'] },
      { name: 'Transaction', corePurpose: 'Money movement', isDomainCritical: true, suggestedFields: ['amount', 'status', 'fromAccountId', 'toAccountId', 'timestamp'] }
    ],
    optionalEntities: [
      { name: 'Payment', corePurpose: 'Payment record', isDomainCritical: false, suggestedFields: ['amount', 'status', 'method'] },
      { name: 'Wallet', corePurpose: 'Digital wallet', isDomainCritical: false, suggestedFields: ['userId', 'balance', 'currency'] },
      { name: 'Portfolio', corePurpose: 'Investment holdings', isDomainCritical: false, suggestedFields: ['userId', 'assets', 'totalValue'] }
    ],
    integrationKeywords: {
      stripe: 'Billing'
    },
    complianceRequirements: ['PCI-DSS', 'SOC2']
  },

  InternalTool: {
    keywords: ['internal', 'ops', 'admin tool', 'backoffice', 'operations'],
    alternateNames: ['internal system', 'back office', 'operational tool'],
    defaultRoles: [
      { name: 'Admin', description: 'System admin', isSystem: true },
      { name: 'Operator', description: 'Internal user', isSystem: false }
    ],
    requiredEntities: [
      { name: 'User', corePurpose: 'Internal account', isDomainCritical: true, suggestedFields: ['email', 'name', 'department'] }
    ],
    optionalEntities: [],
    integrationKeywords: {}
  },

  // ============================================================
  // NEW DOMAINS (Phase 1 Enhancement)
  // ============================================================

  AIHiringPlatform: {
    keywords: ['hiring', 'recruit', 'candidate', 'job', 'interview', 'resume', 'rank', 'applicant tracking'],
    alternateNames: ['talent acquisition', 'recruitment', 'ats', 'job board'],
    defaultRoles: [
      { name: 'Admin', description: 'System admin', isSystem: true },
      { name: 'Recruiter', description: 'Hiring manager', isSystem: false },
      { name: 'Candidate', description: 'Job applicant', isSystem: false }
    ],
    requiredEntities: [
      { name: 'Candidate', corePurpose: 'Job applicant', isDomainCritical: true, suggestedFields: ['name', 'email', 'phone', 'resumeUrl', 'score'] },
      { name: 'Resume', corePurpose: 'Resume document', isDomainCritical: true, suggestedFields: ['candidateId', 'rawText', 'parsedData', 'uploadedAt'] },
      { name: 'Interview', corePurpose: 'Interview record', isDomainCritical: true, suggestedFields: ['candidateId', 'scheduledAt', 'feedback', 'score'] },
      { name: 'Recruiter', corePurpose: 'Hiring team member', isDomainCritical: true, suggestedFields: ['name', 'email', 'department'] },
      { name: 'RankingScore', corePurpose: 'ML ranking score', isDomainCritical: true, suggestedFields: ['candidateId', 'scoreValue', 'factors', 'model'] }
    ],
    optionalEntities: [
      { name: 'JobPosting', corePurpose: 'Job opening', isDomainCritical: false, suggestedFields: ['title', 'description', 'requirements', 'department'] },
      { name: 'InterviewQuestion', corePurpose: 'Interview template', isDomainCritical: false, suggestedFields: ['text', 'category', 'difficulty'] },
      { name: 'Feedback', corePurpose: 'Interview feedback', isDomainCritical: false, suggestedFields: ['interviewId', 'recruiterId', 'comment', 'rating'] }
    ],
    integrationKeywords: {
      stripe: 'Billing'
    }
  },

  LegalAIPlatform: {
    keywords: ['contract', 'legal', 'clause', 'risk', 'ocr', 'document', 'compliance', 'legal tech'],
    alternateNames: ['legal tech', 'contract analysis', 'document review'],
    defaultRoles: [
      { name: 'Admin', description: 'System admin', isSystem: true },
      { name: 'LegalAnalyst', description: 'Legal professional', isSystem: false },
      { name: 'Client', description: 'Document owner', isSystem: false }
    ],
    requiredEntities: [
      { name: 'Contract', corePurpose: 'Legal document', isDomainCritical: true, suggestedFields: ['title', 'text', 'status', 'uploadedAt', 'uploadedBy'] },
      { name: 'Clause', corePurpose: 'Contract clause', isDomainCritical: true, suggestedFields: ['text', 'type', 'contractId', 'riskLevel'] },
      { name: 'RiskScore', corePurpose: 'Document risk assessment', isDomainCritical: true, suggestedFields: ['contractId', 'overallRisk', 'factors', 'timestamp'] },
      { name: 'OCRDocument', corePurpose: 'Scanned document', isDomainCritical: true, suggestedFields: ['rawImage', 'extractedText', 'confidence', 'uploadedAt'] }
    ],
    optionalEntities: [
      { name: 'Review', corePurpose: 'Manual review record', isDomainCritical: false, suggestedFields: ['contractId', 'reviewerId', 'findings', 'reviewedAt'] },
      { name: 'RiskFlag', corePurpose: 'Flagged risk item', isDomainCritical: false, suggestedFields: ['riskScoreId', 'flagType', 'description'] }
    ],
    integrationKeywords: {}
  },

  ContentPlatform: {
    keywords: ['content', 'post', 'blog', 'article', 'author', 'publish', 'cms', 'editorial'],
    alternateNames: ['publishing platform', 'blog platform', 'content management'],
    defaultRoles: [
      { name: 'Admin', description: 'Platform admin', isSystem: true },
      { name: 'Editor', description: 'Content editor', isSystem: false },
      { name: 'Author', description: 'Content creator', isSystem: false },
      { name: 'Reader', description: 'Content reader', isSystem: false }
    ],
    requiredEntities: [
      { name: 'Article', corePurpose: 'Published content', isDomainCritical: true, suggestedFields: ['title', 'body', 'authorId', 'publishedAt', 'status'] },
      { name: 'Author', corePurpose: 'Content creator', isDomainCritical: true, suggestedFields: ['name', 'bio', 'email', 'profilePicture'] }
    ],
    optionalEntities: [
      { name: 'Comment', corePurpose: 'Article comment', isDomainCritical: false, suggestedFields: ['text', 'articleId', 'authorId', 'createdAt'] },
      { name: 'Category', corePurpose: 'Content category', isDomainCritical: false, suggestedFields: ['name', 'slug', 'description'] },
      { name: 'Tag', corePurpose: 'Content tag', isDomainCritical: false, suggestedFields: ['name', 'slug'] }
    ],
    integrationKeywords: {}
  },

  // ============================================================
  // FALLBACK DOMAIN (Should rarely be used with Phase 1)
  // ============================================================

  GenericTask: {
    keywords: [],
    defaultRoles: [
      { name: 'User', description: 'Default user', isSystem: false }
    ],
    requiredEntities: [
      { name: 'User', corePurpose: 'Account owner', isDomainCritical: true, suggestedFields: ['email'] },
      { name: 'Task', corePurpose: 'Unit of work', isDomainCritical: true, suggestedFields: ['title', 'status'] }
    ],
    optionalEntities: [],
    integrationKeywords: {}
  },

  // ============================================================
  // ADVANCED SYSTEMS AND DOMAINS
  // ============================================================
  
  DevOpsPlatform: {
    keywords: ['devops', 'ci', 'cd', 'pipeline', 'deployment', 'runner', 'build', 'infrastructure', 'provision'],
    alternateNames: ['infrastructure platform', 'continuous integration', 'build system'],
    defaultRoles: [
      { name: 'Admin', description: 'Platform admin', isSystem: true },
      { name: 'Engineer', description: 'Systems engineer', isSystem: false }
    ],
    requiredEntities: [
      { name: 'PipelineRun', corePurpose: 'Execution state', isDomainCritical: true, suggestedFields: ['status', 'startedAt', 'completedAt', 'trigger'] },
      { name: 'ExecutionDAG', corePurpose: 'Task dependency graph', isDomainCritical: true, suggestedFields: ['runId', 'nodes', 'edges', 'status'] },
      { name: 'WorkerNode', corePurpose: 'Execution agent', isDomainCritical: true, suggestedFields: ['hostname', 'status', 'capacity', 'labels'] }
    ],
    optionalEntities: [
      { name: 'QueueJob', corePurpose: 'Scheduled task', isDomainCritical: false, suggestedFields: ['payload', 'retries', 'workerId'] },
      { name: 'CompilerDiagnostic', corePurpose: 'Build error/log', isDomainCritical: false, suggestedFields: ['runId', 'msg', 'level'] }
    ],
    integrationKeywords: { github: 'VCS', aws: 'Cloud' },
    architecturePattern: 'Distributed Orchestration Engine',
    expectedWorkflows: ['Pipeline Execution', 'Worker Provisioning', 'Log Collection'],
    infrastructurePatterns: ['Message Queue', 'Worker Fleet', 'DAG Executor']
  },

  CompilerPlatform: {
    keywords: ['compiler', 'synthesizer', 'generator', 'ast', 'ir', 'transpile', 'code generation'],
    alternateNames: ['ai software engineering platform', 'code generator', 'architecture synthesizer'],
    defaultRoles: [
      { name: 'Admin', description: 'Platform Administrator', isSystem: true },
      { name: 'Architect', description: 'System designer', isSystem: false }
    ],
    requiredEntities: [
      { name: 'CompilationSession', corePurpose: 'Session tracker', isDomainCritical: true, suggestedFields: ['prompt', 'status', 'artifacts'] },
      { name: 'ExecutionDAG', corePurpose: 'Pipeline stages', isDomainCritical: true, suggestedFields: ['sessionId', 'stages', 'errors'] },
      { name: 'CompilerDiagnostic', corePurpose: 'System errors/logs', isDomainCritical: true, suggestedFields: ['level', 'message', 'stage'] }
    ],
    optionalEntities: [
      { name: 'WorkerNode', corePurpose: 'Generator node', isDomainCritical: false, suggestedFields: ['status', 'uptime'] },
      { name: 'TelemetryEvent', corePurpose: 'Performance logs', isDomainCritical: false, suggestedFields: ['metric', 'value', 'timestamp'] }
    ],
    integrationKeywords: { openai: 'LLM Generation', github: 'Artifact Storage' },
    architecturePattern: 'Semantic Compilation Engine',
    expectedWorkflows: ['Lexical Parsing', 'Semantic Synthesis', 'AST Generation', 'Code Emission'],
    expectedAIModules: ['IntentInferenceModel', 'ArchitectureSynthesisModel', 'SemanticValidator'],
    infrastructurePatterns: ['Pipeline DAG', 'Cache Layer', 'Diagnostic Aggregator']
  },

  ObservabilitySystem: {
    keywords: ['observability', 'telemetry', 'logs', 'metrics', 'tracing', 'apm', 'dashboard', 'monitor'],
    alternateNames: ['monitoring platform', 'application performance monitoring'],
    defaultRoles: [
      { name: 'Admin', description: 'Admin', isSystem: true },
      { name: 'Operator', description: 'Viewer', isSystem: false }
    ],
    requiredEntities: [
      { name: 'TelemetryEvent', corePurpose: 'Raw log', isDomainCritical: true, suggestedFields: ['service', 'level', 'message', 'timestamp'] },
      { name: 'Metric', corePurpose: 'Time-series data', isDomainCritical: true, suggestedFields: ['name', 'value', 'tags', 'timestamp'] },
      { name: 'Alert', corePurpose: 'Triggered condition', isDomainCritical: true, suggestedFields: ['condition', 'severity', 'status'] }
    ],
    optionalEntities: [
      { name: 'Dashboard', corePurpose: 'Visualization', isDomainCritical: false, suggestedFields: ['name', 'panels'] }
    ],
    integrationKeywords: { datadog: 'Downstream', pagerduty: 'Alerting' },
    architecturePattern: 'High-Throughput Ingestion System',
    expectedWorkflows: ['Event Ingestion', 'Metric Aggregation', 'Anomaly Detection'],
    infrastructurePatterns: ['Time-Series Datalake', 'Stream Processor']
  },

  TradingSystem: {
    keywords: ['trading', 'exchange', 'orderbook', 'crypto', 'stock', 'brokerage', 'matching engine'],
    alternateNames: ['financial exchange', 'crypto exchange', 'brokerage platform'],
    defaultRoles: [
      { name: 'Admin', description: 'Admin', isSystem: true },
      { name: 'Trader', description: 'User', isSystem: false }
    ],
    requiredEntities: [
      { name: 'Asset', corePurpose: 'Traded symbol', isDomainCritical: true, suggestedFields: ['symbol', 'name', 'type'] },
      { name: 'Order', corePurpose: 'Trade intent', isDomainCritical: true, suggestedFields: ['assetId', 'side', 'price', 'quantity', 'status'] },
      { name: 'Ledger', corePurpose: 'Settlement', isDomainCritical: true, suggestedFields: ['userId', 'assetId', 'balance'] }
    ],
    optionalEntities: [
      { name: 'Execution', corePurpose: 'Matched trade', isDomainCritical: false, suggestedFields: ['buyOrderId', 'sellOrderId', 'price'] }
    ],
    integrationKeywords: { plaid: 'Fiat Onramp' },
    architecturePattern: 'Low-Latency Matching Engine',
    expectedWorkflows: ['Order Submission', 'Matching', 'Settlement'],
    infrastructurePatterns: ['In-Memory Orderbook', 'Event-Sourced Ledger']
  },

  WorkflowAutomation: {
    keywords: ['workflow', 'automation', 'zapier', 'nokia', 'trigger', 'action', 'integration', 'connect'],
    alternateNames: ['integration platform', 'ipaaS', 'workflow engine'],
    defaultRoles: [
      { name: 'Admin', description: 'Admin', isSystem: true },
      { name: 'Creator', description: 'Workflow builder', isSystem: false }
    ],
    requiredEntities: [
      { name: 'Workflow', corePurpose: 'Rule definition', isDomainCritical: true, suggestedFields: ['name', 'trigger', 'actions', 'status'] },
      { name: 'Execution', corePurpose: 'Run instance', isDomainCritical: true, suggestedFields: ['workflowId', 'status', 'logs'] },
      { name: 'Connection', corePurpose: 'OAuth credential', isDomainCritical: true, suggestedFields: ['provider', 'token'] }
    ],
    optionalEntities: [],
    integrationKeywords: {},
    architecturePattern: 'Event-Driven Automation Engine',
    expectedWorkflows: ['Webhook Ingestion', 'Step Execution', 'Retry Logic'],
    infrastructurePatterns: ['Event Bus', 'Worker Queue']
  },

  DistributedSystem: {
    keywords: ['distributed', 'cluster', 'node', 'shard', 'partition', 'consensus', 'raft'],
    alternateNames: ['p2p system', 'cluster management'],
    defaultRoles: [
      { name: 'SysAdmin', description: 'Cluster manager', isSystem: true }
    ],
    requiredEntities: [
      { name: 'Node', corePurpose: 'Cluster member', isDomainCritical: true, suggestedFields: ['ip', 'role', 'status', 'heartbeat'] },
      { name: 'Partition', corePurpose: 'Data shard', isDomainCritical: true, suggestedFields: ['nodeId', 'range', 'replicaSet'] },
      { name: 'ClusterEvent', corePurpose: 'Topology change', isDomainCritical: true, suggestedFields: ['type', 'newLeader', 'timestamp'] }
    ],
    optionalEntities: [],
    integrationKeywords: {},
    architecturePattern: 'Leader-Follower Consensus Cluster',
    expectedWorkflows: ['Heartbeat Tracking', 'Leader Election', 'Data Replication'],
    infrastructurePatterns: ['Gossip Protocol', 'Consensus Log']
  }
};

/**
 * Get domain profile by key
 */
export const getDomainProfile = (domain: DomainKey): DomainProfile => {
  return DOMAIN_ONTOLOGY[domain];
};

/**
 * Get all available domain keys
 */
export const getAllDomainKeys = (): DomainKey[] => {
  return Object.keys(DOMAIN_ONTOLOGY) as DomainKey[];
};

/**
 * Get all non-fallback domain keys
 */
export const getActiveDomainKeys = (): DomainKey[] => {
  return getAllDomainKeys().filter(k => k !== 'GenericTask');
};
