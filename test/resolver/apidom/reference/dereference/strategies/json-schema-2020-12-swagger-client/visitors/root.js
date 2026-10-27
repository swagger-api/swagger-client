/* eslint-disable camelcase */
import { toValue } from '@swagger-api/apidom-core';
import { mediaTypes, refract } from '@swagger-api/apidom-ns-json-schema-2020-12';
import { dereferenceApiDOM } from '@swagger-api/apidom-reference/configuration/empty';

import * as jestSetup from '../__utils__/jest.local.setup.js';
import JSONSchema2020_12SwaggerClientDereferenceStrategy from '../../../../../../../../src/resolver/apidom/reference/dereference/strategies/json-schema-2020-12-swagger-client/index.js';

const $schema = 'https://json-schema.org/draft/2020-12/schema';

describe('dereference', () => {
  beforeAll(() => {
    jestSetup.beforeAll();
  });

  afterAll(() => {
    jestSetup.afterAll();
  });

  describe('strategies', () => {
    describe('json-schema-2020-12-swagger-client', () => {
      test('should be named json-schema-2020-12-swagger-client', () => {
        expect(new JSONSchema2020_12SwaggerClientDereferenceStrategy().name).toBe(
          'json-schema-2020-12-swagger-client'
        );
      });

      describe('visitors', () => {
        describe('RootVisitor', () => {
          describe('given mode is not set (default)', () => {
            test('should merge allOf schemas', async () => {
              const spec = refract({
                $schema,
                $defs: { Cat: { allOf: [{ type: 'string' }, { maxLength: 10 }] } },
              });
              const result = await dereferenceApiDOM(spec, {
                parse: { mediaType: mediaTypes.latest('json') },
              });

              expect(toValue(result).$defs.Cat).toEqual({ type: 'string', maxLength: 10 });
            });

            test('should merge allOf items that are $refs', async () => {
              const spec = refract({
                $schema,
                properties: {
                  cat: { allOf: [{ $ref: '#/$defs/Pet' }, { required: ['name'] }] },
                },
                $defs: { Pet: { type: 'object', properties: { name: { type: 'string' } } } },
              });
              const result = await dereferenceApiDOM(spec, {
                parse: { mediaType: mediaTypes.latest('json') },
              });

              expect(toValue(result).properties.cat).toEqual({
                type: 'object',
                properties: { name: { type: 'string' } },
                required: ['name'],
              });
            });
          });

          describe('given mode=strict', () => {
            test('should NOT merge allOf schemas', async () => {
              const spec = refract({
                $schema,
                $defs: { Cat: { allOf: [{ type: 'string' }, { maxLength: 10 }] } },
              });
              const result = await dereferenceApiDOM(spec, {
                parse: { mediaType: mediaTypes.latest('json') },
                dereference: {
                  strategies: [
                    new JSONSchema2020_12SwaggerClientDereferenceStrategy({ mode: 'strict' }),
                  ],
                },
              });

              expect(toValue(result).$defs.Cat).toEqual({
                allOf: [{ type: 'string' }, { maxLength: 10 }],
              });
            });

            test('should still dereference $refs in strict mode', async () => {
              const spec = refract({
                $schema,
                properties: { cat: { allOf: [{ $ref: '#/$defs/Pet' }] } },
                $defs: { Pet: { type: 'object' } },
              });
              const result = await dereferenceApiDOM(spec, {
                parse: { mediaType: mediaTypes.latest('json') },
                dereference: {
                  strategies: [
                    new JSONSchema2020_12SwaggerClientDereferenceStrategy({ mode: 'strict' }),
                  ],
                },
              });

              expect(toValue(result).properties.cat).toEqual({ allOf: [{ type: 'object' }] });
            });
          });

          describe('given modelPropertyMacro is provided', () => {
            test('should apply the macro to schema properties', async () => {
              const spec = refract({
                $schema,
                $defs: {
                  User: { type: 'object', properties: { id: { type: 'integer' } } },
                },
              });
              const result = await dereferenceApiDOM(spec, {
                parse: { mediaType: mediaTypes.latest('json') },
                dereference: {
                  strategies: [
                    new JSONSchema2020_12SwaggerClientDereferenceStrategy({
                      modelPropertyMacro: (prop) => `${prop.type}-default`,
                    }),
                  ],
                },
              });

              expect(toValue(result).$defs.User.properties.id.default).toBe('integer-default');
            });
          });

          describe('given parameterMacro is provided', () => {
            test('should ignore it: JSON Schema documents have no Parameter Objects', async () => {
              const parameterMacro = jest.fn(() => 'default');
              const spec = refract({
                $schema,
                properties: { parameters: { type: 'array', items: { name: 'limit' } } },
              });
              const result = await dereferenceApiDOM(spec, {
                parse: { mediaType: mediaTypes.latest('json') },
                dereference: {
                  strategies: [
                    new JSONSchema2020_12SwaggerClientDereferenceStrategy({ parameterMacro }),
                  ],
                },
              });

              expect(toValue(result)).toEqual(toValue(spec));
              expect(parameterMacro).not.toHaveBeenCalled();
            });
          });
        });
      });
    });
  });
});
/* eslint-enable camelcase */
