import {
  isJSONSchema202012,
  JSON_SCHEMA_2020_12_DIALECT,
} from '../../src/helpers/json-schema-predicates.js';

describe('helpers', () => {
  describe('json-schema-predicates', () => {
    describe('isJSONSchema202012', () => {
      test('should accept the JSON Schema 2020-12 dialect identifier', () => {
        expect(
          isJSONSchema202012({ $schema: 'https://json-schema.org/draft/2020-12/schema' })
        ).toBe(true);
        expect(
          isJSONSchema202012({
            $schema: 'https://json-schema.org/draft/2020-12/schema',
            $id: 'https://example.com/schema.json',
            type: 'object',
          })
        ).toBe(true);
      });

      test('should accept the identifier with an empty fragment', () => {
        expect(
          isJSONSchema202012({ $schema: 'https://json-schema.org/draft/2020-12/schema#' })
        ).toBe(true);
      });

      test('should refuse the http scheme', () => {
        expect(isJSONSchema202012({ $schema: 'http://json-schema.org/draft/2020-12/schema' })).toBe(
          false
        );
        expect(
          isJSONSchema202012({ $schema: 'http://json-schema.org/draft/2020-12/schema#' })
        ).toBe(false);
      });

      test('should refuse a non-empty fragment and other variations of the identifier', () => {
        // derived from the identifier: the variants are not URLs anyone can retrieve
        expect(JSON_SCHEMA_2020_12_DIALECT).toBe('https://json-schema.org/draft/2020-12/schema');
        expect(isJSONSchema202012({ $schema: `${JSON_SCHEMA_2020_12_DIALECT}#foo` })).toBe(false);
        expect(isJSONSchema202012({ $schema: `${JSON_SCHEMA_2020_12_DIALECT}##` })).toBe(false);
        expect(isJSONSchema202012({ $schema: `${JSON_SCHEMA_2020_12_DIALECT}/` })).toBe(false);
        expect(
          isJSONSchema202012({ $schema: JSON_SCHEMA_2020_12_DIALECT.replace(/schema$/, 'Schema') })
        ).toBe(false);
        expect(isJSONSchema202012({ $schema: ` ${JSON_SCHEMA_2020_12_DIALECT}` })).toBe(false);
      });

      test('should refuse other dialects', () => {
        expect(
          isJSONSchema202012({ $schema: 'https://json-schema.org/draft/2019-09/schema' })
        ).toBe(false);
        expect(isJSONSchema202012({ $schema: 'http://json-schema.org/draft-07/schema#' })).toBe(
          false
        );
        expect(isJSONSchema202012({ $schema: 'http://json-schema.org/draft-04/schema#' })).toBe(
          false
        );
      });

      test('should refuse custom meta-schemas and OpenAPI dialects', () => {
        expect(isJSONSchema202012({ $schema: 'https://example.com/meta/schema' })).toBe(false);
        expect(
          isJSONSchema202012({ $schema: 'https://spec.openapis.org/oas/3.1/dialect/base' })
        ).toBe(false);
      });

      test('should refuse a $schema that is not a string', () => {
        expect(isJSONSchema202012({ $schema: null })).toBe(false);
        expect(isJSONSchema202012({ $schema: 2020 })).toBe(false);
        expect(
          isJSONSchema202012({ $schema: { $ref: 'https://json-schema.org/draft/2020-12/schema' } })
        ).toBe(false);
      });

      test('should refuse a document without a root $schema', () => {
        expect(isJSONSchema202012({ type: 'object' })).toBe(false);
        expect(isJSONSchema202012({})).toBe(false);
      });

      test('should refuse a $schema in a nested schema only', () => {
        expect(
          isJSONSchema202012({
            type: 'object',
            properties: {
              a: { $schema: 'https://json-schema.org/draft/2020-12/schema' },
            },
          })
        ).toBe(false);
      });

      test('should refuse OpenAPI and Swagger documents with a root $schema', () => {
        expect(
          isJSONSchema202012({
            openapi: '3.1.0',
            $schema: 'https://json-schema.org/draft/2020-12/schema',
          })
        ).toBe(false);
        expect(
          isJSONSchema202012({
            swagger: '2.0',
            $schema: 'https://json-schema.org/draft/2020-12/schema',
          })
        ).toBe(false);
      });

      test('should refuse an OpenAPI 3.1 document with $schema in a Schema Object', () => {
        expect(
          isJSONSchema202012({
            openapi: '3.1.0',
            info: { title: 'test', version: '1.0.0' },
            components: {
              schemas: {
                User: {
                  $schema: 'https://json-schema.org/draft/2020-12/schema',
                  type: 'object',
                },
              },
            },
          })
        ).toBe(false);
      });

      test('should refuse non-objects', () => {
        expect(isJSONSchema202012(null)).toBe(false);
        expect(isJSONSchema202012(undefined)).toBe(false);
        expect(isJSONSchema202012(true)).toBe(false);
        expect(isJSONSchema202012('https://json-schema.org/draft/2020-12/schema')).toBe(false);
        expect(isJSONSchema202012(1)).toBe(false);
        expect(isJSONSchema202012([])).toBe(false);
        expect(
          isJSONSchema202012([{ $schema: 'https://json-schema.org/draft/2020-12/schema' }])
        ).toBe(false);
      });
    });
  });
});
