export const CONTRACT = {
  idFieldName: 'id',
  idFieldType: 'String',
  idFieldUnique: true,
  idFieldOptional: false,
  idFieldList: false,
  defaultFieldType: 'String',
  defaultFieldOptional: false,
  defaultFieldUnique: false,
  defaultFieldList: false,
  apiBasePath: '/api'
} as const;

export const pluralize = (name: string) => {
  const lowered = name.toLowerCase();
  if (lowered.endsWith('y') && lowered.length > 1) {
    return `${lowered.slice(0, -1)}ies`;
  }
  if (lowered.endsWith('s')) {
    return `${lowered}es`;
  }
  return `${lowered}s`;
};
