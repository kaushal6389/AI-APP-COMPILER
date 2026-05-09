import { AppManifest } from '@ai-compiler/schemas';
import { permissionForRoute, RbacPolicy } from '../rbac/policy';

/**
 * Express/Fastify API Code Generator
 * Transpiles validated API AST routes into functional Express backend boilerplates.
 */
export class ExpressProcessor {
  public generateRoutesFile(manifest: any): string {
    let routesFile = `import express, { Request, Response } from 'express';\n`;
    routesFile += `import { PrismaClient } from '@prisma/client';\n`;
    routesFile += `import { requirePermission } from './rbac';\n`;
    routesFile += `import * as validators from './validators';\n\n`;
    routesFile += `const prisma = new PrismaClient();\n`;
    routesFile += `const api = express.Router();\n\n`;

    for (const route of manifest.api) {
      const modelName = route.touchesEntities[0];
      const modelClient = modelName[0].toLowerCase() + modelName.slice(1);
      const validatorName = `${modelName}Schema`;
      const permission = permissionForRoute(route);
      
      const method = route.method.toLowerCase();
      
      routesFile += `api.${method}('${route.path}', requirePermission('${permission}'), async (req: Request, res: Response) => {\n`;
      routesFile += `  // Purpose: ${route.purpose}\n`;
      routesFile += `  // RBAC Permission: ${permission}\n`;
      routesFile += `  // RBAC Roles Allowed: ${route.rolesAllowed.join(', ')}\n`;

      if (method === 'get') {
        routesFile += `  const data = await prisma.${modelClient}.findMany();\n`;
        routesFile += `  return res.json(data);\n`;
      } else if (method === 'post') {
        routesFile += `  const parsed = validators.${validatorName}.safeParse(req.body);\n`;
        routesFile += `  if (!parsed.success) {\n`;
        routesFile += `    return res.status(400).json({ error: 'Validation failed', issues: parsed.error.flatten() });\n`;
        routesFile += `  }\n`;
        routesFile += `  const created = await prisma.${modelClient}.create({ data: parsed.data });\n`;
        routesFile += `  return res.json(created);\n`;
      } else if (method === 'put' || method === 'patch') {
        routesFile += `  const parsed = validators.${validatorName}.safeParse(req.body);\n`;
        routesFile += `  if (!parsed.success) {\n`;
        routesFile += `    return res.status(400).json({ error: 'Validation failed', issues: parsed.error.flatten() });\n`;
        routesFile += `  }\n`;
        routesFile += `  const updated = await prisma.${modelClient}.update({ where: { id: req.params.id || parsed.data.id }, data: parsed.data });\n`;
        routesFile += `  return res.json(updated);\n`;
      } else if (method === 'delete') {
        routesFile += `  await prisma.${modelClient}.delete({ where: { id: req.params.id || req.body.id } });\n`;
        routesFile += `  return res.json({ success: true });\n`;
      } else {
        routesFile += `  return res.send("Not implemented.");\n`;
      }
      routesFile += `});\n\n`;
    }

    routesFile += `export default api;\n`;
    return routesFile;
  }

