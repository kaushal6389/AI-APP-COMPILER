import { AppManifest } from '@ai-compiler/schemas';

/**
 * Stage 6: Database Generator
 * Transpiles the validated JSON AST into a raw Prisma Schema file.
 * Since the JSON is mathematically guaranteed to be correct via the ValidationEngine,
 * this transpiler is 100% deterministic code generation without LLM hallucination risk.
 */
export class DatabaseGenerator {
  public generatePrismaSchema(manifest: AppManifest): string {
    console.log(`[Stage 6] Code Gen: Transpiling JSON AST into Prisma Schema.`);
    let prismaSchema = `generator client {\n  provider = "prisma-client-js"\n}\n\ndatasource db {\n  provider = "postgresql"\n  url      = env("DATABASE_URL")\n}\n\n`;

    manifest.database.forEach((model) => {
      prismaSchema += `model ${model.name} {\n`;
      
      // Map basic fields
      model.fields.forEach(field => {
        let fieldDef = `  ${field.name} ${field.type}`;
        if (field.name === 'id') fieldDef += ` @id @default(uuid())`;
        else if (field.isUnique) fieldDef += ` @unique`;
        
        if (field.isOptional) fieldDef += `?`;
        
        prismaSchema += fieldDef + `\n`;
      });

      // Map Relations (supporting types from SchemaGenerationStage: '1:N', 'N:1', '1:1')
      if (model.relations && model.relations.length > 0) {
        prismaSchema += `\n  // Relations\n`;
        // track base names to avoid collisions (append numeric suffix when necessary)
        const seen: Record<string, number> = {};
        model.relations.forEach(rel => {
          const fkField = model.fields.find((f: any) => f.name === rel.foreignKey);
          const optionalMarker = fkField && fkField.isOptional ? '?' : '';

          // human-friendly base name; symmetric for 1:1, directional for 1:N
          let baseName: string;
          if (rel.type === '1:1') {
            baseName = [model.name, rel.target].slice().sort().join('_');
          } else {
            if (rel.side === 'one') {
              baseName = `${model.name}_${rel.target.toLowerCase()}s`;
            } else {
              baseName = `${rel.target}_${model.name.toLowerCase()}s`;
            }
          }

          const count = (seen[baseName] || 0) + 1;
          seen[baseName] = count;
          const relationName = count === 1 ? baseName : `${baseName}_${count}`;

          if (rel.type === 'N:1') {
            prismaSchema += `  ${rel.target.toLowerCase()} ${rel.target}${optionalMarker} @relation(name: "${relationName}", fields: [${rel.foreignKey}], references: [id])\n`;
          } else if (rel.type === '1:N') {
            prismaSchema += `  ${rel.target.toLowerCase()}s ${rel.target}[] @relation(name: "${relationName}")\n`;
          } else if (rel.type === '1:1') {
            prismaSchema += `  ${rel.target.toLowerCase()} ${rel.target}${optionalMarker} @relation(name: "${relationName}", fields: [${rel.foreignKey}], references: [id])\n`;
          }
        });
      }

      prismaSchema += `}\n\n`;
    });

    console.log(`[Stage 6] Code Gen: Prisma Schema Built Successfully.`);
    return prismaSchema;
  }
}
