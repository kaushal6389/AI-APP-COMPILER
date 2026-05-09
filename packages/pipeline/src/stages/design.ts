import { IntentIR, DesignSchema, DesignIR } from '@ai-compiler/schemas';
import { DOMAIN_ONTOLOGY, DomainKey } from '../domain/ontology';

/**
 * Stage 2: System Design Layer
 * Takes the validated Intent IR and generates structural boundaries, relationships, and architecture.
 */
export class SystemDesignStage {
  public async execute(intent: IntentIR): Promise<DesignIR> {
    console.log(`[Stage 2] Designing system architecture for domain: ${intent.domain}...`);

    const entityNames = intent.requiredEntities.map((entity) => entity.name);
    const primaryRole = intent.primaryRoles[0]?.name || 'User';
    const serviceBoundaries = {
      CoreAccessModule: ['User'],
      DomainDataModule: entityNames
    };

    const modules = [
      {
        name: 'CoreAccessModule',
        responsibility: 'Handles identity, authentication, and authorization',
        dependencies: []
      },
      {
        name: 'DomainDataModule',
        responsibility: `Manages ${intent.domain} entities and business workflows`,
        dependencies: ['CoreAccessModule']
      }
    ];

    const profile = DOMAIN_ONTOLOGY[intent.domain as DomainKey];
    if (profile) {
      if (profile.expectedAIModules) {
        profile.expectedAIModules.forEach(mod => {
          modules.push({
            name: mod,
            responsibility: `AI logic block for ${mod}`,
            dependencies: ['DomainDataModule']
          });
        });
      }
      if (profile.infrastructurePatterns) {
        profile.infrastructurePatterns.forEach(pattern => {
          modules.push({
            name: pattern,
            responsibility: `Infrastructure support pattern: ${pattern}`,
            dependencies: ['DomainDataModule']
          });
        });
      }
    }

    const mockDesignJson = {
      architecture: profile?.infrastructurePatterns?.length ? 'Distributed' : 'Monolith',
      modules,
      entityRelationships: entityNames.slice(0, 2).map((name, index) => ({
        from: name,
        to: entityNames[index + 1] || name,
        relationType: index % 2 === 0 ? '1:N' : 'N:1'
      })),
      userFlows: [
        {
          role: primaryRole,
          entryPoint: '/dashboard',
          paths: [`/dashboard -> /${entityNames[0]?.toLowerCase() || 'items'} -> /${entityNames[0]?.toLowerCase() || 'items'}/new`]
        }
      ],
      serviceBoundaries
    };

    const parseResult = DesignSchema.safeParse(mockDesignJson);
    if (!parseResult.success) {
      console.error('[Stage 2] Schema Validation Failed', parseResult.error);
      throw new Error('System design generation produced invalid schema structure.');
    }

    console.log('[Stage 2] System Design Generation Successful.');
    return parseResult.data;
  }
}
