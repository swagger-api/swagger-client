// https://github.com/swagger-api/swagger-client/issues/3858
// https://github.com/swagger-api/swagger-ui/issues/10583

import SwaggerClient from '../../src/index.js';

/**
 * Specs are created by factories, as the OpenAPI 3.x resolvers cache
 * refracted specs by object identity and mutate them in place.
 */
const createCycleInAllOfSpec = (openapi) => ({
  openapi,
  components: {
    schemas: {
      First: {
        allOf: [{ $ref: '#/components/schemas/Second' }],
      },
      Second: {
        allOf: [{ $ref: '#/components/schemas/Third' }],
      },
      Third: {
        allOf: [{ $ref: '#/components/schemas/Second' }],
      },
    },
  },
});

const createSelfReferenceInAllOfSpec = (openapi) => ({
  openapi,
  components: {
    schemas: {
      User: {
        type: 'object',
        properties: {
          id: { type: 'integer' },
          friends: {
            type: 'array',
            items: {
              allOf: [{ $ref: '#/components/schemas/User' }, { type: 'object', required: ['id'] }],
            },
          },
        },
      },
    },
  },
});

/**
 * A polymorphic hierarchy: Base lists its children in oneOf and each child extends Base via allOf.
 * Which circular $ref is replaced depends on the order in which schemas are dereferenced,
 * so the schema order and the referenced schema are varied by the tests.
 */
const createPolymorphicSpec = (openapi, schemaOrder, target) => {
  const schemas = {
    A: { allOf: [{ $ref: '#/components/schemas/Base' }] },
    B: { allOf: [{ $ref: '#/components/schemas/Base' }] },
    Base: {
      oneOf: [{ $ref: '#/components/schemas/A' }, { $ref: '#/components/schemas/B' }],
    },
  };
  return {
    openapi,
    paths: {
      '/x': {
        put: {
          requestBody: {
            content: {
              'application/json': { schema: { $ref: `#/components/schemas/${target}` } },
            },
          },
          responses: { 204: { description: 'ok' } },
        },
      },
    },
    components: { schemas: Object.fromEntries(schemaOrder.map((name) => [name, schemas[name]])) },
  };
};

const polymorphicSchemaOrders = [
  ['A', 'Base', 'B'],
  ['A', 'B', 'Base'],
  ['B', 'A', 'Base'],
  ['B', 'Base', 'A'],
  ['Base', 'A', 'B'],
  ['Base', 'B', 'A'],
];

const toRefMatcher = (name) => expect.stringMatching(new RegExp(`#/components/schemas/${name}$`));

describe.each(['3.1.0', '3.2.0'])(
  '#3858: allOf with circular references (OpenAPI %s)',
  (openapi) => {
    describe('given schemas referencing each other in a cycle via allOf', () => {
      test('should resolve entire definition without errors', async () => {
        const { spec, errors } = await SwaggerClient.resolve({
          spec: createCycleInAllOfSpec(openapi),
        });

        expect(errors).toEqual([]);
        // allOf containing a circular reference is left as is, merging it could create cycles
        expect(spec.components.schemas.Third.allOf).toEqual([{ $ref: toRefMatcher('Second') }]);
      });

      test.each(['First', 'Second', 'Third'])(
        'should resolve subtree of %s without errors',
        async (schemaName) => {
          const { spec, errors } = await SwaggerClient.resolveSubtree(
            createCycleInAllOfSpec(openapi),
            ['components', 'schemas', schemaName]
          );

          expect(errors).toEqual([]);
          expect(spec).not.toHaveProperty('allOf');
        }
      );
    });

    describe('given self-referencing schema in allOf with additional constraints', () => {
      const expectedItems = {
        allOf: [{ $ref: toRefMatcher('User') }, { type: 'object', required: ['id'] }],
      };

      test('should resolve entire definition and leave allOf unmerged', async () => {
        const { spec, errors } = await SwaggerClient.resolve({
          spec: createSelfReferenceInAllOfSpec(openapi),
        });

        expect(errors).toEqual([]);
        expect(spec.components.schemas.User.properties.friends.items).toEqual(expectedItems);
      });

      test('should resolve subtree and leave allOf unmerged', async () => {
        const { spec, errors } = await SwaggerClient.resolveSubtree(
          createSelfReferenceInAllOfSpec(openapi),
          ['components', 'schemas', 'User']
        );

        expect(errors).toEqual([]);
        expect(spec.properties.friends.items).toEqual(expectedItems);
      });
    });

    describe('given a base schema with several children extending it via allOf', () => {
      describe.each(['A', 'B', 'Base'])('referenced from a path via %s', (target) => {
        test.each(polymorphicSchemaOrders)(
          'should resolve without errors and without overflowing the stack (schema order %s, %s, %s)',
          async (...schemaOrder) => {
            const { errors } = await SwaggerClient.resolve({
              spec: createPolymorphicSpec(openapi, schemaOrder, target),
            });

            expect(errors).toEqual([]);
          }
        );
      });

      describe.each(['A', 'B', 'Base'])('subtree of %s', (name) => {
        test.each(polymorphicSchemaOrders)(
          'should resolve without errors (schema order %s, %s, %s)',
          async (...schemaOrder) => {
            const { errors } = await SwaggerClient.resolveSubtree(
              createPolymorphicSpec(openapi, schemaOrder, 'Base'),
              ['components', 'schemas', name]
            );

            expect(errors).toEqual([]);
          }
        );
      });
    });

    describe('given allOf contains non-object item', () => {
      test('should still collect error', async () => {
        const { errors } = await SwaggerClient.resolve({
          spec: {
            openapi,
            components: {
              schemas: {
                User: {
                  allOf: [{ $ref: '#/components/schemas/User' }, 1],
                },
              },
            },
          },
        });

        expect(errors).toHaveLength(1);
        expect(errors[0]).toMatchObject({
          message: expect.stringMatching(/^Elements in allOf must be objects/),
          fullPath: ['components', 'schemas', 'User', 'allOf'],
        });
      });
    });
  }
);
