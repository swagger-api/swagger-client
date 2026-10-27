import { isPlainObject } from 'ramda-adjunct';

/**
 * Standalone JSON Schema documents are recognized by the `$schema` keyword of the document root,
 * when the document is not an OpenAPI or Swagger document (their Schema Objects can carry
 * `$schema` too). Only the dialect identifier itself matches; an empty fragment is normalised
 * because documents add or drop it. Other values (the other URI scheme, custom meta-schemas,
 * dialects not supported yet) are refused and keep the generic strategy.
 *
 * https://json-schema.org/specification-links
 */
const normalizeDialectIdentifier = (identifier) =>
  identifier.endsWith('#') ? identifier.slice(0, -1) : identifier;

const isJSONSchemaDialect = (identifier) => (spec) => {
  try {
    if (!isPlainObject(spec)) return false;
    if (Object.hasOwn(spec, 'openapi') || Object.hasOwn(spec, 'swagger')) return false;

    const { $schema } = spec;
    return typeof $schema === 'string' && normalizeDialectIdentifier($schema) === identifier;
  } catch {
    return false;
  }
};

export const JSON_SCHEMA_2020_12_DIALECT = 'https://json-schema.org/draft/2020-12/schema';

export const isJSONSchema202012 = isJSONSchemaDialect(JSON_SCHEMA_2020_12_DIALECT);
