/**
 * PHASE 4: DEFAULT RBAC CONFIGURATION
 * Pre-configured roles and policies for common application patterns
 */

import { RBACConfig, Role, Policy, PolicyRule, PolicyContext } from './engine';

/**
 * Default RBAC Configuration
 * Provides enterprise-grade role hierarchy and policies out of the box
 */
export const createDefaultRBACConfig = (): RBACConfig => ({
  roles: [
    // System Roles (highest privilege)
    {
      name: 'SystemAdmin',
      description: 'Full system access including configuration and user management',
      parentRoles: [],
      isSystem: true,
      permissions: [
        { resource: '*', action: '*', description: 'Full system access' }
      ]
    },

    // Administrative Roles
    {
      name: 'Admin',
      description: 'Administrative access to all business data and user management',
      parentRoles: ['Manager'],
      isSystem: false,
      permissions: [
        { resource: 'user', action: '*', description: 'Full user management' },
        { resource: 'system', action: '*', description: 'System configuration access' },
        { resource: 'audit', action: 'read', description: 'Access to audit logs' }
      ]
    },

    // Management Roles
    {
      name: 'Manager',
      description: 'Management access with oversight capabilities',
      parentRoles: ['Supervisor'],
      isSystem: false,
      permissions: [
        { resource: 'report', action: '*', description: 'Access to all reports' },
        { resource: 'team', action: '*', description: 'Team management' },
        { resource: 'user', action: 'read', description: 'View user information' },
        {
          resource: 'user',
          action: 'update',
          conditions: [{ field: 'role', operator: 'ne', value: 'Admin', description: 'Cannot modify admin users' }],
          description: 'Update non-admin users'
        }
      ]
    },

    {
      name: 'Supervisor',
      description: 'Supervisory role with team oversight',
      parentRoles: ['Employee'],
      isSystem: false,
      permissions: [
        { resource: 'team', action: 'read', description: 'View team information' },
        { resource: 'performance', action: 'read', description: 'Access performance metrics' }
      ]
    },

    // Operational Roles
    {
      name: 'Employee',
      description: 'Standard employee access',
      parentRoles: ['User'],
      isSystem: false,
      permissions: [
        { resource: 'profile', action: '*', description: 'Manage own profile' },
        { resource: 'task', action: '*', description: 'Task management' }
      ]
    },

    // Basic User Role
    {
      name: 'User',
      description: 'Basic authenticated user',
      parentRoles: [],
      isSystem: false,
      permissions: [
        { resource: 'profile', action: 'read', description: 'Read own profile' },
        { resource: 'profile', action: 'update', description: 'Update own profile' }
      ]
    }
  ],

  policies: [
    // Business Hours Policy
    {
      name: 'BusinessHoursPolicy',
      description: 'Restrict certain operations to business hours',
      priority: 100,
      enabled: true,
      rules: [{
        name: 'BusinessHoursOnly',
        condition: (context: PolicyContext) => {
          const now = new Date();
          const hour = now.getHours();
          const day = now.getDay();
          // Business hours: Monday-Friday, 9 AM - 6 PM
          return day >= 1 && day <= 5 && hour >= 9 && hour < 18;
        },
        effect: 'allow',
        permissions: [
          { resource: 'financial', action: '*' },
          { resource: 'contract', action: 'create' }
        ],
        description: 'Allow financial operations only during business hours'
      }]
    },

    // Data Classification Policy
    {
      name: 'DataClassificationPolicy',
      description: 'Enforce data classification rules',
      priority: 90,
      enabled: true,
      rules: [
        {
          name: 'SensitiveDataAccess',
          condition: (context: PolicyContext) => {
            // Check if resource contains sensitive data
            const sensitiveFields = ['ssn', 'salary', 'medical', 'financial'];
            return sensitiveFields.some(field =>
              context.resource && context.resource[field] !== undefined
            );
          },
          effect: 'allow',
          permissions: [
            { resource: 'sensitive', action: 'read' }
          ],
          description: 'Require special permissions for sensitive data'
        },
        {
          name: 'GDPRCompliance',
          condition: (context: PolicyContext) => {
            // Check for GDPR-related operations
            return context.resource?.gdprRequired === true;
          },
          effect: 'deny',
          permissions: [
            { resource: '*', action: '*' }
          ],
          description: 'Block operations requiring GDPR compliance if not authorized'
        }
      ]
    },

    // Geographic Access Policy
    {
      name: 'GeographicAccessPolicy',
      description: 'Restrict access based on geographic location',
      priority: 80,
      enabled: false, // Disabled by default
      rules: [{
        name: 'AllowedRegionsOnly',
        condition: (context: PolicyContext) => {
          const allowedCountries = ['US', 'CA', 'GB', 'DE'];
          const userCountry = context.environment?.country || 'US';
          return allowedCountries.includes(userCountry);
        },
        effect: 'allow',
        permissions: [
          { resource: '*', action: '*' }
        ],
        description: 'Allow access only from approved countries'
      }]
    },

    // Device Security Policy
    {
      name: 'DeviceSecurityPolicy',
      description: 'Enforce device security requirements',
      priority: 70,
      enabled: true,
      rules: [{
        name: 'SecureDeviceRequired',
        condition: (context: PolicyContext) => {
          // Check for device security indicators
          const userAgent = context.environment?.userAgent || '';
          const isMobile = /Mobile|Android|iPhone/i.test(userAgent);
          const hasMFA = context.user?.mfaEnabled === true;

          // Require MFA for non-mobile devices
          return isMobile || hasMFA;
        },
        effect: 'allow',
        permissions: [
          { resource: 'sensitive', action: '*' }
        ],
        description: 'Require MFA for sensitive operations on non-mobile devices'
      }]
    }
  ],

  defaultDeny: true,
  enableAudit: true,
  cacheEnabled: true,
  cacheTTL: 300 // 5 minutes
});

