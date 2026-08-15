
function typeOf(v) {
  if (v === null) return 'null';
  if (Array.isArray(v)) return 'array';
  return typeof v;
}

function validateNode(schema, value, path = '$') {
  const errors = [];
  if (!schema) return errors;
  if (value === undefined || value === null) {
    return errors;
  }
  const t = schema.type;
  const actualT = typeOf(value);
  if (t && actualT !== t) {
    errors.push(`${path}: expected ${t}, got ${actualT}`);
    return errors;
  }
  if (schema.enum && !schema.enum.includes(value)) {
    errors.push(`${path}: must be one of ${schema.enum.join('|')}, got ${JSON.stringify(value)}`);
  }
  if (t === 'object' && schema.properties) {
    const req = schema.required || [];
    for (const k of req) {
      if (value[k] === undefined || value[k] === null) {
        errors.push(`${path}.${k}: required`);
      }
    }
    for (const [k, subSchema] of Object.entries(schema.properties)) {
      if (value[k] !== undefined) {
        errors.push(...validateNode(subSchema, value[k], `${path}.${k}`));
      }
    }
  }
  if (t === 'array' && schema.items) {
    if (schema.minItems !== undefined && value.length < schema.minItems) {
      errors.push(`${path}: minItems ${schema.minItems}`);
    }
    value.forEach((item, i) => {
      errors.push(...validateNode(schema.items, item, `${path}[${i}]`));
    });
  }
  return errors;
}

function applyDefaults(schema, value) {
  if (!schema || value === undefined) return value;
  if (schema.type === 'object' && schema.properties && typeof value === 'object' && value !== null) {
    for (const [k, sub] of Object.entries(schema.properties)) {
      if (value[k] === undefined && sub.default !== undefined) {
        value[k] = sub.default;
      } else if (value[k] !== undefined) {
        applyDefaults(sub, value[k]);
      }
    }
  } else if (schema.type === 'array' && schema.items && Array.isArray(value)) {
    value.forEach((item) => applyDefaults(schema.items, item));
  }
  return value;
}

export function validate(schema, value) {
  applyDefaults(schema, value);
  const errors = validateNode(schema, value);
  return { ok: errors.length === 0, errors };
}
