/**
 * PHASE 8: DETERMINISTIC EXECUTION PIPELINE
 *
 * Ensures identical inputs produce identical outputs through:
 * - Semantic hashing (intent + design → deterministic hash)
 * - Canonical naming (sorted entity/relation/field names)
 * - Schema-first generation (design drives schema)
 * - Output normalization (consistent formatting)
 * - IR canonicalization (sorted IR before generation)
 */

import crypto from 'crypto';
import type { IntentIR, AppManifest } from '@ai-compiler/schemas';
import type { DesignIR } from '../ir/types';

export interface SemanticHash {
  intentHash: string;      // Hash of what user wants (16 chars)
  designHash: string;      // Hash of how we'll build it (16 chars)
  combinedHash: string;    // Combined deterministic hash (16 chars)
  timestamp: number;       // When hash was computed
}

export interface CanonicalNaming {
  entityNames: Map<string, string>; // original → canonical (usually same)
  relationNames: Map<string, string>; // pairKey → canonical relation name
  fieldNames: Map<string, string>; // entity.field → canonical field name
  roleNames: string[]; // sorted canonical role names
  apiPaths: string[]; // sorted canonical API paths
}

/**
 * Component 1: Semantic Hashing
 * Generate consistent hash for given intent + design combination
 */
export class SemanticHasher {
  /**
   * Compute semantic hash for intent + design combination
   */
  static compute(intent: IntentIR, design: DesignIR): SemanticHash {
    const timestamp = Date.now();

    // Step 1: Create canonical intent representation
    const canonicalIntent = this.canonicalizeIntent(intent);

    // Step 2: Hash the canonical intent
    const intentHash = crypto
      .createHash('sha256')
      .update(JSON.stringify(canonicalIntent))
      .digest('hex')
      .substring(0, 16);

    // Step 3: Create canonical design representation
    const canonicalDesign = this.canonicalizeDesign(design);

    // Step 4: Hash the canonical design
    const designHash = crypto
      .createHash('sha256')
      .update(JSON.stringify(canonicalDesign))
      .digest('hex')
      .substring(0, 16);

    // Step 5: Combine hashes deterministically
    const combinedHash = crypto
      .createHash('sha256')
      .update(intentHash + designHash)
      .digest('hex')
      .substring(0, 16);

    return {
      intentHash,
      designHash,
      combinedHash,
      timestamp
    };
  }

  /**
   * Create canonical (deterministic) representation of intent
   */
  private static canonicalizeIntent(intent: IntentIR): any {
    return {
      domain: intent.domain,
      summary: intent.summary,
      roles: intent.primaryRoles
        .map(r => ({ name: r.name, description: r.description, isSystem: r.isSystem }))
        .sort((a, b) => a.name.localeCompare(b.name)), // ← DETERMINISTIC SORT
      entities: intent.requiredEntities
        .map(e => ({
          name: e.name,
          corePurpose: e.corePurpose,
          isDomainCritical: e.isDomainCritical,
          suggestedFields: [...(e.suggestedFields || [])].sort() // ← SORT fields
        }))
        .sort((a, b) => a.name.localeCompare(b.name)), // ← DETERMINISTIC SORT
      integrations: (intent.impliedIntegrations || [])
        .map(i => ({ provider: i.provider, purpose: i.purpose }))
        .sort((a, b) => `${a.provider}:${a.purpose}`.localeCompare(`${b.provider}:${b.purpose}`)), // ← DETERMINISTIC SORT
      businessRules: (intent.businessRules || []).sort(), // ← SORT rules
      hallucinationRisk: intent.hallucinationRisk
    };
  }

  /**
   * Create canonical (deterministic) representation of design
   */
  private static canonicalizeDesign(design: DesignIR): any {
    return {
      architecture: design.architecture,
      modules: design.modules
        .map(m => ({
          name: m.name,
          responsibility: m.responsibility,
          dependencies: [...(m.dependencies || [])].sort() // ← SORT dependencies
        }))
        .sort((a, b) => a.name.localeCompare(b.name)), // ← DETERMINISTIC SORT
      entityRelationships: (design.entityRelationships || [])
        .map(r => ({
          from: r.from,
          to: r.to,
          relationType: r.relationType
        }))
        .sort((a, b) => `${a.from}:${a.to}`.localeCompare(`${b.from}:${b.to}`)), // ← DETERMINISTIC SORT
      userFlows: (design.userFlows || [])
        .map(f => ({
          role: f.role,
          entryPoint: f.entryPoint,
          paths: [...f.paths].sort() // ← SORT paths
        }))
        .sort((a, b) => a.role.localeCompare(b.role)), // ← DETERMINISTIC SORT
      serviceBoundaries: this.canonicalizeServiceBoundaries(design.serviceBoundaries || {})
    };
  }