/**
 * Domain-specific RBAC configurations
 */
export const domainRBACConfigs = {
  CRM: (): Partial<RBACConfig> => ({
    roles: [
      {
        name: 'SalesManager',
        description: 'Sales team manager',
        parentRoles: ['Manager'],
        isSystem: false,
        permissions: [
          { resource: 'lead', action: '*', description: 'Full lead management' },
          { resource: 'deal', action: '*', description: 'Full deal management' },
          { resource: 'contact', action: '*', description: 'Full contact management' },
          { resource: 'sales', action: 'read', description: 'Sales analytics' }
        ]
      },
      {
        name: 'SalesRep',
        description: 'Sales representative',
        parentRoles: ['Employee'],
        isSystem: false,
        permissions: [
          { resource: 'lead', action: 'create', description: 'Create leads' },
          { resource: 'lead', action: 'update', conditions: [{ field: 'assignedTo', operator: 'eq', value: '${user.id}' }] },
          { resource: 'contact', action: 'read', description: 'View contacts' },
          { resource: 'contact', action: 'create', description: 'Create contacts' }
        ]
      }
    ]
  }),

  Healthcare: (): Partial<RBACConfig> => ({
    roles: [
      {
        name: 'Doctor',
        description: 'Medical practitioner',
        parentRoles: ['Employee'],
        isSystem: false,
        permissions: [
          { resource: 'patient', action: 'read', description: 'View patient records' },
          { resource: 'patient', action: 'update', description: 'Update patient records' },
          { resource: 'medical', action: '*', description: 'Full medical record access' }
        ]
      },
      {
        name: 'Nurse',
        description: 'Nursing staff',
        parentRoles: ['Employee'],
        isSystem: false,
        permissions: [
          { resource: 'patient', action: 'read', description: 'View patient information' },
          { resource: 'vital', action: '*', description: 'Manage vital signs' }
        ]
      }
    ],
    policies: [
      {
        name: 'HIPAAPolicy',
        description: 'HIPAA compliance requirements',
        priority: 1000, // Highest priority
        enabled: true,
        rules: [{
          name: 'PatientPrivacy',
          condition: (context: PolicyContext) => {
            // HIPAA requires patient privacy
            return context.action === 'read' && context.resource?.patientId;
          },
          effect: 'allow',
          permissions: [
            { resource: 'patient', action: 'read' }
          ],
          description: 'Enforce patient privacy under HIPAA'
        }]
      }
    ]
  }),

  FinTech: (): Partial<RBACConfig> => ({
    roles: [
      {
        name: 'ComplianceOfficer',
        description: 'Regulatory compliance officer',
        parentRoles: ['Manager'],
        isSystem: false,
        permissions: [
          { resource: 'transaction', action: 'read', description: 'Monitor transactions' },
          { resource: 'audit', action: '*', description: 'Full audit access' },
          { resource: 'compliance', action: '*', description: 'Compliance operations' }
        ]
      }
    ],
    policies: [
      {
        name: 'PCIDSSPolicy',
        description: 'PCI DSS compliance requirements',
        priority: 900,
        enabled: true,
        rules: [{
          name: 'SecurePaymentProcessing',
          condition: (context: PolicyContext) => {
            return context.resource?.paymentData === true;
          },
          effect: 'allow',
          permissions: [
            { resource: 'payment', action: '*' }
          ],
          description: 'Enforce PCI DSS for payment processing'
        }]
      }
    ]
  })
};

/**
 * Helper function to merge domain-specific config with default config
 */
export const createDomainRBACConfig = (domain: string): RBACConfig => {
  const baseConfig = createDefaultRBACConfig();
  const domainConfig = domainRBACConfigs[domain as keyof typeof domainRBACConfigs];

  if (domainConfig) {
    const domainSpecific = domainConfig();
    return {
      ...baseConfig,
      roles: [...baseConfig.roles, ...(domainSpecific.roles || [])],
      policies: [...baseConfig.policies, ...(domainSpecific.policies || [])]
    };
  }

  return baseConfig;
};