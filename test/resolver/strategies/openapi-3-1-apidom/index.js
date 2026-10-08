import path from 'node:path';
import * as undici from 'undici';

import SwaggerClient from '../../../../src/index.js';

const fixturePath = path.join(__dirname, '__fixtures__');

describe('resolve', () => {
  let mockAgent;
  let originalGlobalDispatcher;

  beforeEach(() => {
    mockAgent = new undici.MockAgent();
    originalGlobalDispatcher = undici.getGlobalDispatcher();
    undici.setGlobalDispatcher(mockAgent);
  });

  afterEach(() => {
    undici.setGlobalDispatcher(originalGlobalDispatcher);
    mockAgent = null;
    originalGlobalDispatcher = null;
  });

  describe('OpenAPI 3.1.0 strategy', () => {
    test('should expose a resolver function', () => {
      expect(SwaggerClient.resolve).toBeInstanceOf(Function);
    });

    describe('given OpenAPI 3.1.0 definition via URL', () => {
      test('should resolve', async () => {
        const url = 'https://example.com/petstore.json';
        const mockPool = mockAgent.get('https://example.com');
        mockPool
          .intercept({ path: 'petstore.json' })
          .reply(200, globalThis.loadFile(path.join(fixturePath, 'petstore.json')));
        const resolvedSpec = await SwaggerClient.resolve({
          url,
          allowMetaPatches: false,
        });

        expect(resolvedSpec).toMatchSnapshot();
      });

      describe('and allowMetaPatches=true', () => {
        test('should resolve', async () => {
          const url = 'https://example.com/petstore.json';
          const mockPool = mockAgent.get('https://example.com');
          mockPool
            .intercept({ path: 'petstore.json' })
            .reply(200, globalThis.loadFile(path.join(fixturePath, 'petstore.json')));
          const resolvedSpec = await SwaggerClient.resolve({
            url,
            allowMetaPatches: true,
          });

          expect(resolvedSpec).toMatchSnapshot();
        });
      });

      describe('and allowMetaPatches=false', () => {
        test('should resolve', async () => {
          const url = 'https://example.com/petstore.json';
          const mockPool = mockAgent.get('https://example.com');
          mockPool
            .intercept({ path: 'petstore.json' })
            .reply(200, globalThis.loadFile(path.join(fixturePath, 'petstore.json')));
          const resolvedSpec = await SwaggerClient.resolve({
            url,
            allowMetaPatches: false,
          });

          expect(resolvedSpec).toMatchSnapshot();
        });
      });

      describe('and useCircularStructures=true', () => {
        test('should resolve', async () => {
          const url = 'https://example.com/circular-structures.json';
          const mockPool = mockAgent.get('https://example.com');
          mockPool
            .intercept({ path: '/circular-structures.json' })
            .reply(200, globalThis.loadFile(path.join(fixturePath, 'circular-structures.json')));
          const resolvedSpec = await SwaggerClient.resolve({
            url,
            useCircularStructures: true,
          });

          expect(resolvedSpec).toMatchSnapshot();
        });
      });

      describe('and useCircularStructures=false', () => {
        test('should resolve', async () => {
          const url = 'https://example.com/circular-structures.json';
          const mockPool = mockAgent.get('https://example.com');
          mockPool
            .intercept({ path: '/circular-structures.json' })
            .reply(200, globalThis.loadFile(path.join(fixturePath, 'circular-structures.json')));
          const resolvedSpec = await SwaggerClient.resolve({
            url,
            useCircularStructures: false,
          });

          expect(resolvedSpec).toMatchSnapshot();
        });
      });
    });

    describe('given OpenAPI 3.1.0 definition via spec option', () => {
      describe('and neither baseDoc nor url option is provided', () => {
        test('should resolve using implicit baseURI=https://smartbear.com/', async () => {
          const spec = globalThis.loadJsonFile(path.join(fixturePath, 'petstore.json'));
          const resolvedSpec = await SwaggerClient.resolve({
            spec,
            allowMetaPatches: true, // used only to assert on resolved baseURI within the snapshot
          });

          expect(resolvedSpec).toMatchSnapshot();
        });
      });

      describe('and baseDoc option is provided', () => {
        test('should resolve', async () => {
          const spec = globalThis.loadJsonFile(path.join(fixturePath, 'petstore.json'));
          const resolvedSpec = await SwaggerClient.resolve({
            spec,
            baseDoc: 'https://example.com/',
          });

          expect(resolvedSpec).toMatchSnapshot();
        });

        describe('and baseDoc option is a relative reference', () => {
          test('should resolve the definition with the resolved baseDoc', async () => {
            const spec = globalThis.loadJsonFile(path.join(fixturePath, 'petstore.json'));
            const resolvedSpec = await SwaggerClient.resolve({
              spec,
              baseDoc: './petstore.json',
              allowMetaPatches: true, // used only to assert on resolved baseURI within the snapshot
            });

            expect(resolvedSpec).toMatchSnapshot();
          });
        });

        describe('and baseDoc option has a non-http(s) scheme', () => {
          test('should dereference internal $refs', async () => {
            const spec = globalThis.loadJsonFile(path.join(fixturePath, 'petstore.json'));
            const resolvedSpec = await SwaggerClient.resolve({
              spec,
              baseDoc: 'file:///app/index.html',
            });

            expect(resolvedSpec.errors).toEqual([]);
            expect(
              resolvedSpec.spec.paths['/pets'].get.responses['200'].content['application/json']
                .schema
            ).toMatchObject({ type: 'array' });
          });
        });
      });

      describe('and url option is provided', () => {
        test('should resolve', async () => {
          const spec = globalThis.loadJsonFile(path.join(fixturePath, 'petstore.json'));
          const resolvedSpec = await SwaggerClient.resolve({
            spec,
            url: 'https://example.com/',
          });

          expect(resolvedSpec).toMatchSnapshot();
        });
      });

      describe('and skipNormalization=true', () => {
        test('should resolve and skip normalization', async () => {
          const spec = globalThis.loadJsonFile(path.join(fixturePath, 'petstore.json'));
          const resolvedSpec = await SwaggerClient.resolve({
            spec,
            skipNormalization: true,
          });

          expect(resolvedSpec).toMatchSnapshot();
        });
      });

      describe('and skipNormalization=false', () => {
        test('should resolve and normalize', async () => {
          const spec = globalThis.loadJsonFile(path.join(fixturePath, 'petstore.json'));
          const resolvedSpec = await SwaggerClient.resolve({
            spec,
            skipNormalization: false,
          });

          expect(resolvedSpec).toMatchSnapshot();
        });
      });

      describe('and pathDiscriminator is empty list', () => {
        test('should resolve entire spec', async () => {
          const spec = globalThis.loadJsonFile(path.join(fixturePath, 'petstore.json'));
          const resolvedSpec = await SwaggerClient.resolve({
            spec,
            pathDiscriminator: [],
          });

          expect(resolvedSpec).toMatchSnapshot();
        });
      });

      describe('and pathDiscriminator=[paths, /pets]', () => {
        test('should resolve within the pathDiscriminator', async () => {
          const spec = globalThis.loadJsonFile(path.join(fixturePath, 'petstore.json'));
          const resolvedSpec = await SwaggerClient.resolve({
            spec,
            pathDiscriminator: ['paths', '/pets'],
          });

          expect(resolvedSpec).toMatchSnapshot();
        });
      });

      describe('and pathDiscriminator compiles into invalid JSON Pointer', () => {
        test('should not resolve', async () => {
          const spec = globalThis.loadJsonFile(path.join(fixturePath, 'petstore.json'));
          const resolvedSpec = await SwaggerClient.resolve({
            spec,
            pathDiscriminator: ['path', 'to', 'nothing'],
          });

          expect(resolvedSpec).toEqual({ spec, errors: [] });
        });
      });

      describe('and parameterMacro is provided sa a function', () => {
        test('should call parameterMacro with Operation and Parameter Objects', async () => {
          const spec = globalThis.loadJsonFile(path.join(fixturePath, 'parameter-macro.json'));
          const resolvedSpec = await SwaggerClient.resolve({
            spec,
            parameterMacro: (operation, parameter) => `${operation.operationId}-${parameter.name}`,
          });

          expect(resolvedSpec).toMatchSnapshot();
        });

        test('should call parameterMacro with Parameter Object only', async () => {
          const spec = globalThis.loadJsonFile(
            path.join(fixturePath, 'parameter-macro-no-operation.json')
          );
          const resolvedSpec = await SwaggerClient.resolve({
            spec,
            parameterMacro: (operation, parameter) => `${String(operation)}-${parameter.name}`,
          });

          expect(resolvedSpec).toMatchSnapshot();
        });

        describe('given the function throws error', () => {
          test('should collect error', async () => {
            const spec = globalThis.loadJsonFile(path.join(fixturePath, 'parameter-macro.json'));
            const { spec: resolvedSpec, errors } = await SwaggerClient.resolve({
              spec,
              parameterMacro: () => {
                throw new Error('this macro throws');
              },
            });

            expect(resolvedSpec).toMatchSnapshot();
            expect(errors).toHaveLength(1);
            expect(errors[0]).toMatchObject({
              message: expect.stringMatching(/^Error: this macro throws/),
              fullPath: ['paths', '/pets', 'get', 'parameters'],
            });
          });
        });
      });

      describe('and modelPropertyMacro is provided as a function', () => {
        test('should call modelPropertyMacro with Schema Object property', async () => {
          const spec = globalThis.loadJsonFile(path.join(fixturePath, 'model-property-macro.json'));
          const resolvedSpec = await SwaggerClient.resolve({
            spec,
            modelPropertyMacro: (property) => `${property.type}-3`,
          });

          expect(resolvedSpec).toMatchSnapshot();
        });

        describe('given the function throws error', () => {
          test('should collect error', async () => {
            const spec = globalThis.loadJsonFile(
              path.join(fixturePath, 'model-property-macro-error.json')
            );
            const { spec: resolvedSpec, errors } = await SwaggerClient.resolve({
              spec,
              modelPropertyMacro: () => {
                throw new Error('this macro throws');
              },
            });

            expect(resolvedSpec).toMatchSnapshot();
            expect(errors).toHaveLength(1);
            expect(errors[0]).toMatchObject({
              message: expect.stringMatching(/^Error: this macro throws/),
              fullPath: ['components', 'schemas', 'Pet', 'properties'],
            });
          });
        });
      });

      describe('and modelPropertyMacro and parameterMacro are provided as functions', () => {
        test('should call functions on dereferenced Objects which contained allOf', async () => {
          const spec = globalThis.loadJsonFile(path.join(fixturePath, 'ref-all-of-macros.json'));
          const resolvedSpec = await SwaggerClient.resolve({
            spec,
            modelPropertyMacro: (property) => `${property.type}-test`,
            parameterMacro: (operation, parameter) =>
              operation ? `${operation.operationId}-${parameter.name}` : parameter.name,
          });

          expect(resolvedSpec).toMatchSnapshot();
        });
      });
    });
  });
});
