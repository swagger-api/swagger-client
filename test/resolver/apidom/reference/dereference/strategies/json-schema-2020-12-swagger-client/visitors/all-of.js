import { visit, toValue } from '@swagger-api/apidom-core';
import { refract, getNodeType, keyMap } from '@swagger-api/apidom-ns-json-schema-2020-12';

import AllOfVisitor from '../../../../../../../../src/resolver/apidom/reference/dereference/strategies/json-schema-2020-12-swagger-client/visitors/all-of.js';

const $schema = 'https://json-schema.org/draft/2020-12/schema';

const buildOptions = (errors = []) => ({
  dereference: { dereferenceOpts: { errors } },
});

const applyAllOf = ($defs, errors = []) => {
  const element = refract({ $schema, $defs });
  const visitor = new AllOfVisitor({ options: buildOptions(errors) });
  return toValue(visit(element, visitor, { keyMap, nodeTypeGetter: getNodeType })).$defs;
};

describe('dereference', () => {
  describe('strategies', () => {
    describe('json-schema-2020-12-swagger-client', () => {
      describe('visitors', () => {
        describe('AllOfVisitor', () => {
          describe('given a schema without allOf keyword', () => {
            test('should leave the schema unchanged', () => {
              expect(applyAllOf({ User: { type: 'object' } })).toEqual({
                User: { type: 'object' },
              });
            });
          });

          describe('given allOf on the document root', () => {
            test('should merge it into the root', () => {
              const element = refract({ $schema, allOf: [{ type: 'string' }, { maxLength: 10 }] });
              const visitor = new AllOfVisitor({ options: buildOptions() });
              const result = visit(element, visitor, { keyMap, nodeTypeGetter: getNodeType });

              expect(toValue(result)).toEqual({ $schema, type: 'string', maxLength: 10 });
            });
          });

          describe('given allOf is not an array', () => {
            test('should leave the schema unchanged', () => {
              expect(applyAllOf({ User: { allOf: {} } })).toEqual({ User: { allOf: {} } });
            });

            test('should collect an error', () => {
              const errors = [];

              applyAllOf({ User: { allOf: {} } }, errors);

              expect(errors).toHaveLength(1);
              expect(errors[0]).toMatchObject({
                message: expect.stringMatching(/^allOf must be an array/),
                fullPath: ['$defs', 'User', 'allOf'],
              });
            });
          });

          describe('given allOf is an empty array', () => {
            test('should remove the allOf keyword from the schema', () => {
              expect(applyAllOf({ User: { allOf: [] } })).toEqual({ User: {} });
            });
          });

          describe('given allOf contains a non-object item', () => {
            test('should leave the schema unchanged', () => {
              const $defs = { User: { allOf: [{ type: 'string' }, 2] } };

              expect(applyAllOf($defs)).toEqual($defs);
            });

            test('should collect an error', () => {
              const errors = [];

              applyAllOf({ User: { allOf: [{ type: 'string' }, 2] } }, errors);

              expect(errors).toHaveLength(1);
              expect(errors[0]).toMatchObject({
                message: expect.stringMatching(/^Elements in allOf must be objects/),
                fullPath: ['$defs', 'User', 'allOf'],
              });
            });
          });

          describe('given allOf contains a Boolean JSON Schema', () => {
            test('should collect an error as for OpenAPI 3.1 Schema Objects', () => {
              const errors = [];
              const $defs = { User: { allOf: [{ type: 'string' }, true] } };

              expect(applyAllOf($defs, errors)).toEqual($defs);
              expect(errors).toHaveLength(1);
              expect(errors[0]).toMatchObject({
                message: expect.stringMatching(/^Elements in allOf must be objects/),
              });
            });
          });

          describe('given a simple allOf with two schemas', () => {
            test('should merge all schemas into one', () => {
              expect(
                applyAllOf({ User: { allOf: [{ type: 'string' }, { maxLength: 10 }] } })
              ).toEqual({ User: { type: 'string', maxLength: 10 } });
            });
          });

          describe('given a schema with allOf and its own keywords', () => {
            test('should give priority to the schema own keywords over allOf items', () => {
              expect(
                applyAllOf({
                  User: {
                    type: 'object',
                    allOf: [{ type: 'string', description: 'from allOf' }],
                  },
                })
              ).toEqual({ User: { type: 'object', description: 'from allOf' } });
            });
          });

          describe('given nested allOf schemas', () => {
            test('should fully resolve all nesting levels', () => {
              expect(
                applyAllOf({
                  Cat: {
                    allOf: [
                      { allOf: [{ type: 'string' }] },
                      { maximum: 1 },
                      {
                        allOf: [
                          { exclusiveMaximum: 2 },
                          { allOf: [{ minimum: 3 }, { exclusiveMinimum: 4 }] },
                        ],
                      },
                    ],
                  },
                })
              ).toEqual({
                Cat: {
                  type: 'string',
                  maximum: 1,
                  exclusiveMaximum: 2,
                  minimum: 3,
                  exclusiveMinimum: 4,
                },
              });
            });
          });

          describe('given allOf items with deeply nested objects', () => {
            test('should deep-merge nested objects', () => {
              expect(
                applyAllOf({
                  Cat: {
                    allOf: [
                      { properties: { name: { type: 'string' } } },
                      { properties: { age: { type: 'integer' } } },
                    ],
                  },
                })
              ).toEqual({
                Cat: {
                  properties: { name: { type: 'string' }, age: { type: 'integer' } },
                },
              });
            });
          });

          describe('given allOf items with array keywords', () => {
            test('should concatenate arrays from all items', () => {
              expect(
                applyAllOf({
                  Cat: { allOf: [{ required: ['name'] }, { required: ['age'] }] },
                })
              ).toEqual({ Cat: { required: ['name', 'age'] } });
            });
          });

          describe('given a schema with an examples keyword', () => {
            test('should keep the original examples instead of merging', () => {
              expect(
                applyAllOf({
                  Cat: {
                    examples: [{ name: 'my cat' }],
                    allOf: [{ examples: [{ name: 'other' }], type: 'object' }],
                  },
                })
              ).toEqual({ Cat: { examples: [{ name: 'my cat' }], type: 'object' } });
            });
          });

          describe('given a schema without $$ref', () => {
            test('should strip $$ref introduced by allOf merging', () => {
              expect(
                applyAllOf({ Cat: { allOf: [{ $$ref: 'some-ref', type: 'object' }] } })
              ).toEqual({ Cat: { type: 'object' } });
            });
          });

          describe('given a schema with an existing $$ref', () => {
            test('should retain the $$ref from the original schema', () => {
              const result = applyAllOf({
                Cat: { $$ref: 'original-ref', allOf: [{ $$ref: 'other-ref', type: 'object' }] },
              });

              expect(result.Cat.$$ref).toEqual('original-ref');
            });
          });

          describe('given primitive enum values in allOf items', () => {
            test('should deduplicate primitive enum values', () => {
              expect(
                applyAllOf({
                  one: {
                    allOf: [
                      { properties: { foo: { enum: [1, 2, 3, 4] } } },
                      { properties: { foo: { enum: [1, 2, 3, 5] } } },
                    ],
                  },
                })
              ).toEqual({ one: { properties: { foo: { enum: [1, 2, 3, 4, 5] } } } });
            });

            test('should not deduplicate complex enum values', () => {
              const result = applyAllOf({
                one: {
                  allOf: [
                    { properties: { bar: { enum: [{ enum: [1, 2, 3] }] } } },
                    { properties: { bar: { enum: [{ enum: [1, 2, 3] }] } } },
                  ],
                },
              });

              expect(result.one.properties.bar.enum).toHaveLength(2);
            });
          });
        });
      });
    });
  });
});
