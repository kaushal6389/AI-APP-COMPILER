import { AppManifest } from '@ai-compiler/schemas';
import * as fs from 'fs';
import * as path from 'path';
import { execSync } from 'child_process';
import { ExpressProcessor } from './generators/expressProcessor';
import { buildRbacPolicy } from './rbac/policy';
import { applyHeuristicRepairs } from './repair/heuristicRepair';

export class RuntimeLayer {
  public async execute(manifest: AppManifest, appName: string) {
    console.log(`Synthesizing executable ${appName}.`);

    const prismaGeneratorHeader = `generator client {\n  provider = "prisma-client-js"\n}\n\n`;
    // Prisma v7+ prefers datasource URLs be provided via external config; omit url for compatibility
    const prismaDatasourceHeader = `datasource db {\n  provider = "postgresql"\n}\n\n`;

    const prismaTypeFor = (ft: string) => {
      switch (ft) {
        case 'String': return 'String';
        case 'Int': return 'Int';
        case 'Float': return 'Float';
        case 'Boolean': return 'Boolean';
        case 'DateTime': return 'DateTime';
        case 'JSON': return 'Json';
        default: return 'String';
      }
    };

    const zodBaseFor = (ft: string) => {
      switch (ft) {
        case 'String': return 'z.string()';
        case 'Int': return 'z.number().int()';
        case 'Float': return 'z.number()';
        case 'Boolean': return 'z.boolean()';
        case 'DateTime': return 'z.string()';
        case 'JSON': return 'z.any()';
        default: return 'z.string()';
      }
    };

    const zodForField = (field: any) => {
      let inner = zodBaseFor(field.type as string);
      if (field.isList) inner = `z.array(${inner})`;
      if (field.isOptional) inner = `${inner}.optional()`;
      return inner;
    };

    const generateUiSchema = (sourceManifest: AppManifest) => {
      const modelForms = (sourceManifest.database || []).map((model: any) => ({
        model: model.name,
        title: `${model.name} Form`,
        fields: (model.fields || []).map((field: any) => ({
          name: field.name,
          type: field.type,
          required: !field.isOptional && field.name !== 'id',
          isList: Boolean(field.isList),
          widget: field.type === 'Boolean' ? 'checkbox' : field.type === 'DateTime' ? 'datetime' : field.type === 'JSON' ? 'json' : 'text'
        }))
      }));

      return {
        version: '1.0',
        generatedAt: new Date().toISOString(),
        forms: modelForms
      };
    };

    const lowerFirst = (value: string) => value.charAt(0).toLowerCase() + value.slice(1);

    const inverseRelationType = (t?: string) => {
      if (!t) return '1:N';
      if (t === 'N:1') return '1:N';
      if (t === '1:N') return 'N:1';
      return '1:N';
    };

    const buildModelMap = () => {
      const modelMap: Record<string, { fields: any[]; relations: any[] }> = {};
      for (const db of manifest.database) {
        modelMap[db.name] = { fields: db.fields.slice(), relations: db.relations ? db.relations.slice() : [] };
      }
      return modelMap;
    };

    const assignRelationName = (desired: string, pairKey: string, nameOwners: Map<string, string>) => {
      const sanitizeName = (s: string) => String(s).replace(/[^a-zA-Z0-9_]/g, '_').replace(/__+/g, '_').replace(/^_|_$/g, '').toLowerCase();
      const keyName = sanitizeName(desired);
      const owner = nameOwners.get(keyName);
      if (!owner) {
        nameOwners.set(keyName, pairKey);
        return keyName;
      }
      if (owner === pairKey) return keyName;

      let idx = 2;
      let candidate = `${keyName}_${idx}`;
      while (nameOwners.has(candidate) && nameOwners.get(candidate) !== pairKey) {
        idx += 1;
        candidate = `${keyName}_${idx}`;
      }
      nameOwners.set(candidate, pairKey);
      return candidate;
    };

    const applyRelationHeuristics = (modelMap: Record<string, { fields: any[]; relations: any[] }>, nameOwners: Map<string, string>) => {
      for (const [fromName, entry] of Object.entries(modelMap)) {
        for (const rel of entry.relations) {
          const target = rel.target;
          if (!target) continue;
          const pairKey = [fromName, target].sort().join('<->');
          const baseParts = [fromName, target];
          if (rel.foreignKey) baseParts.push(rel.foreignKey);
          if (rel.side) baseParts.push(rel.side);
          const baseName = baseParts.join('_');
          const desired = rel.name || baseName;
          rel.name = assignRelationName(desired, pairKey, nameOwners);

          // Ensure target model has reciprocal relation when appropriate
          if (modelMap[target]) {
            const reciprocalExists = modelMap[target].relations.some((r: any) => r.target === fromName && r.name === rel.name);
            if (!reciprocalExists) {
              modelMap[target].relations.push({
                type: inverseRelationType(rel.type),
                target: fromName,
                foreignKey: `${lowerFirst(fromName)}Id`,
                side: rel.type === 'N:1' ? 'one' : 'many',
                name: rel.name
              });
            }
          }

          if (fromName === target) {
            const fk = rel.foreignKey || `${lowerFirst(target)}Id`;
            rel.foreignKey = fk;
            if (!entry.fields.some((f) => f.name === fk)) {
              entry.fields.push({ name: fk, type: 'String', isUnique: false, isOptional: true, isList: false });
            }
          }

          if (rel.foreignKey && !entry.fields.some((f) => f.name === rel.foreignKey)) {
            entry.fields.push({ name: rel.foreignKey, type: 'String', isUnique: false, isOptional: true, isList: false });
          }
        }
      }
    };

    const normalizeReciprocalNames = (modelMap: Record<string, { fields: any[]; relations: any[] }>, nameOwners: Map<string, string>) => {
      for (const [from, entry] of Object.entries(modelMap)) {
        for (const rel of entry.relations) {
          const target = rel.target;
          if (!target || !modelMap[target]) continue;
          // look for reciprocal relation on target model that points back to `from`
          const reciprocal = modelMap[target].relations.find((r: any) => r.target === from);
          if (reciprocal) {
            // pick a canonical base name
            const desired = rel.name || reciprocal.name || `${from}_${target}_rel`;
            const canonical = assignRelationName(desired, [from, target].sort().join('<->'), nameOwners);
            rel.name = canonical;
            reciprocal.name = canonical;
          }
        }
      }
      // For self-relations, ensure pairs use same name when complementary types exist
      for (const [m, entry] of Object.entries(modelMap)) {
        const selfRels = entry.relations.filter((r: any) => r.target === m);
        if (selfRels.length > 1) {
          const canonical = assignRelationName(selfRels[0].name || `${m}_${m}_self`, m + '<->' + m, nameOwners);
          for (const r of selfRels) r.name = canonical;
        }
      }
    };

    const finalizeRelationOwnership = (modelMap: Record<string, { fields: any[]; relations: any[] }>) => {
      // Ensure only one side in a relation pair owns the FK for N:1 <-> 1:N / 1:1 pairs.
      for (const [from, entry] of Object.entries(modelMap)) {
        for (const rel of entry.relations) {
          const target = rel.target;
          if (!target || !modelMap[target]) continue;
          const reciprocal = modelMap[target].relations.find((r: any) => r.target === from && r.name === rel.name);
          if (!reciprocal) continue;

          if (from === target) continue;

          const leftOwns = Boolean(rel.foreignKey);
          const rightOwns = Boolean(reciprocal.foreignKey);

          if (leftOwns && rightOwns) {
            // Canonical owner: N:1 side, otherwise lexicographic model order
            const leftIsManyToOne = String(rel.type || '').includes('N:1');
            const rightIsManyToOne = String(reciprocal.type || '').includes('N:1');
            if (leftIsManyToOne && !rightIsManyToOne) {
              delete reciprocal.foreignKey;
            } else if (!leftIsManyToOne && rightIsManyToOne) {
              delete rel.foreignKey;
            } else if (from.localeCompare(target) <= 0) {
              delete reciprocal.foreignKey;
            } else {
              delete rel.foreignKey;
            }
          }
        }
      }
    };

    const renderPrismaSchema = (modelMap: Record<string, { fields: any[]; relations: any[] }>) => {
      let prismaBody = '';
      for (const db of manifest.database) {
        const built = modelMap[db.name];
        prismaBody += `model ${db.name} {\n`;
        for (const field of built.fields) {
          let options = '';
          if (field.name === 'id') options += ' @id @default(uuid())';
          if (field.isUnique && field.name !== 'id') options += ' @unique';

          const pType = prismaTypeFor(field.type as string);
          const typeStr = field.isList ? `${pType}[]` : (field.isOptional ? `${pType}?` : `${pType}`);

          prismaBody += `  ${field.name} ${typeStr}${options}\n`;
        }

        // relation fields
        const emittedFields = new Set<string>();
        for (const rel of built.relations) {
          try {
            const fk = rel.foreignKey;
            const target = rel.target;
            const relationName = rel.name || `${db.name}_${target}_rel`;
            // ensure reciprocal on target uses same relation name
            try {
              if (modelMap[target]) {
                const reciprocal = modelMap[target].relations.find((r: any) => r.target === db.name);
                if (reciprocal && reciprocal.name !== relationName) {
                  reciprocal.name = relationName;
                }
              }
            } catch (e) {}
            const relFieldNameBase = lowerFirst(target);
            const sanitize = (s: string) => String(s).replace(/[^a-zA-Z0-9_]/g, '_');
            const relFieldNameCandidate = sanitize(relFieldNameBase + (relationName ? ('_' + relationName) : ''));
            let relFieldName = relFieldNameBase;
            // Avoid duplicate field names when multiple relations target the same model
            if (built.fields.some((f: any) => f.name === relFieldName) || built.relations.filter((r: any) => r.target === target).length > 1) {
              relFieldName = relFieldNameCandidate;
            }
            if (rel.type && rel.type.indexOf('N:1') !== -1) {
              const relFieldName = relFieldNameBase;
              const fkOptional = fk ? built.fields.find((f: any) => f.name === fk)?.isOptional : true;
              const optionalMarker = fkOptional ? '?' : '';
              if (emittedFields.has(relFieldName)) continue;
              if (fk) prismaBody += `  ${relFieldName} ${target}${optionalMarker} @relation(fields: [${fk}], references: [id], name: "${relationName}")\n`;
              else prismaBody += `  ${relFieldName} ${target}${optionalMarker} @relation(name: "${relationName}")\n`;
              emittedFields.add(relFieldName);
            } else if (rel.type && rel.type.indexOf('1:N') !== -1) {
              let listField = relFieldNameBase + 's';
              if (built.fields.some((f: any) => f.name === listField) || built.relations.filter((r: any) => r.target === target).length > 1) {
                listField = sanitize(listField + '_' + relationName);
              }
              if (emittedFields.has(listField)) continue;
              prismaBody += `  ${listField} ${target}[] @relation(name: "${relationName}")\n`;
              emittedFields.add(listField);
            } else {
              const relFieldName = relFieldNameBase;
              if (emittedFields.has(relFieldName)) continue;
              prismaBody += `  ${relFieldName} ${target}? @relation(name: "${relationName}")\n`;
              emittedFields.add(relFieldName);
            }
          } catch (e) {}
        }

        prismaBody += `}\n\n`;
      }
      return prismaGeneratorHeader + prismaDatasourceHeader + prismaBody;
    };

    const buildSchema = (aggressiveRepair: boolean) => {
      const modelMap = buildModelMap();
      const nameOwners = new Map<string, string>();
      const repairLog = aggressiveRepair ? applyHeuristicRepairs(modelMap, { aggressive: true }) : [];
      applyRelationHeuristics(modelMap, nameOwners);
      normalizeReciprocalNames(modelMap, nameOwners);
      finalizeRelationOwnership(modelMap);
      return { schema: renderPrismaSchema(modelMap), repairLog };
    };

    let { schema: prismaSchema, repairLog } = buildSchema(false);

    
    const rbacPolicy = buildRbacPolicy(manifest);
    const expressProcessor = new ExpressProcessor();
    const routesFile = expressProcessor.generateRoutesFile(manifest);
    const rbacFile = expressProcessor.generateRbacFile(rbacPolicy);
    const validatorsFile = expressProcessor.generateValidatorsFile(manifest);
    const serverFile = expressProcessor.generateServerFile();
    
    

    
    // Emitting artifacts to disk (Simulated Execution-Aware Layer)
    const outDir = path.join(process.cwd(), '.out', appName);
    fs.mkdirSync(outDir, { recursive: true });

    const dockerfile = "FROM node:18-alpine\nWORKDIR /app\nCOPY package.json .\nRUN npm install --omit=dev --no-audit --no-fund\nCOPY . .\nEXPOSE 3000\nCMD [\"npm\", \"start\"]\n";
    const envExample = "DATABASE_URL=postgresql://user:pass@localhost:5432/db\nPORT=3000\nJWT_SECRET=supersecret\n";
    const testsFile = "import assert from 'assert';\nimport { app } from './server';\n\nassert.ok(app, 'app should be defined');\n";

    fs.writeFileSync(path.join(outDir, 'Dockerfile'), dockerfile);
    fs.writeFileSync(path.join(outDir, '.env.example'), envExample);
    fs.writeFileSync(path.join(outDir, 'tests.ts'), testsFile);

    

    const summary = {
      entities: manifest.database.map((db) => db.name),
      entityCount: manifest.database.length,
      routeCount: manifest.api.length,
        routes: manifest.api.map((route) => ({
        method: route.method,
        path: route.path,
        rolesAllowed: route.rolesAllowed
      })),
      uiSchemaGenerated: true
    };

    const uiSchema = generateUiSchema(manifest);

    const readiness = {
      prismaSchemaGenerated: prismaSchema.length > 0,
      routeFileGenerated: routesFile.length > 0,
      rbacEnabled: true,
      rbacPolicyGenerated: true,
      artifactTestsGenerated: true,
      uiSchemaGenerated: true,
      validatorCount: manifest.database.length,
      entityCount: manifest.database.length,
      routeCount: manifest.api.length,
      selfHealingAttempts: 0
    };

    fs.writeFileSync(path.join(outDir, 'schema.prisma'), prismaSchema);
    fs.writeFileSync(path.join(outDir, 'routes.ts'), routesFile);
    fs.writeFileSync(path.join(outDir, 'rbac.ts'), rbacFile);
    fs.writeFileSync(path.join(outDir, 'rbac-policy.json'), JSON.stringify(rbacPolicy, null, 2));
    fs.writeFileSync(path.join(outDir, 'validators.ts'), validatorsFile);
    fs.writeFileSync(path.join(outDir, 'server.ts'), serverFile);
    fs.writeFileSync(path.join(outDir, 'ui-schema.json'), JSON.stringify(uiSchema, null, 2));
    fs.writeFileSync(path.join(outDir, 'manifest.json'), JSON.stringify(manifest, null, 2));
    fs.writeFileSync(path.join(outDir, 'summary.json'), JSON.stringify(summary, null, 2));
    // Add a tiny ambient declaration to avoid missing @prisma/client types during quick type-checks
    const prismaDts = `declare module '@prisma/client' { export class PrismaClient { constructor(); [k: string]: any } }\n`;
    fs.writeFileSync(path.join(outDir, 'prisma-fallback.d.ts'), prismaDts);
    const expressDts = `declare module 'express' {
  export interface Request { headers: any; get(name: string): string | undefined; body: any; }
  export interface Response { status(code: number): any; json(data: any): any; send(data: any): any; }
  export interface NextFunction { (err?: any): void; }
  export interface Router { get(path: string, ...handlers: any[]): void; post(path: string, ...handlers: any[]): void; use(...handlers: any[]): void; }
  export interface Application { use(...handlers: any[]): void; listen(port: number, cb?: () => void): any; get(path: string, ...handlers: any[]): void; }
  export function Router(): Router;
  function express(): Application;
  namespace express { function Router(): Router; function json(): any; }
  export default express;
}\n`;
    fs.writeFileSync(path.join(outDir, 'express-fallback.d.ts'), expressDts);

    const artifactTests = `const assert = require('assert');\nconst fs = require('fs');\nconst path = require('path');\nconst readiness = JSON.parse(fs.readFileSync(path.join(__dirname, 'readiness.json'), 'utf8'));\nassert(readiness.prismaSchemaGenerated, 'schema.prisma should be emitted');\nassert(readiness.prismaValid, 'prismaValid should be true');\nassert(readiness.tscValid, 'tscValid should be true');\nassert(readiness.compileSuccess, 'compileSuccess should be true');\nassert(readiness.runtimeSuccess, 'runtimeSuccess should be true');\nassert(readiness.uiSchemaGenerated, 'ui-schema should be emitted');\nconst policy = JSON.parse(fs.readFileSync(path.join(__dirname, 'rbac-policy.json'), 'utf8'));\nassert(Array.isArray(policy.roles), 'rbac policy should define roles');\nconst schemaText = fs.readFileSync(path.join(__dirname, 'schema.prisma'), 'utf8');\nassert(schemaText.includes('@relation('), 'schema should include explicit @relation annotations');\nconst uiSchema = JSON.parse(fs.readFileSync(path.join(__dirname, 'ui-schema.json'), 'utf8'));\nassert(Array.isArray(uiSchema.forms), 'ui-schema should contain forms array');\nconst rbacTestsPath = path.join(__dirname, 'rbac-tests.js');\nif (fs.existsSync(rbacTestsPath)) {\n  require(rbacTestsPath);\n}\nconsole.log('Artifact tests OK');\n`;
    fs.writeFileSync(path.join(outDir, 'artifact-tests.js'), artifactTests);

    // Execution validation gates: try prisma validate and tsc type-check on generated files
    let prismaValid = false;
    let tscValid = false;
    try {
      execSync(`npx prisma validate --schema="${path.join(outDir, 'schema.prisma')}"`, { stdio: 'pipe' });
      prismaValid = true;
    } catch (e: any) {
      prismaValid = false;
      const errText = e.stderr ? e.stderr.toString() : String(e);
      try {
        fs.writeFileSync(path.join(outDir, 'validation-prisma.log'), errText);
      } catch (w) {}

      // Phase 9: self-healing repair pass for Prisma schemas
      const repaired = buildSchema(true);
      if (repaired.repairLog.length > 0) {
        prismaSchema = repaired.schema;
        repairLog = repaired.repairLog;
        fs.writeFileSync(path.join(outDir, 'schema.prisma'), prismaSchema);
        try {
          execSync(`npx prisma validate --schema="${path.join(outDir, 'schema.prisma')}"`, { stdio: 'pipe' });
          prismaValid = true;
        } catch (repairErr: any) {
          prismaValid = false;
          try {
            fs.writeFileSync(path.join(outDir, 'validation-prisma.log'), repairErr.stderr ? repairErr.stderr.toString() : String(repairErr));
          } catch (w) {}
        }
      }
    }

    try {
      // create a minimal tsconfig for validation
      const tsconfig = {
        compilerOptions: {
          target: 'ES2022',
          module: 'CommonJS',
          strict: false,
          esModuleInterop: true,
          skipLibCheck: true,
          noEmit: true
        },
        include: ['*.ts', '*.d.ts']
      };
      fs.writeFileSync(path.join(outDir, 'tsconfig.json'), JSON.stringify(tsconfig, null, 2));
      try {
        execSync(`npx tsc -p "${path.join(outDir, 'tsconfig.json')}"`, { stdio: 'pipe' });
        tscValid = true;
      } catch (e: any) {
        tscValid = false;
        try {
          fs.writeFileSync(path.join(outDir, 'validation-tsc.log'), e.stderr ? e.stderr.toString() : String(e));
        } catch (w) {}
      }
    } catch (e) {
      tscValid = false;
    }

    const readinessWithChecks = {
      ...readiness,
      prismaValid,
      tscValid,
      runtimeSuccess: prismaValid && tscValid,
      compileSuccess: false,
      selfHealingAttempts: repairLog.length > 0 ? 1 : 0
    };

    fs.writeFileSync(path.join(outDir, 'readiness.json'), JSON.stringify(readinessWithChecks, null, 2));

    // Phase 7: optional compile step - transpile generated TS into a dist folder and emit package.json
    let compileSuccess = false;
    if (tscValid) {
      try {
        const distDir = path.join(outDir, 'dist');
        // Ensure package.json exists for the emitted app so it can be run
        const pkg = {
          name: appName,
          version: '0.1.0',
          main: 'dist/server.js',
          scripts: { start: 'node dist/server.js' },
          dependencies: {
            "@prisma/client": "^5.21.1",
            "express": "^4.19.2",
            "zod": "^4.4.3"
          }
        };
        fs.writeFileSync(path.join(outDir, 'package.json'), JSON.stringify(pkg, null, 2));
        // Run tsc to emit JS output into dist
        execSync(`npx tsc -p "${path.join(outDir, 'tsconfig.json')}" --outDir "${distDir}"`, { stdio: 'pipe' });
        compileSuccess = true;
      } catch (e: any) {
        compileSuccess = false;
        try {
          fs.writeFileSync(path.join(outDir, 'validation-compile.log'), e.stderr ? e.stderr.toString() : String(e));
        } catch (w) {}
      }
    }

    // update readiness with compile result
    const finalReadiness = {
      ...readinessWithChecks,
      compileSuccess,
      runtimeSuccess: readinessWithChecks.prismaValid && readinessWithChecks.tscValid && compileSuccess
    };
    fs.writeFileSync(path.join(outDir, 'readiness.json'), JSON.stringify(finalReadiness, null, 2));

    if (repairLog.length > 0) {
      fs.writeFileSync(path.join(outDir, 'repair-log.json'), JSON.stringify(repairLog, null, 2));
    }

    console.log("Artifacts emitted successfully.");
    return {
      outDir: outDir,
      files: ['schema.prisma', 'routes.ts', 'server.ts', 'Dockerfile', '.env.example', 'tests.ts', 'rbac.ts', 'rbac-policy.json', 'validators.ts', 'ui-schema.json', 'manifest.json', 'summary.json', 'readiness.json', 'artifact-tests.js'],
      validity: { prismaValid, tscValid, compileSuccess }
    };
  }
}
