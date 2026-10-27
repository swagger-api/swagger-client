import path from 'node:path';
import * as undici from 'undici';

import SwaggerClient from '../../../../src/index.js';
import { DEFAULT_BASE_URL } from '../../../../src/constants.js';
import { makeResolve } from '../../../../src/resolver/index.js';
import jsonSchema202012ApiDOMStrategy from '../../../../src/resolver/strategies/json-schema-2020-12-apidom/index.js';
import openApi31ApiDOMStrategy from '../../../../src/resolver/strategies/openapi-3-1-apidom/index.js';
import genericStrategy from '../../../../src/resolver/strategies/generic/index.js';

const fixturePath = path.join(__dirname, '__fixtures__');
const loadFixture = (name) => globalThis.loadJsonFile(path.join(fixturePath, name));
const $schema = 'https://json-schema.org/draft/2020-12/schema';

// recursive schemas whose $refs point to an ancestor of the resolved fragment
const treeBaseDoc = 'https://example.com/schemas/tree.json';
const tree = () => ({
  $schema,
  type: 'object',
  properties: {
    name: { type: 'string' },
    children: { type: 'array', items: { $ref: '#' } },
  },
});
const defsTree = () => ({
  $schema,
  properties: { root: { $ref: '#/$defs/Node' } },
  $defs: {
    Node: {
      type: 'object',
      properties: { children: { type: 'array', items: { $ref: '#/$defs/Node' } } },
    },
  },
});

const address = {
  type: 'object',
  properties: {
    street: { type: 'string' },
    country: { type: 'string', minLength: 2 },
  },
};