  /**
   * Canonicalize service boundaries (sort keys and values)
   */
  private static canonicalizeServiceBoundaries(boundaries: Record<string, any>): Record<string, any> {
    return Object.keys(boundaries)
      .sort() // ← DETERMINISTIC SORT
      .reduce((acc, key) => {
        const value = boundaries[key];
        acc[key] = Array.isArray(value) ? [...value].sort() : value; // ← SORT arrays
        return acc;
      }, {} as Record<string, any>);
  }

  /**
   * Verify two hashes are identical (for determinism testing)
   */
  static verifyDeterminism(hash1: SemanticHash, hash2: SemanticHash): boolean {
    return hash1.intentHash === hash2.intentHash &&
           hash1.designHash === hash2.designHash &&
           hash1.combinedHash === hash2.combinedHash;
  }
}

/**
 * Component 2: Canonical Naming System
 * Ensure consistent names across runs using deterministic sorting
 */
export class CanonicalNamer {
  /**
   * Build canonical naming system for manifest
   */
  static build(intent: IntentIR, manifest: AppManifest): CanonicalNaming {
    return {
      entityNames: this.buildEntityNames(manifest),
      relationNames: this.buildRelationNames(manifest),
      fieldNames: this.buildFieldNames(manifest),
      roleNames: this.buildRoleNames(intent),
      apiPaths: this.buildApiPaths(manifest)
    };
  }

  /**
   * Entity names: sorted alphabetically for consistency
   */
  private static buildEntityNames(manifest: AppManifest): Map<string, string> {
    const names = new Map<string, string>();
    manifest.database
      .map(db => db.name)
      .sort() // ← DETERMINISTIC ORDER
      .forEach(name => names.set(name, name)); // No renaming; just canonical order
    return names;
  }

  /**
   * Role names: sorted and locked
   */
  private static buildRoleNames(intent: IntentIR): string[] {
    return intent.primaryRoles
      .map(r => r.name)
      .sort(); // ← DETERMINISTIC ORDER
  }

  /**
   * Relation names: derived from entity pair + relation type
   * Format: {source}{target}{Type} (e.g., UserContactHasMany, ContactUserBelongsTo)
   */
  private static buildRelationNames(manifest: AppManifest): Map<string, string> {
    const names = new Map<string, string>();

    for (const db of manifest.database) {
      for (const rel of (db.relations || [])) {
        const pairKey = [db.name, rel.targetModel].sort().join(':');
        const relationName = this.deriveCanonicalRelationName(db.name, rel.targetModel, rel.type || 'hasMany');
        names.set(pairKey, relationName);
      }
    }

    return names;
  }

  /**
   * Derive canonical relation name from entity pair and type
   */
  private static deriveCanonicalRelationName(source: string, target: string, type: string): string {
    // Sort entities alphabetically for consistency
    const [first, second] = [source, target].sort();

    // Map relation types to canonical suffixes
    const typeSuffixes: Record<string, string> = {
      'hasMany': 'HasMany',
      'hasOne': 'HasOne',
      'belongsTo': 'BelongsTo',
      'ManyToMany': 'ManyToMany'
    };

    const suffix = typeSuffixes[type] || 'Relation';

    // Format: FirstEntitySecondEntitySuffix
    return `${first}${second}${suffix}`;
  }

  /**
   * Field names: ensure consistent ordering within entities
   */
  private static buildFieldNames(manifest: AppManifest): Map<string, string> {
    const names = new Map<string, string>();

    for (const db of manifest.database) {
      // Sort fields deterministically (id first, then alphabetically)
      const sortedFields = db.fields
        .sort((a, b) => {
          if (a.name === 'id') return -1;
          if (b.name === 'id') return 1;
          return a.name.localeCompare(b.name);
        });

      sortedFields.forEach(field => {
        const key = `${db.name}.${field.name}`;
        names.set(key, field.name); // No renaming; just canonical order
      });
    }

    return names;
  }

  /**
   * API paths: sorted deterministically
   */
  private static buildApiPaths(manifest: AppManifest): string[] {
    return manifest.api
      .map(api => api.path)
      .sort(); // ← DETERMINISTIC ORDER
  }
}

/**
 * Component 3: Output Normalization
 * Ensure consistent formatting and ordering of all outputs
 */
export class OutputNormalizer {
  /**
   * Normalize manifest to canonical form
   */
  static normalizeManifest(manifest: AppManifest): AppManifest {
    return {
      database: manifest.database
        .map(db => ({
          name: db.name,
          fields: db.fields
            .sort((a, b) => {
              // id field first, then sort alphabetically
              if (a.name === 'id') return -1;
              if (b.name === 'id') return 1;
              return a.name.localeCompare(b.name);
            }),
          relations: (db.relations || [])
            .sort((a, b) => {
              // Sort by target entity name
              const aTarget = a.targetModel || '';
              const bTarget = b.targetModel || '';
              return aTarget.localeCompare(bTarget);
            })
        }))
        .sort((a, b) => a.name.localeCompare(b.name)), // ← DETERMINISTIC SORT

      api: manifest.api
        .map(api => ({
          method: api.method,
          path: api.path,
          purpose: api.purpose,
          authRequired: api.authRequired,
          rolesAllowed: [...(api.rolesAllowed || [])].sort(), // ← SORT roles
          touchesEntities: [...api.touchesEntities].sort() // ← SORT entities
        }))
        .sort((a, b) => {
          // Sort by path, then by method
          const pathCompare = a.path.localeCompare(b.path);
          if (pathCompare !== 0) return pathCompare;
          return a.method.localeCompare(b.method);
        }) // ← DETERMINISTIC SORT
    };
  }

