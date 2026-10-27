import { ResolverError, HTTPResolver } from '@swagger-api/apidom-reference/configuration/empty';

import '../../../../../../helpers/abortcontroller-polyfill.node.js';
import Http from '../../../../../../http/index.js';

class HTTPResolverSwaggerClient extends HTTPResolver {
  swaggerHTTPClient = Http;

  swaggerHTTPClientConfig;

  constructor({ swaggerHTTPClient = Http, swaggerHTTPClientConfig = {}, ...rest } = {}) {
    super({ ...rest, name: 'http-swagger-client' });

    this.swaggerHTTPClient = swaggerHTTPClient;
    this.swaggerHTTPClientConfig = swaggerHTTPClientConfig;
  }

  getHttpClient() {
    return this.swaggerHTTPClient;
  }

  async read(file) {
    const client = this.getHttpClient();
    const controller = new AbortController();
    const { signal } = controller;
    const timeoutID = setTimeout(() => {
      controller.abort();
    }, this.timeout);
    const credentials =
      this.getHttpClient().withCredentials || this.withCredentials ? 'include' : 'same-origin';
    const redirect = this.redirects === 0 ? 'error' : 'follow';
    const follow = this.redirects > 0 ? this.redirects : undefined;

    try {
      const response = await client({
        url: file.uri,
        signal,
        userFetch: async (resource, options) => {
          let res = await fetch(resource, options);

          try {
            // undici supports mutations
            res.headers.delete('Content-Type');
          } catch {
            /**
             * Fetch API has guards which prevent mutations, so the response is copied.
             * status, statusText and url are getters of Response.prototype: spreading the
             * response copies none of them, which turned every response into a 200 OK.
             * The Response constructor can't set url, so the copy gets it as own property.
             */
            const { status, statusText, url } = res;
            const headers = new Headers(res.headers);
            headers.delete('Content-Type');
            res = new Response(res.body, { status, statusText, headers });
            Object.defineProperty(res, 'url', { value: url });
          }

          return res;
        },
        credentials,
        redirect,
        follow,
        ...this.swaggerHTTPClientConfig,
      });

      return response.text.arrayBuffer();
    } catch (error) {
      throw new ResolverError(`Error downloading "${file.uri}"`, { cause: error });
    } finally {
      clearTimeout(timeoutID);
    }
  }
}

export default HTTPResolverSwaggerClient;
