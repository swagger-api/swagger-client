import * as undici from 'undici';

import resolve from '../../../src/subtree-resolver/index.js';
import { plugins } from '../../../src/resolver/specmap/index.js';

const { refs } = plugins;

describe('subtree $ref resolver', () => {
  let mockAgent;
  let originalGlobalDispatcher;

  beforeAll(() => {
    mockAgent = new undici.MockAgent();
    originalGlobalDispatcher = undici.getGlobalDispatcher();
    undici.setGlobalDispatcher(mockAgent);
  });

  afterAll(() => {
    undici.setGlobalDispatcher(originalGlobalDispatcher);
    mockAgent = null;
    originalGlobalDispatcher = null;
  });

  beforeEach(() => {
    refs.clearCache();
  });

  test('should resolve a subtree of an object, and return the targeted subtree', async () => {
    const input = {
      a: {
        this: 'is my object',
      },
      b: {
        description: 'here is my stuff!',
        contents: {
          $ref: '#/a',
        },
      },
    };

    const res = await resolve(input, ['b']);

    expect(res).toEqual({
      errors: [],
      spec: {
        description: 'here is my stuff!',
        contents: {
          this: 'is my object',
          $$ref: '#/a',
        },
      },
    });
  });

  test('should resolve circular $refs when a baseDoc is provided', async () => {
    const input = {
      one: {
        $ref: '#/two',
      },
      two: {
        a: {
          $ref: '#/three',
        },
      },
      three: {
        b: {
          $ref: '#/two',
        },
      },
    };

    const res = await resolve(input, ['one'], {
      baseDoc: 'http://example.com/swagger.json',
      returnEntireTree: true,
    });

    expect(res).toEqual({
      errors: [],
      spec: {
        one: {
          $$ref: 'http://example.com/swagger.json#/two',
          a: {
            $$ref: 'http://example.com/swagger.json#/three',
            b: {
              $ref: 'http://example.com/swagger.json#/two',
            },
          },
        },
        two: {
          a: {
            $ref: '#/three',
          },
        },
        three: {
          b: {
            $ref: 'http://example.com/swagger.json#/two',
          },
        },
      },
    });
  });

  test('should terminate recursive external JSON Schema refs while resolving a schema subtree', async () => {
    const mockPool = mockAgent.get('http://mock.swagger.test');
    mockPool.intercept({ path: '/gdd/object.json' }).reply(
      200,
      {
        type: 'object',
        properties: {
          entries: {
            type: 'array',
            items: {
              $ref: 'http://mock.swagger.test/gdd/basic-types.json',
            },
          },
        },
      },
      { headers: { 'Content-Type': 'application/json' } }
    );
    mockPool.intercept({ path: '/gdd/basic-types.json' }).reply(
      200,
      {
        oneOf: [
          {
            type: 'array',
            items: {
              $ref: 'http://mock.swagger.test/gdd/object.json',
            },
          },
          {
            type: 'object',
            properties: {
              nested: {
                $ref: 'http://mock.swagger.test/gdd/object.json',
              },
            },
          },
        ],
      },
      { headers: { 'Content-Type': 'application/json' } }
    );

    const input = {
      openapi: '3.0.3',
      info: {
        title: 'Recursive external JSON Schema refs',
        version: '1.0.0',
      },
      paths: {},
      components: {
        schemas: {
          RenderTargetSchema: {
            type: 'object',
            properties: {
              gdd: {
                $ref: '#/components/schemas/ShallowGDDObjectSchema',
              },
            },
          },
          ShallowGDDObjectSchema: {
            allOf: [
              {
                $ref: 'http://mock.swagger.test/gdd/object.json',
              },
            ],
          },
        },
      },
    };

    const res = await resolve(input, ['components', 'schemas', 'RenderTargetSchema']);

    expect(res.errors).toEqual([]);
    expect(res.spec.properties.gdd.properties.entries.items.oneOf[0].items.$ref).toEqual(
      'http://mock.swagger.test/gdd/object.json'
    );
    expect(
      res.spec.properties.gdd.properties.entries.items.oneOf[1].properties.nested.$ref
    ).toEqual('http://mock.swagger.test/gdd/object.json');
  });

  test('should return null when the path is invalid', async () => {
    const input = {
      a: {
        this: 'is my object',
      },
      b: {
        description: 'here is my stuff!',
        contents: {
          $ref: '#/a',
        },
      },
    };

    const res = await resolve(input, ['asdfgh']);

    expect(res).toEqual({
      errors: [],
      spec: null,
    });
  });
  test('should not resolve an untargeted subtree', async () => {
    const input = {
      a: {
        this: 'is my object',
      },
      b: {
        description: 'here is my stuff!',
        contents: {
          $ref: '#/a',
        },
      },
      c: {
        $ref: '#/a',
      },
    };

    const res = await resolve(input, ['b'], {
      returnEntireTree: true,
    });

    expect(res).toEqual({
      errors: [],
      spec: {
        a: {
          this: 'is my object',
        },
        b: {
          description: 'here is my stuff!',
          contents: {
            this: 'is my object',
            $$ref: '#/a',
          },
        },
        c: {
          $ref: '#/a',
        },
      },
    });
  });
  test('should normalize Swagger 2.0 consumes', async () => {
    const input = {
      swagger: '2.0',
      consumes: ['application/json'],
      paths: {
        '/': {
          get: {
            description: 'I should have a consumes value...',
          },
        },
      },
    };

    const res = await resolve(input, ['b'], {
      returnEntireTree: true,
    });

    expect(res).toEqual({
      errors: [],
      spec: {
        $$normalized: true,
        swagger: '2.0',
        consumes: ['application/json'],
        paths: {
          '/': {
            get: {
              consumes: ['application/json'],
              description: 'I should have a consumes value...',
            },
          },
        },
      },
    });
  });
  test('should normalize Swagger 2.0 produces', async () => {
    const input = {
      swagger: '2.0',
      produces: ['application/json'],
      paths: {
        '/': {
          get: {
            description: 'I should have a produces value...',
          },
        },
      },
    };

    const res = await resolve(input, ['b'], {
      returnEntireTree: true,
    });

    expect(res).toEqual({
      errors: [],
      spec: {
        $$normalized: true,
        swagger: '2.0',
        produces: ['application/json'],
        paths: {
          '/': {
            get: {
              produces: ['application/json'],
              description: 'I should have a produces value...',
            },
          },
        },
      },
    });
  });
  test('should normalize Swagger 2.0 parameters', async () => {
    const input = {
      swagger: '2.0',
      parameters: {
        petId: {
          name: 'petId',
          in: 'path',
          description: 'ID of pet to return',
          required: true,
          type: 'integer',
          format: 'int64',
        },
      },
      paths: {
        '/': {
          parameters: [
            {
              $ref: '#/parameters/petId',
            },
          ],
          get: {
            parameters: [
              {
                name: 'name',
                in: 'formData',
                description: 'Updated name of the pet',
                required: false,
                type: 'string',
              },
              {
                name: 'status',
                in: 'formData',
                description: 'Updated status of the pet',
                required: false,
                type: 'string',
              },
            ],
          },
        },
      },
    };

    const res = await resolve(input, ['paths', '/', 'get'], {
      returnEntireTree: true,
    });

    expect(res).toEqual({
      errors: [],
      spec: {
        $$normalized: true,
        swagger: '2.0',
        parameters: {
          petId: {
            name: 'petId',
            in: 'path',
            description: 'ID of pet to return',
            required: true,
            type: 'integer',
            format: 'int64',
          },
        },
        paths: {
          '/': {
            parameters: [
              {
                $ref: '#/parameters/petId',
              },
            ],
            get: {
              parameters: [
                {
                  name: 'name',
                  in: 'formData',
                  description: 'Updated name of the pet',
                  required: false,
                  type: 'string',
                },
                {
                  name: 'status',
                  in: 'formData',
                  description: 'Updated status of the pet',
                  required: false,
                  type: 'string',
                },
                {
                  name: 'petId',
                  in: 'path',
                  description: 'ID of pet to return',
                  required: true,
                  type: 'integer',
                  format: 'int64',
                  $$ref: '#/parameters/petId',
                },
              ],
            },
          },
        },
      },
    });
  });

  test('should normalize Swagger 2.0 that use multiple $refs', async () => {
    const input = {
      swagger: '2.0',
      paths: {
        '/': {
          parameters: [
            {
              $ref: '#/parameters/One',
            },
            {
              $ref: '#/parameters/Two',
            },
          ],
          get: {
            summary: 'has no operation parameters',
          },
          delete: {
            summary: 'has own operation parameters',
            parameters: [
              {
                name: 'Three',
                in: 'query',
              },
              {
                name: 'Four',
                in: 'query',
              },
            ],
          },
        },
      },
      parameters: {
        One: {
          type: 'string',
          name: 'One',
          in: 'query',
        },
        Two: {
          type: 'string',
          name: 'Two',
          in: 'query',
        },
      },
    };

    const res = await resolve(input, ['paths', '/'], {
      returnEntireTree: true,
    });

    expect(res).toEqual({
      errors: [],
      spec: {
        $$normalized: true,
        swagger: '2.0',
        paths: {
          '/': {
            parameters: [
              {
                type: 'string',
                name: 'One',
                in: 'query',
                $$ref: '#/parameters/One',
              },
              {
                type: 'string',
                name: 'Two',
                in: 'query',
                $$ref: '#/parameters/Two',
              },
            ],
            get: {
              summary: 'has no operation parameters',
              parameters: [
                {
                  type: 'string',
                  name: 'One',
                  in: 'query',
                  $$ref: '#/parameters/One',
                },
                {
                  type: 'string',
                  name: 'Two',
                  in: 'query',
                  $$ref: '#/parameters/Two',
                },
              ],
            },
            delete: {
              summary: 'has own operation parameters',
              parameters: [
                {
                  name: 'Three',
                  in: 'query',
                },
                {
                  name: 'Four',
                  in: 'query',
                },
                {
                  type: 'string',
                  name: 'One',
                  in: 'query',
                  $$ref: '#/parameters/One',
                },
                {
                  type: 'string',
                  name: 'Two',
                  in: 'query',
                  $$ref: '#/parameters/Two',
                },
              ],
            },
          },
        },
        parameters: {
          One: {
            type: 'string',
            name: 'One',
            in: 'query',
          },
          Two: {
            type: 'string',
            name: 'Two',
            in: 'query',
          },
        },
      },
    });
  });

  test('should normalize idempotently', async () => {
    const input = {
      swagger: '2.0',
      parameters: {
        petId: {
          name: 'petId',
          in: 'path',
          description: 'ID of pet to return',
          required: true,
          type: 'integer',
          format: 'int64',
        },
      },
      paths: {
        '/': {
          parameters: [
            {
              $ref: '#/parameters/petId',
            },
          ],
          get: {
            parameters: [
              {
                name: 'name',
                in: 'formData',
                description: 'Updated name of the pet',
                required: false,
                type: 'string',
              },
              {
                name: 'status',
                in: 'formData',
                description: 'Updated status of the pet',
                required: false,
                type: 'string',
              },
            ],
          },
        },
      },
    };

    const intermediate = await resolve(input, ['paths', '/', 'get'], {
      returnEntireTree: true,
    });

    const res = await resolve(intermediate.spec, ['paths', '/', 'get'], {
      returnEntireTree: true,
    });

    expect(res).toEqual({
      errors: [],
      spec: {
        swagger: '2.0',
        $$normalized: true,
        parameters: {
          petId: {
            name: 'petId',
            in: 'path',
            description: 'ID of pet to return',
            required: true,
            type: 'integer',
            format: 'int64',
          },
        },
        paths: {
          '/': {
            parameters: [
              {
                $ref: '#/parameters/petId',
              },
            ],
            get: {
              parameters: [
                {
                  name: 'name',
                  in: 'formData',
                  description: 'Updated name of the pet',
                  required: false,
                  type: 'string',
                },
                {
                  name: 'status',
                  in: 'formData',
                  description: 'Updated status of the pet',
                  required: false,
                  type: 'string',
                },
                {
                  name: 'petId',
                  in: 'path',
                  description: 'ID of pet to return',
                  required: true,
                  type: 'integer',
                  format: 'int64',
                  $$ref: '#/parameters/petId',
                },
              ],
            },
          },
        },
      },
    });
  });

  test('should handle this odd $ref/allOf combination', async () => {
    const input = {
      definitions: {
        one: {
          $ref: '#/definitions/two',
        },
        two: {
          type: 'array',
          items: {
            $ref: '#/definitions/three',
          },
        },
        three: {
          allOf: [
            {
              properties: {
                alternate_product_code: {
                  $ref: '#/definitions/three',
                },
              },
            },
          ],
        },
      },
    };

    const res = await resolve(input, ['definitions']);

    // throw new Error(res.errors[0])
    expect(res).toEqual({
      errors: [],
      spec: {
        one: {
          $$ref: '#/definitions/two',
          type: 'array',
          items: {
            $$ref: '#/definitions/three',
            properties: {
              alternate_product_code: {
                $ref: '#/definitions/three',
              },
            },
          },
        },
        two: {
          type: 'array',
          items: {
            $$ref: '#/definitions/three',
            properties: {
              alternate_product_code: {
                $ref: '#/definitions/three',
              },
            },
          },
        },
        three: {
          properties: {
            alternate_product_code: {
              $ref: '#/definitions/three',
            },
          },
        },
      },
    });
  });

  test('should resolve nested allOf with $ref with no influence of order of schemas', async () => {
    const input = {
      components: {
        schemas: {
          Second: { allOf: [{ $ref: '#/components/schemas/Third' }] },
          First: { allOf: [{ $ref: '#/components/schemas/Second' }] },
          Third: { allOf: [{ $ref: '#/components/schemas/Fourth' }] },
          Fourth: { allOf: [{ $ref: '#/components/schemas/Fifth' }] },
          Fifth: { properties: { a: { type: 'string' } } },
        },
      },
    };

    const res = await resolve(input, ['components', 'schemas', 'First']);

    expect(res).toEqual({
      errors: [],
      spec: {
        properties: {
          a: {
            type: 'string',
          },
        },
      },
    });
  });

  test('should resolve complex allOf correctly', async () => {
    const input = {
      definitions: {
        Simple1: {
          type: 'object',
          properties: {
            id1: {
              type: 'integer',
              format: 'int64',
            },
          },
        },
        Simple2: {
          type: 'object',
          properties: {
            id2: {
              type: 'integer',
              format: 'int64',
            },
          },
        },
        Composed: {
          allOf: [
            {
              $ref: '#/definitions/Simple1',
            },
            {
              $ref: '#/definitions/Simple2',
            },
          ],
        },
      },
    };

    const res = await resolve(input, ['definitions', 'Composed']);

    expect(res).toEqual({
      errors: [],
      spec: {
        type: 'object',
        properties: {
          id1: {
            type: 'integer',
            format: 'int64',
          },
          id2: {
            type: 'integer',
            format: 'int64',
          },
        },
      },
    });
  });

  test('should fully resolve across remote documents correctly', async () => {
    const mockPool = mockAgent.get('http://example.com');
    mockPool.intercept({ path: '/remote.json' }).reply(
      200,
      {
        baz: {
          $ref: '#/remoteOther',
        },
        remoteOther: {
          result: 'it works!',
        },
      },
      { headers: { 'Content-Type': 'application/json' } }
    );
    const input = {
      foo: {
        bar: {
          $ref: './remote.json',
        },
      },
    };
    const res = await resolve(input, [], {
      baseDoc: 'http://example.com/main.json',
    });

    expect(res).toEqual({
      errors: [],
      spec: {
        foo: {
          bar: {
            $$ref: 'http://example.com/remote.json',
            baz: {
              $$ref: 'http://example.com/remote.json#/remoteOther',
              result: 'it works!',
            },
            remoteOther: {
              result: 'it works!',
            },
          },
        },
      },
    });
  });

  test('should redirect and resolve nested remote document requests', async () => {
    const mockPool = mockAgent.get('http://example.com');
    mockPool.intercept({ path: '/remote.json', headers: { authorization: 'wow' } }).reply(
      200,
      {
        baz: {
          $ref: '#/remoteOther',
        },
        remoteOther: {
          $ref: './fake-nested.json',
        },
      },
      { headers: { 'Content-Type': 'application/json' } }
    );
    mockPool.intercept({ path: '/remote.json' }).reply(403);
    mockPool
      .intercept({ path: '/nested.json', headers: { authorization: 'wow' } })
      .reply(200, { result: 'it works!' }, { headers: { 'Content-Type': 'application/json' } });
    mockPool.intercept({ path: '/nested.json' }).reply(403);

    const input = {
      foo: {
        bar: {
          $ref: './fake-remote.json',
        },
      },
    };
    const requestInterceptor = jest.fn((req) => {
      req.headers.authorization = 'wow';

      if (req.url === 'http://example.com/fake-remote.json') {
        req.url = 'http://example.com/remote.json';
      }
      if (req.url === 'http://example.com/fake-nested.json') {
        req.url = 'http://example.com/nested.json';
      }
      return req;
    });
    const res = await resolve(input, [], {
      baseDoc: 'http://example.com/main.json',
      requestInterceptor,
    });

    expect(requestInterceptor.mock.calls.length).toEqual(2);
    expect(requestInterceptor.mock.calls[0][0].url).toEqual('http://example.com/remote.json');
    expect(requestInterceptor.mock.calls[1][0].url).toEqual('http://example.com/nested.json');

    expect(res).toEqual({
      errors: [],
      spec: {
        foo: {
          bar: {
            $$ref: 'http://example.com/fake-remote.json',
            baz: {
              $$ref: 'http://example.com/fake-nested.json',
              result: 'it works!',
            },
            remoteOther: {
              $$ref: 'http://example.com/fake-nested.json',
              result: 'it works!',
            },
          },
        },
      },
    });
  });
});
