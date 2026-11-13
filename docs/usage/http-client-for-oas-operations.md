# HTTP client for OAS operations

HTTP client for OAS operations is an OpenAPI specific HTTP client for OAS operations.
It maps an OAS operation and values into an HTTP request.

To execute an OAS operation, you need to provide HTTP client for OAS operations with various properties.

Type notations are formatted like so:

- `String=""` means a String type with a default value of `""`.
- `String=["a"*, "b", "c", "d"]` means a String type that can be `a, b, c, or d`, with the `*` indicating that `a` is the default value.

Property | Description
--- | ---
`spec` | `Object`, **REQUIRED**. OpenAPI definition represented as [POJO](https://en.wikipedia.org/wiki/Plain_old_Java_object).
`operationId` | `String`. Unique string used to identify an operation. If not provided, `pathName` + `method` must be used instead.
`pathName` | `String`. OpenAPI defines a unique operation as a combination of a path and an HTTP method. If `operationId` is not provided, this property must be set.
`method` | `String=["GET", "HEAD", "POST", "PUT", "DELETE", "CONNECT", "OPTIONS", "TRACE", "PATCH"]`. OpenAPI defines a unique operation as a combination of a path and an HTTP method. If `operationId` is not provided, this property must be set.
`parameters` | `Object`. Parameters object, eg: `{ q: 'search string' }`. Parameters not defined in `spec` will be ignored.
`parameterBuilders` | `Object=null`. When provided in shape of `{ body: Function, header: Function, query: Function, path: Function, formData: Function }`, it can fully control how parameters of various types are built. This library comes with two default parameter builders: [OpenAPI 2.x builders](https://github.com/swagger-api/swagger-client/blob/main/src/execute/swagger2/parameter-builders.js) and [OpenAPI 3.0.x builders](https://github.com/swagger-api/swagger-client/blob/main/src/execute/oas3/parameter-builders.js).   
`securities` | `Object`. Maps security schemes to a request. Securities not defined in `spec` will be ignored. <br/><br/>*Examples*<br /><br /> *Bearer:* `{ authorized: { BearerAuth: {value: "3492342948239482398"} } }` <br /><br /> *Basic:* `{ authorized: { BasicAuth: { username: 'login', password: 'secret' } } }` <br /><br /> *ApiKey:* `{ authorized: { ApiKey: { value: '234934239' } } }` <br /><br /> *oAuth2:* `{ authorized: { oAuth2: { token: { access_token: '234934239' } } } }`
`requestInterceptor` | `Function=identity`. Either synchronous or asynchronous function transformer that accepts `Request` and should return `Request`.  
`responseInterceptor` | `Function=identity`. Either synchronous or asynchronous function transformer that accepts `Response` and should return `Response`.
`requestContentType` | `String`. Sets [appropriate media type](https://swagger.io/docs/specification/describing-request-body/) for request body, e.g. `application/json`. If supplied media type is not defined for the request body, this property is ignored.
`responseContentType` | `String`. Expect [appropriate media type](https://swagger.io/docs/specification/describing-responses/) response, e.g. `application/json`. Creates an `Accept` header in `Request` object.
`attachContentTypeForEmptyPayload` | `Boolean=false`. Attaches a `Content-Type` header to a `Request` even when no payload was provided for the `Request`.
`http` | `Function=Http`. A function with an interface compatible with [HTTP Client](http-client.md).
`userFetch` | `Function=cross-fetch`. Custom **asynchronous** fetch function that accepts two arguments: the `url` and the `Request` object and must return a [Response](https://developer.mozilla.org/en-US/docs/Web/API/Response) object. More info in [HTTP Client](http-client.md) documentation.
`signal` | `AbortSignal=null`. AbortSignal object instance, which can be used to abort a request as desired.
`server` | `String`. URL (`https://example.com`) or relative URI Reference (`/path/subpath`). Must match with of the defined `Server Objects`. If matched, it will be prepended to every requested path.
`serverVariableEncoder` | `Function=identity`. An encoder function that is run on a server variable before substituted to the URL template.
`contextUrl` | `String`. URL, e.g. `https://example.com`. Used in following situations: <br /><br />If `server` option is not matched and there is no `Server Object` defined in the definition, this URL will be prepended to every requested path.<br /><br />If matched `Server Object` is defined as relative URI Reference its `url` fixed field is resolved against `contenxtUrl`. Resolved URL will be prepended to every requested path. 
`baseURL` | `String`. URL (`https://example.com`) . Takes precedence over server and any defined servers in the Spec. It will be prepended to every requested path.

For all later references, we will always use following OpenAPI 3.0.4 definition when referring
to a `spec`.

```yaml
openapi: 3.0.4
info:
  title: Testing API
  version: 1.0.0
components:
  schemas:
    user:
      properties:
        id:
          type: integer
  securitySchemes:
    BasicAuth:
      type: http
      scheme: basic
    ApiKey:
      type: apiKey
      in: header
      name: X-API-KEY
    BearerAuth:
      type: http
      scheme: bearer
    oAuth2:
      type: oauth2
      flows:
        implicit:
          authorizationUrl: 'https://api.example.com/oauth2/authorize'
          scopes:
            read: authorize to read
servers:
  - url: 'http://localhost:8080'
  - url: '/'  
paths:
  /users:
    get:
      operationId: getUserList
      description: Get list of users
      security:
        - BasicAuth: []
          BearerAuth: []
          ApiKey: []
          oAuth2: []
      parameters:
        - name: q
          in: query
          description: search query parameter
          schema:
            type: array
            items:
              type: string
          style: pipeDelimited
          explode: false  
      responses:
        '200':
          description: List of users
          content:
            application/json:
              schema:
                $ref: '#/components/schemas/user'
```

Use [swagger editor](https://editor.swagger.io/) to convert this [YAML](https://en.wikipedia.org/wiki/YAML) OpenAPI definition
to [JSON](https://en.wikipedia.org/wiki/JSON); `File` -> `Convert and save as JSON`. We'll assign this `JSON` to variable called
`pojoDefinition` and use it in later examples.

Above OpenAPI definitions describes following API implemented in `node.js`:

```js
const http = require('http');

const getUserList = (req, res) => {
  res.setHeader('Content-Type', 'application/json');
  res.writeHead(200);
  res.end('[{"id":"value"}]');
};

const requestListener = (req, res) => {
  if (req.url.startsWith('/users')) {
    getUserList(req, res);
  } else {
    res.setHeader('Content-Type', 'text/plain');
    res.writeHead(404);
    res.end('Not found');
  }
};

const server = http.createServer(requestListener);
server.listen(8080);
```

### Executing an operation

Executing an OAS operation is as simple as calling `SwaggerClient.execute` static method.

*Using operationId*

```js
import SwaggerClient from 'swagger-client';

SwaggerClient.execute({
  spec: pojoDefinition,
  operationId: 'getUserList',
  // Parameters that accepts multiple values are provided as arrays ['search1', 'search2'].
  // ['search1', 'search2'] will result results in `?q=search1|search2`
  // depending on serialization options defined by `style` and `explode`.
  parameters: { q: 'search string' }, 
  securities: { authorized: { BearerAuth: "3492342948239482398" } },
}); // => Promise.<Response>
```

*Using unique pathName + method combination*

```js
import SwaggerClient from 'swagger-client';

SwaggerClient.execute({
  spec: pojoDefinition,
  pathName: '/users',
  method: 'get',
  parameters: { q: 'search string' },
  securities: { authorized: { BearerAuth: "3492342948239482398" } },
}); // => Promise.<Response>
```

*Using `server` option*

We can use `server` option to pick one of the defined `Server Objects` in the definition
to send requests against.

```js
SwaggerClient.execute({
  spec: pojoDefinition,
  operationId: 'getUserList',
  parameters: { q: 'search string' }, 
  securities: { authorized: { BearerAuth: "3492342948239482398" } },
  server: 'http://localhost:8080',
}); // => Promise.<Response>
```

*Using `contextUrl` as fallback*

We can use `contextUrl` in case when no `Server Objects` are defined in the definition,
or the `Server Objects` are defined as relative URI References.

```js
SwaggerClient.execute({
  spec: pojoDefinition,
  operationId: 'getUserList',
  parameters: { q: 'search string' }, 
  securities: { authorized: { BearerAuth: "3492342948239482398" } },
  server: '/',
  contextUrl: 'https://example.com', 
}); // => Promise.<Response>
```

#### Request cancellation with AbortSignal

You may cancel requests with [AbortController](https://developer.mozilla.org/en-US/docs/Web/API/AbortController).
The AbortController interface represents a controller object that allows you to abort one or more Web requests as and when desired.
Using AbortController, you can easily implement request timeouts.

###### Node.js

AbortController is available globally in all supported Node.js versions (Node.js >= 22).
No need to install it explicitly.

```js
const SwaggerClient = require('swagger-client');

const controller = new AbortController();
const { signal } = controller;
const timeout = setTimeout(() => {
  controller.abort();
}, 1);

(async () => {
  try {
    await SwaggerClient.execute({
      spec,
      pathName: '/users',
      method: 'get',
      parameters: { q: 'search string' },
      securities: { authorized: { BearerAuth: "3492342948239482398" } },
      signal,
    });
  } catch (error) {
    if (error.name === 'AbortError') {
      console.error('request was aborted');
    }
  } finally {
    clearTimeout(timeout);
  }
})();
```

###### Browser

AbortController is part of modern [Web APIs](https://developer.mozilla.org/en-US/docs/Web/API/AbortController).
No need to install it explicitly.

```html
<html>
  <head>
    <script src="//unpkg.com/swagger-client"></script>
    <script>
        const controller = new AbortController();
        const { signal } = controller;
        const timeout = setTimeout(() => {
          controller.abort();
        }, 1);

        (async () => {
          try {
            await SwaggerClient.execute({
              spec,
              pathName: '/users',
              method: 'get',
              parameters: { q: 'search string' },
              securities: { authorized: { BearerAuth: "3492342948239482398" } },
              signal,
            });
          } catch (error) {
            if (error.name === 'AbortError') {
              console.error('request was aborted');
            }
          } finally {
            clearTimeout(timeout);
          }
        })();
    </script>
  </head>
  <body>
    check console in browser's dev. tools
  </body>
</html>
```

#### Alternate API

It's also possible to call `execute` method from `SwaggerClient` instance.


```js
import SwaggerClient from 'swagger-client';

new SwaggerClient({ spec: pojoDefinition, authorizations: { BearerAuth: "3492342948239482398" } })
  .then(
    client => client.execute({
      operationId: 'getUserList',
      parameters: { q: 'search string' },
    })
  ); // => Promise.<Response>
```

### Building a Request

You can build a `Request` object from an OAS operation and feed it later to the [HTTP Client](http-client.md).

```js
import SwaggerClient from 'swagger-client';

const request = SwaggerClient.buildRequest({
  spec: pojoDefinition,
  operationId: 'getUserList',
  parameters: { q: 'search string' },
  securities: { authorized: { BearerAuth: "3492342948239482398" }},
  responseContentType: 'application/json',
});
/*
 * {
 *   url: 'http://localhost:8080/users?q=search%20string',
 *   credentials: 'same-origin',
 *   headers: {
 *     accept: 'application/json',
 *     Authorization: 'Bearer 3492342948239482398'
 *   },
 *   method: 'GET'
 * }
 */

SwaggerClient.http(request); // => Promise.<Response>
``` 
