export type BenchmarkCase = {
  id: string;
  category: 'saas' | 'edge' | 'contradiction';
  prompt: string;
  expectedDomain: string;
  requiredEntities: string[];
  requiredRoles: string[];
  expectedIntegrations: string[];
};

export const BENCHMARKS: BenchmarkCase[] = [
  {
    id: 'saas-01-crm',
    category: 'saas',
    prompt: 'Build a CRM for sales teams with leads, contacts, deals, payments, and analytics. Roles: Admin, Manager, SalesAgent.',
    expectedDomain: 'CRM',
    requiredEntities: ['User', 'Contact', 'Lead', 'Deal', 'Payment', 'AnalyticsEvent'],
    requiredRoles: ['Admin', 'Manager', 'SalesAgent'],
    expectedIntegrations: ['stripe', 'analytics']
  },
  {
    id: 'saas-02-healthcare',
    category: 'saas',
    prompt: 'Create a hospital system with patients, doctors, appointments, prescriptions, and invoices. Roles: Admin, Doctor, Nurse.',
    expectedDomain: 'Healthcare',
    requiredEntities: ['Patient', 'Doctor', 'Appointment', 'Prescription', 'Invoice'],
    requiredRoles: ['Admin', 'Doctor', 'Nurse'],
    expectedIntegrations: []
  },
  {
    id: 'saas-03-ecommerce',
    category: 'saas',
    prompt: 'An ecommerce store with products, orders, customers, checkout, and Stripe payments. Roles: Admin, Customer.',
    expectedDomain: 'E-commerce',
    requiredEntities: ['Product', 'Order', 'Customer', 'Payment'],
    requiredRoles: ['Admin', 'Customer'],
    expectedIntegrations: ['stripe']
  },
  {
    id: 'saas-04-marketplace',
    category: 'saas',
    prompt: 'Marketplace for vendors and buyers. Listings, orders, payouts, and payment tracking. Roles: Admin, Seller, Buyer.',
    expectedDomain: 'Marketplace',
    requiredEntities: ['Listing', 'Order', 'Payment'],
    requiredRoles: ['Admin', 'Seller', 'Buyer'],
    expectedIntegrations: ['payment']
  },
  {
    id: 'saas-05-saas',
    category: 'saas',
    prompt: 'A SaaS workspace with organizations, users, subscriptions, and billing via Stripe. Roles: Admin, Member.',
    expectedDomain: 'SaaS',
    requiredEntities: ['Organization', 'User', 'Subscription', 'Payment'],
    requiredRoles: ['Admin', 'Member'],
    expectedIntegrations: ['stripe']
  },
  {
    id: 'saas-06-social',
    category: 'saas',
    prompt: 'Community platform with users, posts, comments, and moderation. Roles: Admin, Member.',
    expectedDomain: 'SocialNetwork',
    requiredEntities: ['User', 'Post', 'Comment'],
    requiredRoles: ['Admin', 'Member'],
    expectedIntegrations: []
  },
  {
    id: 'saas-07-edtech',
    category: 'saas',
    prompt: 'Learning management system with courses, lessons, instructors, and students. Roles: Admin, Instructor, Student.',
    expectedDomain: 'EdTech',
    requiredEntities: ['Course', 'Lesson'],
    requiredRoles: ['Admin', 'Instructor', 'Student'],
    expectedIntegrations: []
  },
  {
    id: 'saas-08-fintech',
    category: 'saas',
    prompt: 'Fintech wallet with accounts, transactions, and payments. Roles: Admin, Customer.',
    expectedDomain: 'FinTech',
    requiredEntities: ['Account', 'Transaction', 'Payment'],
    requiredRoles: ['Admin', 'Customer'],
    expectedIntegrations: ['payment']
  },
  {
    id: 'saas-09-internal',
    category: 'saas',
    prompt: 'Internal ops tool for finance team with role-based access. Roles: Admin, Operator.',
    expectedDomain: 'InternalTool',
    requiredEntities: ['User'],
    requiredRoles: ['Admin', 'Operator'],
    expectedIntegrations: []
  },
  {
    id: 'saas-10-crm-analytics',
    category: 'saas',
    prompt: 'CRM with analytics dashboard and Stripe billing. Roles: Admin, Manager.',
    expectedDomain: 'CRM',
    requiredEntities: ['User', 'Contact', 'Lead', 'Deal', 'AnalyticsEvent', 'Payment'],
    requiredRoles: ['Admin', 'Manager'],
    expectedIntegrations: ['stripe', 'analytics']
  },
  {
    id: 'edge-01-roles',
    category: 'edge',
    prompt: 'CRM for sales. Roles: Admin, Manager, Employee.',
    expectedDomain: 'CRM',
    requiredEntities: ['User', 'Contact', 'Lead', 'Deal'],
    requiredRoles: ['Admin', 'Manager', 'Employee'],
    expectedIntegrations: []
  },
  {
    id: 'edge-02-analytics-only',
    category: 'edge',
    prompt: 'Sales analytics dashboard for CRM usage. Roles: Admin, Analyst.',
    expectedDomain: 'CRM',
    requiredEntities: ['AnalyticsEvent'],
    requiredRoles: ['Admin', 'Analyst'],
    expectedIntegrations: ['analytics']
  },
  {
    id: 'edge-03-payments',
    category: 'edge',
    prompt: 'Billing system with Stripe payments for subscriptions. Roles: Admin, Member.',
    expectedDomain: 'SaaS',
    requiredEntities: ['Subscription', 'Payment', 'Organization', 'User'],
    requiredRoles: ['Admin', 'Member'],
    expectedIntegrations: ['stripe']
  },
  {
    id: 'edge-04-minimal',
    category: 'edge',
    prompt: 'Simple task tracker. Roles: User.',
    expectedDomain: 'GenericTask',
    requiredEntities: ['User', 'Task'],
    requiredRoles: ['User'],
    expectedIntegrations: []
  },
  {
    id: 'edge-05-healthcare',
    category: 'edge',
    prompt: 'Clinic scheduling system for patients and doctors. Roles: Admin, Doctor.',
    expectedDomain: 'Healthcare',
    requiredEntities: ['Patient', 'Doctor', 'Appointment'],
    requiredRoles: ['Admin', 'Doctor'],
    expectedIntegrations: []
  },
  {
    id: 'edge-06-marketplace',
    category: 'edge',
    prompt: 'Marketplace with vendor catalogs and buyer orders. Roles: Admin, Seller, Buyer.',
    expectedDomain: 'Marketplace',
    requiredEntities: ['Listing', 'Order'],
    requiredRoles: ['Admin', 'Seller', 'Buyer'],
    expectedIntegrations: []
  },
  {
    id: 'edge-07-saas',
    category: 'edge',
    prompt: 'Multi-tenant SaaS with workspaces and teams. Roles: Admin, Member.',
    expectedDomain: 'SaaS',
    requiredEntities: ['Organization', 'User'],
    requiredRoles: ['Admin', 'Member'],
    expectedIntegrations: []
  },
  {
    id: 'edge-08-social',
    category: 'edge',
    prompt: 'Social feed with posts. Roles: Admin, Member.',
    expectedDomain: 'SocialNetwork',
    requiredEntities: ['User', 'Post'],
    requiredRoles: ['Admin', 'Member'],
    expectedIntegrations: []
  },
  {
    id: 'edge-09-fintech',
    category: 'edge',
    prompt: 'Wallet that tracks transactions. Roles: Admin, Customer.',
    expectedDomain: 'FinTech',
    requiredEntities: ['Account', 'Transaction'],
    requiredRoles: ['Admin', 'Customer'],
    expectedIntegrations: []
  },
  {
    id: 'edge-10-edtech',
    category: 'edge',
    prompt: 'Course platform with lessons and students. Roles: Admin, Instructor, Student.',
    expectedDomain: 'EdTech',
    requiredEntities: ['Course', 'Lesson'],
    requiredRoles: ['Admin', 'Instructor', 'Student'],
    expectedIntegrations: []
  },
  {
    id: 'contradiction-01',
    category: 'contradiction',
    prompt: 'CRM for sales but no leads or contacts. Roles: Admin, Manager.',
    expectedDomain: 'CRM',
    requiredEntities: ['Lead', 'Contact', 'Deal'],
    requiredRoles: ['Admin', 'Manager'],
    expectedIntegrations: []
  },
  {
    id: 'contradiction-02',
    category: 'contradiction',
    prompt: 'Healthcare system with no patients. Roles: Admin, Doctor.',
    expectedDomain: 'Healthcare',
    requiredEntities: ['Patient', 'Doctor', 'Appointment'],
    requiredRoles: ['Admin', 'Doctor'],
    expectedIntegrations: []
  },
  {
    id: 'contradiction-03',
    category: 'contradiction',
    prompt: 'Marketplace without buyers or sellers. Roles: Admin.',
    expectedDomain: 'Marketplace',
    requiredEntities: ['Listing', 'Order'],
    requiredRoles: ['Admin'],
    expectedIntegrations: []
  },
  {
    id: 'contradiction-04',
    category: 'contradiction',
    prompt: 'SaaS with no users. Roles: Admin, Member.',
    expectedDomain: 'SaaS',
    requiredEntities: ['User', 'Organization'],
    requiredRoles: ['Admin', 'Member'],
    expectedIntegrations: []
  },
  {
    id: 'contradiction-05',
    category: 'contradiction',
    prompt: 'Analytics dashboard but no events. Roles: Admin, Analyst.',
    expectedDomain: 'CRM',
    requiredEntities: ['AnalyticsEvent'],
    requiredRoles: ['Admin', 'Analyst'],
    expectedIntegrations: ['analytics']
  },
  {
    id: 'contradiction-06',
    category: 'contradiction',
    prompt: 'Ecommerce without products. Roles: Admin, Customer.',
    expectedDomain: 'E-commerce',
    requiredEntities: ['Product', 'Order', 'Customer'],
    requiredRoles: ['Admin', 'Customer'],
    expectedIntegrations: []
  },
  {
    id: 'contradiction-07',
    category: 'contradiction',
    prompt: 'Fintech payments without transactions. Roles: Admin, Customer.',
    expectedDomain: 'FinTech',
    requiredEntities: ['Account', 'Transaction', 'Payment'],
    requiredRoles: ['Admin', 'Customer'],
    expectedIntegrations: ['payment']
  },
  {
    id: 'contradiction-08',
    category: 'contradiction',
    prompt: 'Social app without posts. Roles: Admin, Member.',
    expectedDomain: 'SocialNetwork',
    requiredEntities: ['User', 'Post'],
    requiredRoles: ['Admin', 'Member'],
    expectedIntegrations: []
  },
  {
    id: 'contradiction-09',
    category: 'contradiction',
    prompt: 'EdTech platform with no lessons. Roles: Admin, Instructor, Student.',
    expectedDomain: 'EdTech',
    requiredEntities: ['Course', 'Lesson'],
    requiredRoles: ['Admin', 'Instructor', 'Student'],
    expectedIntegrations: []
  },
  {
    id: 'contradiction-10',
    category: 'contradiction',
    prompt: 'CRM pipeline with Stripe billing but no payments. Roles: Admin, Manager.',
    expectedDomain: 'CRM',
    requiredEntities: ['Payment', 'Lead', 'Deal', 'Contact'],
    requiredRoles: ['Admin', 'Manager'],
    expectedIntegrations: ['stripe']
  }
];
