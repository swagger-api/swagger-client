// https://github.com/swagger-api/swagger-client/issues/4316

import Swagger from '../../src/index.js';

describe('#4316: $ref JSON Pointer tokens are only percent-decoded', () => {
  test('should resolve a $ref to an application/problem+json media type', async () => {
    const spec = {
      openapi: '3.0.3',
      info: { title: 't', version: '1' },
      paths: {
        '/a': {
          get: {
            responses: {
              200: {
                description: 'ok',
                content: {
                  'application/problem+json': {
                    schema: { type: 'object', properties: { title: { type: 'string' } } },
                  },
                },
              },
            },
          },
        },
        '/b': {
          get: {
            responses: {
              200: {
                description: 'ok',
                content: {
                  'application/json': {
                    schema: {
                      $ref: '#/paths/~1a/get/responses/200/content/application~1problem+json/schema',
                    },
                  },
                },
              },
            },
          },
        },
      },
    };

    const res = await Swagger.resolve({ spec });

    expect(res.errors).toEqual([]);
    expect(
      res.spec.paths['/b'].get.responses[200].content['application/json'].schema
    ).toMatchObject({
      type: 'object',
      properties: { title: { type: 'string' } },
    });
  });

  test.each([
    ['x+y', 'x y'],
    ['a&b', 'a'],
    ['q=1&r=2', 'q=1'],
  ])('should resolve key %p, not %p', async (key, otherKey) => {
    const res = await Swagger.resolve({
      spec: {
        a: { [key]: { v: 'right' }, [otherKey]: { v: 'wrong' } },
        b: { $ref: `#/a/${key}` },
      },
    });

    expect(res.errors).toEqual([]);
    expect(res.spec.b.v).toEqual('right');
  });

  test('should still percent-decode tokens', async () => {
    const res = await Swagger.resolve({
      spec: {
        a: { 'x y': { v: 'right' }, 'x+y': { v: 'wrong' } },
        b: { $ref: '#/a/x%20y' },
      },
    });

    expect(res.errors).toEqual([]);
    expect(res.spec.b.v).toEqual('right');
  });
});
