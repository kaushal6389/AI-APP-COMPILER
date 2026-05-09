const buildRelationName = (from: string, target: string, rel: any, used: Map<string, string>) => {
  const baseParts = [from, target];
  if (rel.foreignKey) baseParts.push(rel.foreignKey);
  if (rel.side) baseParts.push(rel.side);
  const base = baseParts.join('_');
  const pairKey = [from, target].sort().join('<->');

  const existingOwner = used.get(base);
  if (!existingOwner) {
    used.set(base, pairKey);
    return base;
  }
  if (existingOwner === pairKey) return base;

  let idx = 2;
  let candidate = `${base}_${idx}`;
  while (used.has(candidate) && used.get(candidate) !== pairKey) {
    idx += 1;
    candidate = `${base}_${idx}`;
  }
  used.set(candidate, pairKey);
  return candidate;
};

export function inferPrismaRelations(manifest: any) {
  // Prototype: produce annotated relation hints for each model with collision-safe naming
  const hints: Record<string, any> = {};
  const models = (manifest?.database || []);
  const usedNames = new Map<string, string>();

  for (const m of models) {
    hints[m.name] = { relations: [] };
    for (const rel of (m.relations || [])) {
      const target = rel.target;
      const name = buildRelationName(m.name, target, rel, usedNames);
      const hint: any = { target, type: rel.type, name };
      if (rel.foreignKey) hint.foreignKey = rel.foreignKey;
      if (m.name === target) hint.self = true;
      hints[m.name].relations.push(hint);
    }
  }

  return hints;
}
