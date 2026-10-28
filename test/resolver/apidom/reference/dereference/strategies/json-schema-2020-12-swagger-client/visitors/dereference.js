/* eslint-disable camelcase */
import { toValue } from '@swagger-api/apidom-core';
import {
  mediaTypes,
  refract,
  isBooleanJsonSchemaElement,
} from '@swagger-api/apidom-ns-json-schema-2020-12';
import { dereferenceApiDOM } from '@swagger-api/apidom-reference/configuration/empty';

import * as jestSetup from '../__utils__/jest.local.setup.js';
import JSONSchema2020_12SwaggerClientDereferenceStrategy from '../../../../../../../../src/resolver/apidom/reference/dereference/strategies/json-schema-2020-12-swagger-client/index.js';

const $schema = 'https://json-schema.org/draft/2020-12/schema';
const baseURI = 'https://example.com/schemas/root.json';

const dereferenceSpec = (spec, { strategyOptions, ...options } = {}) =>
  dereferenceApiDOM(refract(spec), {
    parse: { mediaType: mediaTypes.latest('json') },
    resolve: { baseURI },
    ...(strategyOptions
      ? {
          dereference: {
            strategies: [new JSONSchema2020_12SwaggerClientDereferenceStrategy(strategyOptions)],
            ...options.dereference,
          },
        }
      : options),
  });

describe('dereference', () => {
  beforeAll(() => {
    jestSetup.beforeAll();
  });

  afterAll(() => {
    jestSetup.afterAll();
  });

  describe('strategies', () => {
    describe('json-schema-2020-12-swagger-client', () => {
      describe('visitors', () => {
        describe('JSONSchema2020_12SwaggerClientDereferenceVisitor', () => {
          describe('given allowMetaPatches=true', () => {
            test('should annotate the dereferenced schema with an absolute $$ref', async () => {
              const result = await dereferenceSpec(
                {
                  $schema,
                  properties: { user: { $ref: '#/$defs/User' } },
                  $defs: { User: { type: 'object' } },
                },
                { strategyOptions: { allowMetaPatches: true } }
              );

              expect(toValue(result).properties.user).toEqual({
                type: 'object',
                $$ref: `${baseURI}#/$defs/User`,
              });
            });

            test('should resolve $$ref against the $id base URI', async () => {
              const result = await dereferenceSpec(
                {
                  $schema,
                  $id: 'https://example.com/other/root.json',
                  properties: { tag: { $ref: '#tag' } },
                  $defs: { Tag: { $anchor: 'tag', type: 'string' } },
                },
                { strategyOptions: { allowMetaPatches: true } }
              );

              expect(toValue(result).properties.tag.$$ref).toBe(
                'https://example.com/other/root.json#tag'
              );
            });
          });

          describe('given allowMetaPatches=false', () => {
            test('should NOT annotate the dereferenced schema with $$ref', async () => {
              const result = await dereferenceSpec(
                {
                  $schema,
                  properties: { user: { $ref: '#/$defs/User' } },
                  $defs: { User: { type: 'object' } },
                },
                { strategyOptions: { allowMetaPatches: false } }
              );

              expect(toValue(result).properties.user).toEqual({ type: 'object' });
            });
          });

          describe('given resolve.internal=false', () => {
            test('should leave internal $refs unresolved', async () => {
              const result = await dereferenceApiDOM(
                refract({
                  $schema,
                  properties: { user: { $ref: '#/$defs/User' }, tag: { $ref: '#tag' } },
                  $defs: { User: { type: 'object' }, Tag: { $anchor: 'tag' } },
                }),
                {
                  parse: { mediaType: mediaTypes.latest('json') },
                  resolve: { baseURI, internal: false },
                }
              );

              expect(toValue(result).properties).toEqual({
                user: { $ref: '#/$defs/User' },
                tag: { $ref: '#tag' },
              });
            });
          });

          describe('given resolve.external=false', () => {
            test('should leave external $refs unresolved', async () => {
              const result = await dereferenceApiDOM(
                refract({
                  $schema,
                  properties: {
                    user: { $ref: 'https://example.com/schemas/user.json' },
                    tag: { $ref: '#/$defs/Tag' },
                  },
                  $defs: { Tag: { type: 'string' } },
                }),
                {
                  parse: { mediaType: mediaTypes.latest('json') },
                  resolve: { baseURI, external: false },
                }
              );

              expect(toValue(result).properties).toEqual({
                user: { $ref: 'https://example.com/schemas/user.json' },
                tag: { type: 'string' },
              });
            });
          });

          describe('given a $ref to a Boolean JSON Schema', () => {
            test('should dereference to a Boolean JSON Schema element', async () => {
              const result = await dereferenceSpec({
                $schema,
                properties: { any: { $ref: '#/$defs/Any' }, none: { $ref: '#/$defs/None' } },
                $defs: { Any: true, None: false },
              });

              expect(toValue(result).properties).toEqual({ any: true, none: false });
              expect(isBooleanJsonSchemaElement(result.get('properties').get('any'))).toBe(true);
            });
          });

          describe('given a $dynamicRef', () => {
            test('should leave it in place', async () => {
              const spec = {
                $schema,
                $id: 'https://test.json-schema.org/dynamicRef-dynamicAnchor-same-schema/root',
                type: 'array',
                items: { $dynamicRef: '#items' },
                $defs: { foo: { $dynamicAnchor: 'items', type: 'string' } },
              };
              const result = await dereferenceSpec(spec);

              expect(toValue(result)).toEqual(spec);
            });
          });

          describe('given an unresolvable $ref', () => {
            test('should collect an error and continue', async () => {
              const errors = [];
              const result = await dereferenceSpec(
                {
                  $schema,
                  properties: {
                    user: { $ref: '#/$defs/Missing' },
                    tag: { $ref: '#/$defs/Tag' },
                  },
                  $defs: { Tag: { type: 'string' } },
                },
                { dereference: { dereferenceOpts: { errors } } }
              );

              expect(toValue(result).properties).toEqual({
                user: { $ref: '#/$defs/Missing' },
                tag: { type: 'string' },
              });
              expect(errors).toHaveLength(1);
              expect(errors[0]).toMatchObject({
                message: expect.stringMatching(/^Could not resolve reference/),
                $ref: '#/$defs/Missing',
                baseDoc: baseURI,
                fullPath: ['properties', 'user', '$ref'],
              });
            });

            test('should collect an error for an unknown $anchor', async () => {
              const errors = [];
              await dereferenceSpec(
                { $schema, properties: { user: { $ref: '#missing' } } },
                { dereference: { dereferenceOpts: { errors } } }
              );

              expect(errors).toHaveLength(1);
              expect(errors[0]).toMatchObject({
                $ref: '#missing',
                fullPath: ['properties', 'user', '$ref'],
              });
            });
          });
        });
      });
    });
  });
});
/* eslint-enable camelcase */
