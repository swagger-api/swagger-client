import path from 'node:path';
import http from 'node:http';
import { Buffer } from 'node:buffer';
import { File, ResolverError } from '@swagger-api/apidom-reference/configuration/empty';
import * as undici from 'undici';

import SwaggerClient from '../../../../../../../src/index.js';
import Http from '../../../../../../../src/http/index.js';
import HTTPResolverSwaggerClient from '../../../../../../../src/resolver/apidom/reference/resolve/resolvers/http-swagger-client/index.js';

describe('HTTPResolverSwaggerClient', () => {
  let resolver;
  let mockAgent;
  let originalGlobalDispatcher;

  beforeEach(() => {
    resolver = new HTTPResolverSwaggerClient();
    mockAgent = new undici.MockAgent();
    originalGlobalDispatcher = undici.getGlobalDispatcher();
    undici.setGlobalDispatcher(mockAgent);
  });

  afterEach(() => {
    undici.setGlobalDispatcher(originalGlobalDispatcher);
    mockAgent = null;
    originalGlobalDispatcher = null;
  });

  describe('canRead', () => {
    describe('given valid http URL', () => {
      test('should consider it a HTTP URL', () => {
        expect(resolver.canRead(new File({ uri: 'http://swagger.io/file.txt' }))).toBe(true);
      });
    });

    describe('given valid https URL', () => {
      test('should consider it a https URL', () => {
        expect(resolver.canRead(new File({ uri: 'https://swagger.io/file.txt' }))).toBe(true);
      });
    });

    describe('given URIs with no protocol', () => {
      test('should not consider it a http/https URL', () => {
        expect(resolver.canRead(new File({ uri: '/home/user/file.txt' }))).toBe(false);
        expect(resolver.canRead(new File({ uri: 'C:\\home\\user\\file.txt' }))).toBe(false);
      });
    });

    describe('given URLs with other known protocols', () => {
      test('should not consider it a http/https URL', () => {
        expect(resolver.canRead(new File({ uri: 'ftp://swagger.io/' }))).toBe(false);
      });
    });
  });

  describe('read', () => {
    describe('given HTTP URL', () => {
      test('should fetch the URL', async () => {
        const url = 'https://httpbin.org/anything';
        const mockPool = mockAgent.get('https://httpbin.org');
        mockPool.intercept({ path: '/anything' }).reply(200, Buffer.from('data'));
        const content = await resolver.read(new File({ uri: url }));

        expect(content).toBeInstanceOf(ArrayBuffer);
        expect(Buffer.from(content).toString()).toStrictEqual('data');
      });

      test('should throw on unexpected status codes', async () => {
        const url = 'https://httpbin.org/anything';
        const mockPool = mockAgent.get('https://httpbin.org');
        mockPool
          .intercept({ path: '/anything' })
          .replyWithError(new Error(`Error downloading "${url}"`))
          .times(2);

        const readThunk = async () => resolver.read(new File({ uri: url }));

        await expect(readThunk()).rejects.toThrow(ResolverError);
        await expect(readThunk()).rejects.toHaveProperty(
          'message',
          'Error downloading "https://httpbin.org/anything"'
        );
      });

      test('should throw on timeout', async () => {
        resolver = new HTTPResolverSwaggerClient({ timeout: 1 });
        const url = 'http://localhost:8123/local-file.txt';
        const cwd = path.join(__dirname, '__fixtures__');
        const httpServer = globalThis.createHTTPServer({ port: 8123, cwd });
        const readThunk = async () => resolver.read(new File({ uri: url }));

        await expect(readThunk()).rejects.toThrow(ResolverError);
        await expect(readThunk()).rejects.toHaveProperty(
          'message',
          'Error downloading "http://localhost:8123/local-file.txt"'
        );
        await expect(readThunk).rejects.toHaveProperty(
          'cause.message',
          expect.stringMatching(/operation was aborted/)
        );
        await httpServer.terminate();
      });

      describe('given withCredentials option', () => {
        let originalFetch;

        beforeEach(() => {
          originalFetch = globalThis.fetch;
          globalThis.fetch = jest.fn(() => new Response('data'));
        });

        afterEach(() => {
          globalThis.fetch = originalFetch;
        });

        test('should allow cross-site Access-Control requests', async () => {
          resolver = new HTTPResolverSwaggerClient({
            withCredentials: true,
          });
          const url = 'https://httpbin.org/anything';
          const readThunk = async () => {
            await resolver.read(new File({ uri: url }));
            return globalThis.fetch.mock.calls[0][1];
          };

          await expect(readThunk()).resolves.toHaveProperty('credentials', 'include');
        });
      });

      describe('given global withCredentials override', () => {
        let originalFetch;

        beforeEach(() => {
          originalFetch = globalThis.fetch;
          globalThis.fetch = jest.fn(() => new Response('data'));
        });

        afterEach(() => {
          globalThis.fetch = originalFetch;
        });

        test('should allow cross-site Access-Control requests', async () => {
          const url = 'https://httpbin.org/anything';

          const { withCredentials: originalWithCredentials } = Http;
          const readThunk = async () => {
            Http.withCredentials = true;

            try {
              await resolver.read(new File({ uri: url }));
              return globalThis.fetch.mock.calls[0][1];
            } finally {
              Http.withCredentials = originalWithCredentials;
            }
          };

          await expect(readThunk()).resolves.toHaveProperty('credentials', 'include');
        });
      });

      describe('given redirects options', () => {
        test('should throw on exceeding redirects', (done) => {
          resolver = new HTTPResolverSwaggerClient({
            redirects: 0,
          });
          const url = 'http://localhost:4444/';
          const server = http.createServer((req, res) => {
            res.setHeader('Location', '/foo');
            res.statusCode = 302;
            res.end();
          });

          expect.assertions(2);
          server.keepAliveTimeout = 50;
          server.listen(4444, async () => {
            try {
              await resolver.read(new File({ uri: url }));
            } catch (error) {
              expect(error).toBeInstanceOf(ResolverError);
              expect(error.cause).toHaveProperty('message', 'fetch failed');
            } finally {
              server.close(() => {
                done();
              });
            }
          });
        });
      });

      describe('given the Fetch API guards the response headers', () => {
        /**
         * Browsers return fetch responses whose headers can't be mutated (undici allows it),
         * so the resolver copies the response to remove its Content-Type.
         */
        const guardedResponse = (body, init, url) => {
          const response = new Response(body, init);
          ['append', 'delete', 'set'].forEach((method) => {
            Object.defineProperty(response.headers, method, {
              value: () => {
                throw new TypeError('Headers are immutable');
              },
            });
          });
          Object.defineProperty(response, 'url', { value: url });
          return response;
        };
        const mockFetch = (...args) =>
          jest.spyOn(globalThis, 'fetch').mockImplementation(async () => guardedResponse(...args));

        afterEach(() => {
          jest.restoreAllMocks();
        });

        test('should return the body of a successful response', async () => {
          const url = 'https://example.com/schema.json';
          mockFetch('data', { status: 200, headers: { 'Content-Type': 'application/json' } }, url);
          const content = await resolver.read(new File({ uri: url }));

          expect(content).toBeInstanceOf(ArrayBuffer);
          expect(Buffer.from(content).toString()).toStrictEqual('data');
        });

        test('should throw on unexpected status codes', async () => {
          const url = 'https://example.com/missing.json';
          mockFetch(
            '<html><body>Not Found</body></html>',
            { status: 404, statusText: 'Not Found', headers: { 'Content-Type': 'text/html' } },
            url
          );
          const error = await resolver.read(new File({ uri: url })).catch((e) => e);

          expect(error).toBeInstanceOf(ResolverError);
          expect(error).toHaveProperty('message', `Error downloading "${url}"`);
          expect(error.cause).toMatchObject({ message: 'Not Found', status: 404 });
        });

        test('should pass the status and URL of the response to responseInterceptor', async () => {
          const url = 'https://example.com/schema.json';
          const redirectedURL = 'https://example.com/v2/schema.json';
          const responseInterceptor = jest.fn();
          resolver = new HTTPResolverSwaggerClient({
            swaggerHTTPClientConfig: { responseInterceptor },
          });
          mockFetch(
            'data',
            { status: 203, statusText: 'Non-Authoritative', headers: { 'X-Id': '1' } },
            redirectedURL
          );
          await resolver.read(new File({ uri: url }));

          expect(responseInterceptor).toHaveBeenCalledTimes(1);
          expect(responseInterceptor.mock.calls[0][0]).toMatchObject({
            ok: true,
            status: 203,
            statusText: 'Non-Authoritative',
            url: redirectedURL,
            headers: { 'x-id': '1' },
          });
          expect(responseInterceptor.mock.calls[0][0].headers).not.toHaveProperty('content-type');
        });

        test('should report an external $ref to a missing document as an error', async () => {
          const missingURL = 'https://example.com/schemas/missing.json';
          mockFetch(
            '<html><body>Not Found</body></html>',
            { status: 404, statusText: 'Not Found', headers: { 'Content-Type': 'text/html' } },
            missingURL
          );
          const { spec, errors } = await SwaggerClient.resolve({
            spec: {
              openapi: '3.1.0',
              info: { title: 'test', version: '1.0.0' },
              components: { schemas: { User: { $ref: 'schemas/missing.json' } } },
            },
            baseDoc: 'https://example.com/openapi.json',
          });

          expect(spec.components.schemas.User).toEqual({ $ref: 'schemas/missing.json' });
          expect(errors).toHaveLength(1);
          expect(errors[0]).toMatchObject({
            message: expect.stringMatching(/^Could not resolve reference/),
            $ref: 'schemas/missing.json',
            fullPath: ['components', 'schemas', 'User', '$ref'],
          });
        });
      });
    });
  });
});