  public generateRbacFile(policy: RbacPolicy): string {
    // runtime middleware includes role inheritance and wildcard matching
    let rbacFile = `import { Request, Response, NextFunction } from 'express';\n\n`;
    rbacFile += `export const policy = ${JSON.stringify(policy, null, 2)} as const;\n\n`;

    rbacFile += `function buildRoleGraph(roles: readonly any[]) {\n`;
    rbacFile += `  const map: Record<string, Set<string>> = {};\n`;
    rbacFile += `  for (const r of roles || []) {\n`;
    rbacFile += `    map[r.name] = new Set((r.permissions || []).slice());\n`;
    rbacFile += `  }\n`;
    rbacFile += `  // propagate inheritance\n`;
    rbacFile += `  let changed = true;\n`;
    rbacFile += `  while (changed) {\n`;
    rbacFile += `    changed = false;\n`;
    rbacFile += `    for (const r of roles || []) {\n`;
    rbacFile += `      if (!r.inherits || !r.inherits.length) continue;\n`;
    rbacFile += `      for (const parent of r.inherits) {\n`;
    rbacFile += `        const parentPerms = map[parent] || new Set();\n`;
    rbacFile += `        for (const p of parentPerms) {\n`;
    rbacFile += `          if (!map[r.name].has(p)) { map[r.name].add(p); changed = true; }\n`;
    rbacFile += `        }\n`;
    rbacFile += `      }\n`;
    rbacFile += `    }\n`;
    rbacFile += `  }\n`;
    rbacFile += `  const out: Record<string, string[]> = {};\n`;
    rbacFile += `  for (const k of Object.keys(map)) out[k] = Array.from(map[k]);\n`;
    rbacFile += `  return out;\n`;
    rbacFile += `}\n\n`;

    rbacFile += `const rolePermissions: Record<string, string[]> = buildRoleGraph((policy.roles || []) as any);\n\n`;

    rbacFile += `function permissionMatches(need: string, have: string) {\n`;
    rbacFile += `  if (need === have) return true;\n`;
    rbacFile += `  // support resource:action and wildcard resource/* or */action\n`;
    rbacFile += `  const [rNeed, aNeed] = (need || '').split(':');\n`;
    rbacFile += `  const [rHave, aHave] = (have || '').split(':');\n`;
    rbacFile += `  if (!rNeed || !aNeed) return false;\n`;
    rbacFile += `  if (rHave === '*' || rHave === rNeed) {\n`;
    rbacFile += `    if (aHave === '*' || aHave === aNeed) return true;\n`;
    rbacFile += `  }\n`;
    rbacFile += `  return false;\n`;
    rbacFile += `}\n\n`;

    rbacFile += `export const requirePermission = (permission: string) => (req: Request, res: Response, next: NextFunction) => {\n`;
    rbacFile += `  const roleHeader = (req.headers && req.headers['x-role']) || (req.get && req.get('x-role'));\n`;
    rbacFile += `  const role = typeof roleHeader === 'string' ? roleHeader : undefined;\n`;
    rbacFile += `  if (!role) {\n`;
    rbacFile += `    return res.status(401).json({ error: 'Unauthenticated', message: 'Missing x-role header' });\n`;
    rbacFile += `  }\n`;
    rbacFile += `  const perms = rolePermissions[role] || [];\n`;
    rbacFile += `  for (const p of perms) {\n`;
    rbacFile += `    if (permissionMatches(permission, p)) return next();\n`;
    rbacFile += `  }\n`;
    rbacFile += `  return res.status(403).json({ error: 'Forbidden', message: \`Required permission: \${permission}\` });\n`;
    rbacFile += `};\n`;
    return rbacFile;
  }

  public generateServerFile(): string {
    let serverFile = `import express from 'express';\n`;
    serverFile += `import api from './routes';\n\n`;
    serverFile += `export const app = express();\n`;
    serverFile += `app.use(express.json());\n`;
    serverFile += `app.get('/health', (_req, res) => res.json({ ok: true }));\n`;
    serverFile += `app.use(api);\n\n`;
    serverFile += `export const start = () => {\n`;
    serverFile += `  const port = Number(process.env.PORT || 3000);\n`;
    serverFile += `  return app.listen(port, () => {\n`;
    serverFile += `    console.log(\`Server listening on :\${port}\`);\n`;
    serverFile += `  });\n`;
    serverFile += `};\n\n`;
    serverFile += `if (require.main === module) {\n`;
    serverFile += `  start();\n`;
    serverFile += `}\n`;
    return serverFile;
  }

  public generateValidatorsFile(manifest: any): string {
    let validatorsFile = `import { z } from 'zod';\n\n`;

    for (const model of manifest.database) {
      const schemaName = `${model.name}Schema`;
      const fields = model.fields
        .map((field: any) => `  ${field.name}: ${this.zodForField(field)}`)
        .join(',\n');
      validatorsFile += `export const ${schemaName} = z.object({\n${fields}\n});\n\n`;
    }

    return validatorsFile;
  }

  private zodForField(field: any): string {
    let base = 'z.any()';
    if (field.type === 'String') base = 'z.string()';
    if (field.type === 'Int') base = 'z.number().int()';
    if (field.type === 'Float') base = 'z.number()';
    if (field.type === 'Boolean') base = 'z.boolean()';
    if (field.type === 'DateTime') base = 'z.string().datetime()';
    
    if (field.isList) base += '.array()';
    if (field.isOptional) base += '.optional()';
    return base;
  }
}
