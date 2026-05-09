import type { AppManifest } from '@ai-compiler/schemas';

function inputTypeFromDbType(type: string) {
  switch (type) {
    case 'String': return 'text';
    case 'Int':
    case 'Float': return 'number';
    case 'Boolean': return 'checkbox';
    case 'DateTime': return 'datetime-local';
    case 'JSON': return 'json';
    default: return 'text';
  }
}

function labelize(name: string) {
  return name.replace(/([A-Z])/g, ' $1').replace(/^./, s => s.toUpperCase());
}

/**
 * Enhanced UI Schema Compiler (Phase 5) — richer forms, validations, dashboards
 */
export function compileUiSchema(manifest: AppManifest) {
  const forms = manifest.database.map((model) => ({
    model: model.name,
    formId: `${model.name.toLowerCase()}_form`,
    title: `${labelize(model.name)} Form`,
    description: `Create or update ${model.name}`,
    fields: model.fields.map(f => ({
      name: f.name,
      label: labelize(f.name),
      inputType: inputTypeFromDbType(f.type as string),
      required: !f.isOptional,
      placeholder: f.name === 'id' ? 'Auto-generated' : `Enter ${labelize(f.name)}`,
      relation: f.name.endsWith('Id') ? { target: f.name.replace(/Id$/, ''), type: 'select' } : undefined
    })),
    actions: ['create', 'update', 'delete']
  }));

  const listViews = manifest.database.map((model) => ({
    model: model.name,
    listId: `${model.name.toLowerCase()}_list`,
    title: `${labelize(model.name)} List`,
    columns: model.fields.filter(f => f.name !== 'id').map(f => ({ key: f.name, label: labelize(f.name) })),
    filters: model.fields.filter(f => f.type === 'String').slice(0,3).map(f => ({ key: f.name, type: 'text' }))
  }));

  // Dashboard: counts, recent items, basic numeric charts
  const dashboard = {
    widgets: manifest.database.slice(0, 6).map(m => ({
      type: 'count',
      title: `${m.name} Count`,
      model: m.name
    })).concat(
      manifest.database.slice(0, 3).map(m => ({
        type: 'recent',
        title: `Recent ${m.name}`,
        model: m.name,
        limit: 5
      }))
    ).concat(
      // numeric charts for first numeric-like fields
      manifest.database.slice(0,3).map(m => {
        const numField = m.fields.find(f => ['Int','Float'].includes(f.type as string));
        return numField ? { type: 'chart', chartType: 'bar', model: m.name, field: numField.name, title: `${m.name} ${labelize(numField.name)} Chart` } : null;
      }).filter(Boolean)
    )
  };

  return {
    generatedAt: new Date().toISOString(),
    forms,
    listViews,
    dashboard
  };
}