describe('resolve', () => {
  let mockAgent;
  let originalGlobalDispatcher;

  const mockFixture = (fixture, urlPath) =>
    mockAgent
      .get('https://example.com')
      .intercept({ path: urlPath })
      .reply(200, globalThis.loadFile(path.join(fixturePath, fixture)), {
        headers: { 'Content-Type': 'application/json' },
      });

  const mockOrder = () => {
    mockFixture('root.json', '/schemas/order.json');
    mockFixture('external.json', '/schemas/external.json');
    mockFixture('product.json', '/schemas/items/product.json');
  };

  beforeEach(() => {
    mockAgent = new undici.MockAgent();
    mockAgent.disableNetConnect();
    originalGlobalDispatcher = undici.getGlobalDispatcher();
    undici.setGlobalDispatcher(mockAgent);
  });

  afterEach(() => {
    undici.setGlobalDispatcher(originalGlobalDispatcher);
    mockAgent = null;
    originalGlobalDispatcher = null;
  });

  describe('JSON Schema 2020-12 strategy', () => {
    test('should be registered ahead of the generic strategy', () => {
      expect(SwaggerClient.resolveStrategies['json-schema-2020-12-apidom']).toBe(
        jsonSchema202012ApiDOMStrategy
      );
      expect(jsonSchema202012ApiDOMStrategy.name).toBe('json-schema-2020-12-apidom');
      expect(jsonSchema202012ApiDOMStrategy.match(loadFixture('root.json'))).toBe(true);
    });

    test('should normalize to the same object', () => {
      const spec = loadFixture('root.json');

      expect(jsonSchema202012ApiDOMStrategy.normalize(spec)).toBe(spec);
    });

    describe('given JSON Schema 2020-12 document via URL', () => {
      test('should resolve internal, $anchor, $id-relative and external $refs', async () => {
        mockOrder();
        const { spec, errors } = await SwaggerClient.resolve({
          url: 'https://example.com/schemas/order.json',
          allowMetaPatches: false,
        });

        expect(errors).toEqual([]);
        expect(spec.properties.customer).toEqual({
          type: 'object',
          properties: { name: { type: 'string' }, address },
        });
        expect(spec.properties.status).toEqual({
          $anchor: 'status',
          type: 'string',
          enum: ['open', 'closed'],
        });
        expect(spec.properties.address).toEqual(address);
        expect(spec.properties.items.items).toEqual({
          $id: 'items/',
          type: 'object',
          properties: {
            product: {
              $schema,
              type: 'object',
              properties: { sku: { $anchor: 'sku', type: 'string' } },
              $defs: { Sku: { $anchor: 'sku', type: 'string' } },
            },
            price: {
              $id: 'https://example.com/schemas/items/price.json',
              type: 'number',
              minimum: 0,
            },
          },
          $defs: {
            Price: {
              $id: 'https://example.com/schemas/items/price.json',
              type: 'number',
              minimum: 0,
            },
          },
        });
      });

      test('should leave every $dynamicRef in place', async () => {
        mockOrder();
        const { spec } = await SwaggerClient.resolve({
          url: 'https://example.com/schemas/order.json',
        });

        expect(spec.properties.metadata).toEqual({ $dynamicRef: '#meta' });
      });

      describe('and allowMetaPatches=true', () => {
        test('should annotate resolved schemas with absolute $$ref', async () => {
          mockOrder();
          const { spec } = await SwaggerClient.resolve({
            url: 'https://example.com/schemas/order.json',
            allowMetaPatches: true,
          });

          expect(spec.properties.customer.$$ref).toBe(
            'https://example.com/schemas/order.json#/$defs/Customer'
          );
          expect(spec.properties.status.$$ref).toBe(
            'https://example.com/schemas/order.json#status'
          );
          expect(spec.properties.address.$$ref).toBe(
            'https://example.com/schemas/external.json#/$defs/Address'
          );
          expect(spec.properties.items.items.properties.product.$$ref).toBe(
            'https://example.com/schemas/items/product.json'
          );
          expect(spec.properties.items.items.properties.price.$$ref).toBe(
            'https://example.com/schemas/items/price.json'
          );
        });
      });

      describe('and an external $ref cannot be retrieved', () => {
        test('should collect the error and resolve the rest', async () => {
          mockFixture('root.json', '/schemas/order.json');
          mockFixture('product.json', '/schemas/items/product.json');
          mockAgent
            .get('https://example.com')
            .intercept({ path: '/schemas/external.json' })
            .reply(404, 'Not Found')
            .persist();
          const { spec, errors } = await SwaggerClient.resolve({
            url: 'https://example.com/schemas/order.json',
          });

          expect(spec.properties.address).toEqual({ $ref: 'external.json#/$defs/Address' });
          expect(spec.properties.status).toHaveProperty('$anchor', 'status');
          expect(errors.length).toBeGreaterThan(0);
          expect(errors).toContainEqual(
            expect.objectContaining({
              message: expect.stringMatching(/^Could not resolve reference/),
              $ref: 'external.json#/$defs/Address',
              fullPath: ['properties', 'address', '$ref'],
            })
          );
        });
      });

      describe('and useCircularStructures=false', () => {
        test('should replace cycles with absolute $refs', async () => {
          mockFixture('circular.json', '/schemas/circular.json');
          const { spec, errors } = await SwaggerClient.resolve({
            url: 'https://example.com/schemas/circular.json',
            useCircularStructures: false,
          });

          const cycle = { $ref: 'https://example.com/schemas/circular.json#/$defs/Node' };

          expect(errors).toEqual([]);
          // the document root is the dereferenced Node, so the first `next` closes the cycle
          expect(spec).toEqual({
            $schema,
            type: 'object',
            properties: { value: { type: 'string' }, next: cycle },
            $defs: {
              Node: { type: 'object', properties: { value: { type: 'string' }, next: cycle } },
            },
          });
        });
      });

      describe('and useCircularStructures=true', () => {
        test('should resolve cycles into circular structures', async () => {
          mockFixture('circular.json', '/schemas/circular.json');
          const { spec, errors } = await SwaggerClient.resolve({
            url: 'https://example.com/schemas/circular.json',
            useCircularStructures: true,
          });

          expect(errors).toEqual([]);
          expect(spec.properties.next.properties.next).toBe(spec.properties.next);
        });
      });
    });

    describe('given JSON Schema 2020-12 document via spec option', () => {
      describe('and neither baseDoc nor url option is provided', () => {
        test('should resolve using implicit baseURI=DEFAULT_BASE_URL', async () => {
          const { spec } = await SwaggerClient.resolve({
            spec: loadFixture('macros.json'),
            allowMetaPatches: true,
          });

          expect(spec.properties.pet.$$ref).toBe(`${DEFAULT_BASE_URL}/#/$defs/Pet`);
        });
      });

      describe('and baseDoc option is provided', () => {
        test('should resolve external $refs against it', async () => {
          mockFixture('external.json', '/schemas/external.json');
          mockFixture('product.json', '/schemas/items/product.json');
          const { spec, errors } = await SwaggerClient.resolve({
            spec: loadFixture('root.json'),
            baseDoc: 'https://example.com/schemas/order.json',
          });

          expect(errors).toEqual([]);
          expect(spec.properties.address).toEqual(address);
        });
      });

      describe('and the same object is resolved twice', () => {
        test('should return the same result', async () => {
          const spec = loadFixture('macros.json');
          const first = await SwaggerClient.resolve({ spec });
          const second = await SwaggerClient.resolve({ spec });

          expect(second).toEqual(first);
        });
      });

      describe('and pathDiscriminator is empty list', () => {
        test('should resolve entire spec', async () => {
          const { spec } = await SwaggerClient.resolve({
            spec: loadFixture('macros.json'),
            pathDiscriminator: [],
          });

          expect(spec.properties.pet).toEqual({
            type: 'object',
            properties: { name: { type: 'string' } },
            required: ['name'],
          });
        });
      });

      describe('and pathDiscriminator=[properties, pet]', () => {
        test('should resolve within the pathDiscriminator only', async () => {
          const { spec } = await SwaggerClient.resolve({
            spec: loadFixture('macros.json'),
            pathDiscriminator: ['properties', 'pet'],
          });

          expect(spec.properties.pet).toEqual({
            type: 'object',
            properties: { name: { type: 'string' } },
            required: ['name'],
          });
          expect(spec.properties.cat.allOf[0]).toEqual({ $ref: '#/$defs/Pet' });
        });
      });

      describe('and pathDiscriminator compiles into invalid JSON Pointer', () => {
        test('should not resolve', async () => {
          const spec = loadFixture('macros.json');
          const resolved = await SwaggerClient.resolve({
            spec,
            pathDiscriminator: ['path', 'to', 'nothing'],
          });

          expect(resolved).toEqual({ spec, errors: [] });
        });
      });

      describe('and pathDiscriminator points into a schema that references its ancestor', () => {
        test('should resolve the reference to the ancestor as a cycle', async () => {
          const { spec, errors } = await SwaggerClient.resolve({
            spec: tree(),
            baseDoc: treeBaseDoc,
            pathDiscriminator: ['properties'],
          });

          expect(errors).toEqual([]);
          expect(spec.properties.children).toEqual({
            type: 'array',
            items: { $ref: treeBaseDoc },
          });
        });
      });

      describe('and mode is not set', () => {
        test('should merge allOf', async () => {
          const { spec } = await SwaggerClient.resolve({ spec: loadFixture('macros.json') });

          expect(spec.properties.cat).toEqual({
            type: 'object',
            properties: { name: { type: 'string' }, lives: { type: 'integer' } },
            required: ['name', 'lives'],
          });
        });
      });

      describe('and mode=strict', () => {
        test('should not merge allOf', async () => {
          const { spec } = await SwaggerClient.resolve({
            spec: loadFixture('macros.json'),
            mode: 'strict',
          });

          expect(spec.properties.cat.allOf).toHaveLength(2);
        });
      });

      describe('and modelPropertyMacro is provided as a function', () => {
        test('should call modelPropertyMacro with schema properties', async () => {
          const { spec } = await SwaggerClient.resolve({
            spec: loadFixture('macros.json'),
            modelPropertyMacro: (property) => `${property.type}-default`,
          });

          expect(spec.properties.pet.properties.name.default).toBe('string-default');
          expect(spec.properties.cat.properties.lives.default).toBe('integer-default');
        });

        describe('given the function throws error', () => {
          test('should collect error', async () => {
            const { errors } = await SwaggerClient.resolve({
              spec: loadFixture('macros.json'),
              modelPropertyMacro: () => {
                throw new Error('this macro throws');
              },
            });

            expect(errors).toContainEqual(
              expect.objectContaining({
                message: expect.stringMatching(/^Error: this macro throws/),
                fullPath: ['$defs', 'Pet', 'properties'],
              })
            );
          });
        });
      });

      describe('and parameterMacro is provided as a function', () => {
        test('should not call it', async () => {
          const parameterMacro = jest.fn();
          await SwaggerClient.resolve({ spec: loadFixture('macros.json'), parameterMacro });

          expect(parameterMacro).not.toHaveBeenCalled();
        });
      });
    });

    describe('resolveSubtree', () => {
      test('should resolve a subtree with $anchor, $id-relative and external $refs', async () => {
        mockFixture('external.json', '/schemas/external.json');
        mockFixture('product.json', '/schemas/items/product.json');
        const spec = loadFixture('root.json');
        const customer = await SwaggerClient.resolveSubtree(spec, ['$defs', 'Customer'], {
          baseDoc: 'https://example.com/schemas/order.json',
        });
        const status = await SwaggerClient.resolveSubtree(spec, ['properties', 'status'], {
          baseDoc: 'https://example.com/schemas/order.json',
        });
        const item = await SwaggerClient.resolveSubtree(spec, ['$defs', 'Item'], {
          baseDoc: 'https://example.com/schemas/order.json',
        });

        expect(customer).toEqual({
          spec: {
            type: 'object',
            properties: {
              name: { type: 'string' },
              address: {
                ...address,
                properties: {
                  ...address.properties,
                  country: {
                    ...address.properties.country,
                    $$ref: 'https://example.com/schemas/external.json#/$defs/Country',
                  },
                },
                $$ref: 'https://example.com/schemas/external.json#/$defs/Address',
              },
            },
          },
          errors: [],
        });
        expect(status).toEqual({
          spec: {
            $anchor: 'status',
            type: 'string',
            enum: ['open', 'closed'],
            $$ref: 'https://example.com/schemas/order.json#status',
          },
          errors: [],
        });
        expect(item.errors).toEqual([]);
        expect(item.spec.properties.product.properties.sku).toEqual({
          $anchor: 'sku',
          type: 'string',
          $$ref: 'https://example.com/schemas/items/product.json#sku',
        });
        expect(item.spec.properties.price.$$ref).toBe(
          'https://example.com/schemas/items/price.json'
        );
      });

      test('should leave $dynamicRef in place', async () => {
        const { spec } = await SwaggerClient.resolveSubtree(loadFixture('root.json'), [
          'properties',
          'metadata',
        ]);

        expect(spec).toEqual({ $dynamicRef: '#meta' });
      });

      test('should resolve a $ref in the document root', async () => {
        const { spec, errors } = await SwaggerClient.resolveSubtree(
          loadFixture('circular.json'),
          []
        );
        const cycle = { $ref: `${DEFAULT_BASE_URL}/#/$defs/Node` };

        expect(errors).toEqual([]);
        expect(spec).toEqual({
          $schema,
          type: 'object',
          properties: { value: { type: 'string' }, next: cycle },
          $defs: {
            Node: { type: 'object', properties: { value: { type: 'string' }, next: cycle } },
          },
          $$ref: `${DEFAULT_BASE_URL}/#/$defs/Node`,
        });
      });

      describe('given a fragment whose $refs point to its ancestors', () => {
        const rootCycle = { $ref: treeBaseDoc };

        test.each([
          [
            ['properties'],
            { name: { type: 'string' }, children: { type: 'array', items: rootCycle } },
          ],
          [['properties', 'children'], { type: 'array', items: rootCycle }],
          [['properties', 'children', 'items'], rootCycle],
        ])(
          'should resolve %j with the $ref to the document root as a cycle',
          async (fragmentPath, expected) => {
            const result = await SwaggerClient.resolveSubtree(tree(), fragmentPath, {
              baseDoc: treeBaseDoc,
            });

            expect(result).toEqual({ spec: expected, errors: [] });
          }
        );

        test('should resolve a $ref to an ancestor in $defs as a cycle', async () => {
          const result = await SwaggerClient.resolveSubtree(
            defsTree(),
            ['$defs', 'Node', 'properties'],
            {
              baseDoc: treeBaseDoc,
            }
          );

          expect(result).toEqual({
            spec: {
              children: { type: 'array', items: { $ref: `${treeBaseDoc}#/$defs/Node` } },
            },
            errors: [],
          });
        });
      });
    });

    describe('given the same schema standalone and in an OpenAPI 3.1 document', () => {
      test('should resolve them the same', async () => {
        const schema = {
          $id: 'https://example.com/schemas/pet.json',
          type: 'object',
          properties: {
            tag: { $ref: '#/$defs/Tag' },
            owner: { $ref: '#owner' },
            nickname: { allOf: [{ $ref: '#/$defs/Tag' }, { minLength: 1 }] },
          },
          $defs: {
            Tag: { type: 'string' },
            Owner: { $anchor: 'owner', type: 'object', properties: { name: { type: 'string' } } },
          },
        };
        const options = {
          modelPropertyMacro: (property) => `${property.type}-default`,
          allowMetaPatches: true,
        };
        const standalone = await SwaggerClient.resolve({
          spec: { $schema, ...structuredClone(schema) },
          ...options,
        });
        const openapi = await SwaggerClient.resolve({
          spec: {
            openapi: '3.1.0',
            info: { title: 'Pets', version: '1.0.0' },
            components: { schemas: { Pet: structuredClone(schema) } },
          },
          ...options,
        });
        const { $schema: dialect, ...standaloneSchema } = standalone.spec;

        expect(standalone.errors).toEqual([]);
        expect(openapi.errors).toEqual([]);
        expect(dialect).toBe($schema);
        expect(standaloneSchema).toEqual(openapi.spec.components.schemas.Pet);
        expect(standaloneSchema.properties.nickname).toEqual({
          type: 'string',
          minLength: 1,
          default: 'string-default',
        });
        expect(standaloneSchema.properties.owner.$$ref).toBe(
          'https://example.com/schemas/pet.json#owner'
        );
      });
    });

    describe('regressions', () => {
      const resolveWith = (strategy, options) => makeResolve({ strategies: [strategy] })(options);

      describe('given an OpenAPI 3.1 document with a root $schema', () => {
        test('should resolve it with the OpenAPI 3.1 strategy', async () => {
          const spec = {
            openapi: '3.1.0',
            $schema,
            info: { title: 'test', version: '1.0.0' },
            paths: {
              '/pets': {
                get: {
                  parameters: [{ $ref: '#/components/parameters/limit' }],
                  responses: { 200: { description: 'OK' } },
                },
              },
            },
            components: {
              parameters: { limit: { name: 'limit', in: 'query', schema: { type: 'integer' } } },
            },
          };

          expect(jsonSchema202012ApiDOMStrategy.match(spec)).toBe(false);
          expect(await SwaggerClient.resolve({ spec: structuredClone(spec) })).toEqual(
            await resolveWith(openApi31ApiDOMStrategy, { spec: structuredClone(spec) })
          );
        });
      });

      describe('given an OpenAPI 3.1 document whose external $ref target has a root 2020-12 $schema', () => {
        test('should resolve the target as an OpenAPI 3.1 Schema Object', async () => {
          mockFixture('openapi-3-1-external-json-schema.json', '/api/openapi.json');
          mockFixture('user.schema.json', '/api/user.schema.json');
          const { spec, errors } = await SwaggerClient.resolve({
            url: 'https://example.com/api/openapi.json',
            allowMetaPatches: false,
          });
          const userAddress = {
            type: 'object',
            properties: { street: { type: 'string' } },
          };

          expect(errors).toEqual([]);
          expect(spec.components.schemas.User).toEqual({
            $schema,
            $id: 'https://example.com/schemas/user.schema.json',
            type: 'object',
            properties: { name: { type: 'string' }, address: userAddress },
            $defs: { Address: userAddress },
          });
          expect(spec.components.schemas.Address).toEqual(userAddress);
        });
      });

      describe('given a document with a refused $schema', () => {
        test.each([
          ['the http scheme', 'http://json-schema.org/draft/2020-12/schema'],
          ['another dialect', 'http://json-schema.org/draft-07/schema#'],
          ['a custom meta-schema', 'https://example.com/meta/schema'],
        ])('should resolve %s with the generic strategy', async (title, dialect) => {
          const spec = {
            $schema: dialect,
            properties: { pet: { $ref: '#/$defs/Pet' }, tag: { $ref: '#tag' } },
            $defs: { Pet: { type: 'object' }, Tag: { $anchor: 'tag', type: 'string' } },
          };

          expect(jsonSchema202012ApiDOMStrategy.match(spec)).toBe(false);
          expect(await SwaggerClient.resolve({ spec: structuredClone(spec) })).toEqual(
            await resolveWith(genericStrategy, { spec: structuredClone(spec) })
          );
        });
      });

      describe('given a document without a root $schema', () => {
        test('should resolve it with the generic strategy', async () => {
          const spec = {
            properties: { pet: { $ref: '#/$defs/Pet' } },
            $defs: { Pet: { $schema, type: 'object' } },
          };

          expect(await SwaggerClient.resolve({ spec: structuredClone(spec) })).toEqual(
            await resolveWith(genericStrategy, { spec: structuredClone(spec) })
          );
        });
      });
    });
  });
});
