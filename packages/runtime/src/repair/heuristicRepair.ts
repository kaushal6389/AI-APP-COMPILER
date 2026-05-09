type ModelEntry = { fields: any[]; relations: any[] };

export type RepairLogEntry = {
  type: string;
  message: string;
};

const lowerFirst = (value: string) => value.charAt(0).toLowerCase() + value.slice(1);

export const applyHeuristicRepairs = (
  modelMap: Record<string, ModelEntry>,
  options: { aggressive?: boolean } = {}
) => {
  const repairLog: RepairLogEntry[] = [];
  const aggressive = Boolean(options.aggressive);

  for (const [modelName, entry] of Object.entries(modelMap)) {
    for (const rel of entry.relations) {
      if (rel.type && String(rel.type).includes('N:1')) {
        const targetName = String(rel.target || '');
        if (!targetName) continue;

        const defaultFk = `${lowerFirst(targetName)}Id`;
        if (!rel.foreignKey && aggressive) {
          rel.foreignKey = defaultFk;
          repairLog.push({
            type: 'add-foreign-key',
            message: `Added foreign key '${defaultFk}' on ${modelName} -> ${targetName}.`
          });
        }

        if (rel.foreignKey && !entry.fields.some((f) => f.name === rel.foreignKey)) {
          entry.fields.push({
            name: rel.foreignKey,
            type: 'String',
            isUnique: false,
            isOptional: true,
            isList: false
          });
          repairLog.push({
            type: 'inject-foreign-key-field',
            message: `Injected missing FK field '${rel.foreignKey}' on ${modelName}.`
          });
        }
      }

      if (modelName === rel.target && !rel.foreignKey) {
        const selfFk = `${lowerFirst(modelName)}Id`;
        rel.foreignKey = selfFk;
        if (!entry.fields.some((f) => f.name === selfFk)) {
          entry.fields.push({
            name: selfFk,
            type: 'String',
            isUnique: false,
            isOptional: true,
            isList: false
          });
        }
        repairLog.push({
          type: 'self-relation-fk',
          message: `Added self-relation FK '${selfFk}' on ${modelName}.`
        });
      }

      // Ensure reciprocal relation exists on the target model with matching relation name
      try {
        const targetName = String(rel.target || '');
        if (targetName && modelMap[targetName]) {
          const targetEntry = modelMap[targetName];
          const hasReciprocal = targetEntry.relations.some((r) => String(r.target) === modelName && (r.name || rel.name));
          if (!hasReciprocal) {
            // build reciprocal relation
            const reciprocalType = String(rel.type || '').startsWith('1:') ? 'N:1' : String(rel.type || '').startsWith('N:') ? '1:N' : rel.type || '1:N';
            const relationName = rel.name || `${modelName}_${targetName}_rel`;
            const reciprocal: any = {
              type: reciprocalType,
              target: modelName,
              side: reciprocalType === '1:N' ? 'one' : 'many',
              name: relationName
            };
            // do not set foreignKey on reciprocal if this side already declares it
            if (rel.foreignKey && rel.foreignKey.length > 0) {
              // reciprocal is inverse side; leave foreignKey undefined
            } else {
              // if no foreignKey present on this side, inject a default on reciprocal
              const fk = `${lowerFirst(modelName)}Id`;
              reciprocal.foreignKey = fk;
              // ensure target (which is modelMap[targetName]) has the fk field
              if (!targetEntry.fields.some((f) => f.name === fk)) {
                targetEntry.fields.push({ name: fk, type: 'String', isUnique: false, isOptional: true, isList: false });
                repairLog.push({ type: 'inject-foreign-key-field', message: `Injected missing FK field '${fk}' on ${targetName}.` });
              }
            }
            targetEntry.relations.push(reciprocal);
            repairLog.push({ type: 'add-reciprocal-relation', message: `Added reciprocal relation on ${targetName} -> ${modelName} named '${relationName}'.` });
          } else {
            // ensure names are in sync
            const rec = targetEntry.relations.find((r) => String(r.target) === modelName);
            if (rec && rel.name && rec.name !== rel.name) {
              rec.name = rel.name;
              repairLog.push({ type: 'sync-relation-name', message: `Synchronized relation name '${rel.name}' between ${modelName} and ${targetName}.` });
            }
          }
        }
      } catch (e) {}
    }
  }

  return repairLog;
};