  /**
   * Normalize any JSON object recursively
   */
  static normalizeObject(obj: any): any {
    if (Array.isArray(obj)) {
      return obj.map(this.normalizeObject).sort(this.arraySort);
    }
    if (obj !== null && typeof obj === 'object') {
      return Object.keys(obj)
        .sort()
        .reduce((result, key) => {
          result[key] = this.normalizeObject(obj[key]);
          return result;
        }, {} as any);
    }
    return obj;
  }

  /**
   * Sort function for arrays (handles mixed types)
   */
  private static arraySort(a: any, b: any): number {
    // Handle different types
    if (typeof a !== typeof b) {
      return typeof a < typeof b ? -1 : 1;
    }

    if (typeof a === 'string') {
      return a.localeCompare(b);
    }
    if (typeof a === 'number') {
      return a - b;
    }
    if (typeof a === 'boolean') {
      return a === b ? 0 : (a ? 1 : -1);
    }

    // For objects/arrays, convert to string and compare
    return JSON.stringify(a).localeCompare(JSON.stringify(b));
  }
}

/**
 * Component 4: Deterministic Pipeline Orchestrator
 * Main entry point for deterministic execution
 */
export class DeterministicPipeline {
  private hash: SemanticHash;
  private naming: CanonicalNaming;

  constructor(
    private intent: IntentIR,
    private design: DesignIR,
    private manifest: AppManifest
  ) {
    this.hash = SemanticHasher.compute(intent, design);
    this.naming = CanonicalNamer.build(intent, manifest);
  }

  /**
   * Get semantic hash for this pipeline run
   */
  getSemanticHash(): SemanticHash {
    return this.hash;
  }

  /**
   * Get canonical naming system
   */
  getCanonicalNaming(): CanonicalNaming {
    return this.naming;
  }

  /**
   * Apply deterministic transformations to manifest
   */
  applyDeterministicTransforms(): AppManifest {
    let transformed = { ...this.manifest };

    // Apply canonical naming
    transformed = this.applyCanonicalNaming(transformed);

    // Normalize output
    transformed = OutputNormalizer.normalizeManifest(transformed);

    return transformed;
  }

  /**
   * Apply canonical naming to manifest
   */
  private applyCanonicalNaming(manifest: AppManifest): AppManifest {
    return {
      ...manifest,
      database: manifest.database.map(db => ({
        ...db,
        relations: (db.relations || []).map(rel => ({
          ...rel,
          name: this.naming.relationNames.get([db.name, rel.targetModel || ''].sort().join(':')) || rel.name
        }))
      }))
    };
  }

  /**
   * Verify determinism by comparing with another run
   */
  verifyDeterminism(other: DeterministicPipeline): boolean {
    const thisHash = this.getSemanticHash();
    const otherHash = other.getSemanticHash();

    return SemanticHasher.verifyDeterminism(thisHash, otherHash);
  }

  /**
   * Get determinism report
   */
  getDeterminismReport(): {
    hash: SemanticHash;
    naming: {
      entityCount: number;
      relationCount: number;
      roleCount: number;
      apiCount: number;
    };
    canonical: boolean; // Whether naming is canonical
  } {
    return {
      hash: this.hash,
      naming: {
        entityCount: this.naming.entityNames.size,
        relationCount: this.naming.relationNames.size,
        roleCount: this.naming.roleNames.length,
        apiCount: this.naming.apiPaths.length
      },
      canonical: this.isCanonical()
    };
  }

  /**
   * Check if current naming is canonical
   */
  private isCanonical(): boolean {
    // Check if entities are sorted
    const entityNames = Array.from(this.naming.entityNames.keys());
    const sortedEntities = [...entityNames].sort();
    if (JSON.stringify(entityNames) !== JSON.stringify(sortedEntities)) {
      return false;
    }

    // Check if roles are sorted
    const sortedRoles = [...this.naming.roleNames].sort();
    if (JSON.stringify(this.naming.roleNames) !== JSON.stringify(sortedRoles)) {
      return false;
    }

    // Check if API paths are sorted
    const sortedPaths = [...this.naming.apiPaths].sort();
    if (JSON.stringify(this.naming.apiPaths) !== JSON.stringify(sortedPaths)) {
      return false;
    }

    return true;
  }
}