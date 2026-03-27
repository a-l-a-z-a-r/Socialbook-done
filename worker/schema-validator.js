import fs from 'fs';
import path from 'path';

const schemaCache = new Map();

const schemaBaseCandidates = [
  path.resolve(process.cwd(), 'schemas'),
  path.resolve(process.cwd(), '../schemas'),
  path.resolve(import.meta.dirname, '../schemas'),
];

const getSchemaPath = (schemaRelativePath) => {
  for (const basePath of schemaBaseCandidates) {
    const fullPath = path.join(basePath, schemaRelativePath);
    if (fs.existsSync(fullPath)) {
      return fullPath;
    }
  }

  throw new Error(`Schema not found: ${schemaRelativePath}`);
};

const loadSchema = (schemaRelativePath) => {
  if (schemaCache.has(schemaRelativePath)) {
    return schemaCache.get(schemaRelativePath);
  }

  const schemaPath = getSchemaPath(schemaRelativePath);
  const schema = JSON.parse(fs.readFileSync(schemaPath, 'utf8'));
  schemaCache.set(schemaRelativePath, schema);
  return schema;
};

const isObject = (value) => typeof value === 'object' && value !== null && !Array.isArray(value);

const validateProperty = (name, value, property) => {
  if (property.const !== undefined && value !== property.const) {
    return `${name} must equal ${JSON.stringify(property.const)}`;
  }
  if (property.enum && !property.enum.includes(value)) {
    return `${name} must be one of ${property.enum.map((entry) => JSON.stringify(entry)).join(', ')}`;
  }
  if (property.type === 'string') {
    if (typeof value !== 'string') return `${name} must be a string`;
    if (property.minLength !== undefined && value.length < property.minLength) {
      return `${name} must be at least ${property.minLength} characters`;
    }
    if (property.format === 'date-time' && Number.isNaN(Date.parse(value))) {
      return `${name} must be a valid date-time`;
    }
    return null;
  }
  if (property.type === 'number') {
    if (typeof value !== 'number' || Number.isNaN(value)) return `${name} must be a number`;
    if (property.minimum !== undefined && value < property.minimum) {
      return `${name} must be >= ${property.minimum}`;
    }
    if (property.maximum !== undefined && value > property.maximum) {
      return `${name} must be <= ${property.maximum}`;
    }
  }
  return null;
};

export const validateAgainstSchema = (schemaRelativePath, payload) => {
  const schema = loadSchema(schemaRelativePath);
  if (!isObject(payload)) {
    return { valid: false, error: `${schema.title || 'Payload'} must be a JSON object` };
  }

  const properties = schema.properties || {};
  const required = new Set(schema.required || []);

  for (const field of required) {
    const value = payload[field];
    if (value === undefined || value === null) {
      return { valid: false, error: `${field} is required` };
    }
  }

  if (schema.additionalProperties === false) {
    for (const key of Object.keys(payload)) {
      if (!properties[key]) {
        return { valid: false, error: `${key} is not allowed` };
      }
    }
  }

  for (const [key, property] of Object.entries(properties)) {
    const value = payload[key];
    if (value === undefined || value === null) continue;
    const error = validateProperty(key, value, property);
    if (error) {
      return { valid: false, error };
    }
  }

  return { valid: true };
};
