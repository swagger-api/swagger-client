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
        Object.values(spec.components.schemas).forEach((schema) => {
          expect(schema).not.toHaveProperty('allOf');
        });
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
        $ref: toRefMatcher('User'),
        type: 'object',
        required: ['id'],
      };

      test('should resolve entire definition and retain sibling keywords', async () => {
        const { spec, errors } = await SwaggerClient.resolve({
          spec: createSelfReferenceInAllOfSpec(openapi),
        });

        expect(errors).toEqual([]);
        expect(spec.components.schemas.User.properties.friends.items).toEqual(expectedItems);
      });

      test('should resolve subtree and retain sibling keywords', async () => {
        const { spec, errors } = await SwaggerClient.resolveSubtree(
          createSelfReferenceInAllOfSpec(openapi),
          ['components', 'schemas', 'User']
        );

        expect(errors).toEqual([]);
        expect(spec.properties.friends.items).toEqual(expectedItems);
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
