import { IntentIR, AppManifest, DesignIR } from '@ai-compiler/schemas';
import { CONTRACT, pluralize } from '../config/contract';

export class SchemaGenerationStage {
  public async execute(intent: IntentIR, design: DesignIR): Promise<AppManifest> {
    console.log("Generating DAG Schema enforcing Domain Integrity...");
    type FieldType = 'String' | 'Int' | 'Float' | 'Boolean' | 'DateTime' | 'JSON';
    const db: Array<{ name: string; fields: Array<{ name: string; type: FieldType; isUnique: boolean; isOptional: boolean; isList: boolean }>; relations: any[] }> = [];
    const api: Array<any> = [];

    // Transform guaranteed requiredEntities to deterministic DB layout
    for (const entity of intent.requiredEntities) {
      const eName = entity.name.trim();
      const collectionName = pluralize(eName);
      const basePath = `${CONTRACT.apiBasePath}/${collectionName}`;
      // Synthesize database representation from intentions
      const fields: Array<{ name: string; type: FieldType; isUnique: boolean; isOptional: boolean; isList: boolean }> = [
        {
          name: CONTRACT.idFieldName,
          type: CONTRACT.idFieldType,
          isUnique: CONTRACT.idFieldUnique,
          isOptional: CONTRACT.idFieldOptional,
          isList: CONTRACT.idFieldList
        }
      ];

      // Expand suggested fields
      for (const reqField of entity.suggestedFields) {
        fields.push({
          name: reqField,
          type: CONTRACT.defaultFieldType,
          isUnique: CONTRACT.defaultFieldUnique,
          isOptional: CONTRACT.defaultFieldOptional,
          isList: CONTRACT.defaultFieldList
        });
      }

      fields.sort((a, b) => {
        if (a.name === 'id') return -1;
        if (b.name === 'id') return 1;
        return a.name.localeCompare(b.name);
      });

      db.push({
        name: eName,
        fields: fields,
        relations: []
      });

      // Tie this back into the deterministic API route
      const owningModule = Object.entries(design.serviceBoundaries).find(([, entities]) => entities.includes(eName))?.[0] ?? 'DomainDataModule';
      api.push({
        method: 'GET',
        path: basePath,
        purpose: `Retrieve all ${eName}s from ${owningModule}`,
        authRequired: true,
        rolesAllowed: intent.primaryRoles.map((r) => r.name),
        touchesEntities: [eName]
      });
      
      api.push({
        method: 'POST',
        path: basePath,
        purpose: `Create new ${eName} through ${owningModule}`,
        authRequired: true,
        rolesAllowed: [intent.primaryRoles[0].name],
        touchesEntities: [eName]
      });
    }

    // Populate relation metadata from design IR
    inferRelations(db, design);
    db.sort((a, b) => a.name.localeCompare(b.name));
    api.sort((a, b) => {
      if (a.path === b.path) {
        return a.method.localeCompare(b.method);
      }
      return a.path.localeCompare(b.path);
    });

    return {
      database: db,
      api: api
    };
  }
}

// Relationship inference: populate relations based on design IR if available
// Note: performed as a post-processing step so that generated manifests include relation metadata
// This keeps the stage deterministic while enabling richer downstream codegen.
function inferRelations(db: Array<any>, design?: DesignIR) {
  if (!design || !design.entityRelationships) return;
  for (const rel of design.entityRelationships) {
    const from = rel.from;
    const to = rel.to;
    const type = rel.relationType || '1:N';
    const fromModel = db.find((d) => d.name === from);
    const toModel = db.find((d) => d.name === to);
    if (!fromModel || !toModel) continue;

    const fromLower = from.charAt(0).toLowerCase() + from.slice(1);
    const toLower = to.charAt(0).toLowerCase() + to.slice(1);

    if (type === '1:N') {
      // one-to-many: add foreign key on 'to' pointing to 'from'
      const fk = `${fromLower}Id`;
      if (!toModel.fields.some((f) => f.name === fk)) {
        toModel.fields.push({ name: fk, type: 'String', isUnique: false, isOptional: true, isList: false });
      }
      fromModel.relations.push({ type: '1:N', target: to, side: 'one' });
      toModel.relations.push({ type: 'N:1', target: from, foreignKey: fk, side: 'many' });
    } else if (type === 'N:1') {
      // many-to-one: add foreign key on 'from' pointing to 'to'
      const fk = `${toLower}Id`;
      if (!fromModel.fields.some((f) => f.name === fk)) {
        fromModel.fields.push({ name: fk, type: 'String', isUnique: false, isOptional: true, isList: false });
      }
      fromModel.relations.push({ type: 'N:1', target: to, foreignKey: fk, side: 'many' });
      toModel.relations.push({ type: '1:N', target: from, side: 'one' });
    } else if (type === '1:1') {
      const fk = `${toLower}Id`;
      if (!fromModel.fields.some((f) => f.name === fk)) {
        fromModel.fields.push({ name: fk, type: 'String', isUnique: true, isOptional: true, isList: false });
      }
      fromModel.relations.push({ type: '1:1', target: to, foreignKey: fk, side: 'one' });
      toModel.relations.push({ type: '1:1', target: from, foreignKey: fk, side: 'one' });
    }
    // keep fields sorted with id first
    for (const m of [fromModel, toModel]) {
      m.fields.sort((a: any, b: any) => {
        if (a.name === 'id') return -1;
        if (b.name === 'id') return 1;
        return a.name.localeCompare(b.name);
      });
    }
  }
}

