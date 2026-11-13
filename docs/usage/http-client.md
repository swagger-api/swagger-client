# HTTP Client

Our HTTP Client exposes a [Fetch-like interface](https://github.com/lquixada/cross-fetch) with a twist: making url part of the request object. 
It extends [Fetch API](https://developer.mozilla.org/en-US/docs/Web/API/Fetch_API/Using_Fetch) to support request and response interceptors and
performs response & header serialization. 

Here is a simple example how to make `POST` HTTP request:

```js
import SwaggerClient from 'swagger-client';

const request = {
  url: 'https://httpbin.org/post',
  mode: 'cors',
  method: 'POST',
  body: { data: 3 },
  headers: {
    'Content-Type': 'application/json',
  },
};

SwaggerClient.http(request); // => Promise(Response)
```

Here is an example how to make `POST` HTTP request via [Fetch compatible interface](https://developer.mozilla.org/en-US/docs/Web/API/Fetch_API).

```js
import SwaggerClient from 'swagger-client';

const url = 'https://httpbin.org/post';
const request = {
  url, // notice the url must always be part of Request object
  mode: 'cors',
  method: 'POST',
  body: { data: 3 },
  headers: {
    'Content-Type': 'application/json',
  },
};

SwaggerClient.http(url, request); // => Promise(Response)
```

### Request

If you prefer using object literal to represent [Fetch compatible Request](https://developer.mozilla.org/en-US/docs/Web/API/Request/Request)
here is how you can create a new request.

```js
const request = {
  url: 'https://httpbin.org/post',
  mode: 'cors',
  method: 'POST',
  body: { data: 3 },
  headers: {
    'Content-Type': 'application/json',
  },
};
```

It is also possible to use instance of [Fetch compatible Request](https://developer.mozilla.org/en-US/docs/Web/API/Request/Request) class 
either the one that is native to browsers or provided by 3rd party libraries like [cross-fetch](https://github.com/lquixada/cross-fetch).

```js
const request = new Request('https://httpbin.org/post', {
  mode: 'cors',
  method: 'POST',
  body: { data: 3 },
  headers: {
    'Content-Type': 'application/json',
  },
});
```

You can find documentation of all allowed `Request` properties in [official documentation of Fetch compatible Request](https://developer.mozilla.org/en-US/docs/Web/API/Request).

Additional Request properties are described in the following table.

Type notations are formatted like so:

- `String=""` means a String type with a default value of `""`.
- `String=["a"*, "b", "c", "d"]` means a String type that can be `a, b, c, or d`, with the `*` indicating that `a` is the default value.

Property | Description
--- | ---
`query` | `Object=null`. When provided, HTTP Client serialize it and appends the `queryString` to `Request.url` property.
`loadSpec` | `Boolean=undefined`. This property will be present and set to `true` when the `Request` was constructed internally by `SwaggerClient` to fetch the OAS definition defined by `url` or when resolving remote JSON References.
`requestInterceptor` | `Function=identity`. Either synchronous or asynchronous function transformer that accepts `Request` and should return `Request`.  
`responseInterceptor` | `Function=identity`. Either synchronous or asynchronous function transformer that accepts `Response` and should return `Response`.
`userFetch` | `Function=cross-fetch`. Custom **asynchronous** fetch function that accepts two arguments: the `url` and the `Request` object and must return a [Response](https://developer.mozilla.org/en-US/docs/Web/API/Response) object.

##### Query support

HTTP Client support serialization of additional [query parameters](https://developer.mozilla.org/en-US/docs/Web/API/URL/search) provided as a 
`query` property of a `Request` object. When provided, the query parameters
are serialized and appended to `Request.url` property as query string.

*Basic example:*

```js
import SwaggerClient from 'swagger-client';

const request = {
  url: 'https://httpbin.org/?one=1&two=1',
  query: {
    two: {
      value: 2
    },
    three: {
      value: 3
    }
  },
  method: 'GET',
};

SwaggerClient.http(request);
// Requested URL: https://httpbin.org/?one=1&two=2&three=3
```

*Advanced example:*

```js
import SwaggerClient from 'swagger-client';

const request = {
  url: 'https://httpbin.org/',
  query: {
    anotherOne: ['one', 'two'], // no collection format
    evenMore: 'hi', // string, not an array
    bar: { // has a collectionFormat
      collectionFormat: 'ssv', // supported values: csv, ssv, pipes
      value: [1, 2, 3]
    }
  },
  method: 'GET',
};

SwaggerClient.http(request);
// Requested URL: https://httpbin.org/?anotherOne=one,two&evenMore=hi&bar=1%202%203
```

##### Loading specification

`loadSpec` property signals when the Request was constructed implicitly by `SwaggerClient`.
This can happen in only two circumstances.

1. When `SwaggerClient` fetches the OAS definition specified by `url` 
2. When `SwaggerClient` resolves the OAS definition by fetching remote JSON References

All other requests will not have this property present, or the property will be set to `false`.

*This following code snippet*:

```js
import SwaggerClient from 'swagger-client';

const requestInterceptor = (request) => {
  console.log(request);

  return request;
};

SwaggerClient({ url: 'https://petstore.swagger.io/v2/swagger.json', requestInterceptor })
  .then(client => client.execute({
      operationId: "findPetsByStatus",
      parameters: { status: 3 },
      requestInterceptor,
  }));
```

*Will result in two requests, with only one containing `loadSpec` set to `true`:*

```js
{
  url: 'https://petstore.swagger.io/v2/swagger.json',
  loadSpec: true,
  requestInterceptor: [Function: requestInterceptor],
  responseInterceptor: null,
  headers: { Accept: 'application/json, application/yaml' },
  credentials: 'same-origin'
}
{
  url: 'https://petstore.swagger.io/v2/pet/findByStatus?status=3',
  credentials: 'same-origin',
  headers: {},
  requestInterceptor: [Function: requestInterceptor],
  method: 'GET'
}
```



##### Request Interceptor

Request interceptor can be configured via `requestInterceptor` property in `Request` object.
When set, it intercepts the `Request` object before the actual HTTP request is made and after
the `query serialization` kicked in. This means that intercepted `Request` object will
never contain `query` property. All other properties will be present though. Request interceptor
can be defined as synchronous (transformer) or asynchronous function (allows other async operations inside).

*Transformer usage:*

```js
import SwaggerClient from 'swagger-client';

const request = {
  url: 'https://httpbin.org/',
  method: 'GET',
  requestInterceptor: req => {
    req.url += '?param=value';
    return req;
  },
};

SwaggerClient.http(request); 
// Requested URL: https://httpbin.org/?param=value
```

*Async operation usage:*

```js
import SwaggerClient from 'swagger-client';

const request = {
  url: 'https://httpbin.org/',
  method: 'GET',
  requestInterceptor: async req => {
    const { body: { idToken } } = await SwaggerClient.http({ url: 'https://identity.com/idtoken.json' });
    req.url += `?idToken=${idToken}`;
    return req;
  },
};

SwaggerClient.http(request); 
// Requested URL: https://httpbin.org/?idToken=2342398423948923
```

You're not limited to using one Request interceptor function. You can easily
compose `pipe` of request interceptors.

```js
import SwaggerClient from 'swagger-client';

const pipeP = (...fns) => args => fns.reduce((arg, fn) => arg.then(fn), Promise.resolve(args))

const interceptor1 = req => {
  req.url += '?param1=value1';
  return req;
}
const interceptor2 = async req => {
  req.url += '&param2=value2';
  return Promise.resolve(req);
};

const request = {
  url: 'https://httpbin.org/',
  method: 'GET',
  requestInterceptor: pipeP(interceptor1, interceptor2),
};

SwaggerClient.http(request); 
// Requested URL: https://httpbin.org/?param1=value1&param2=value2
```

> *__Note:__ you can mutate or assign any property of `Request` object as long as your
interceptor produces a valid `Request` object again.* 

### Response

Although we internally use [Fetch Compatible Response](https://developer.mozilla.org/en-US/docs/Web/API/Response), 
we expose a [POJO](https://en.wikipedia.org/wiki/Plain_old_Java_object) compatible in shape with Fetch Compatible Response.

Below is a list of Response properties:

Property | Description
--- | ---
`ok` | `Boolean`. A boolean indicating whether the response was successful (status in the range 200–299) or not.
`status` | `Number`. The status code of the response. (This will be 200 for a success).
`statusText` | `String`. The status message corresponding to the status code. (e.g., OK for 200).
`url` | `String`. Request url.
`headers` | `Object`. The Headers object associated with the response.
`text` | `String` &#124; `Blob`. Textual body, or Blob.
`data` | `String` &#124; `Blob`. Textual body, or Blob. (`Legacy` property)
`body` | `Object=undefined`. JSON object or `undefined`. 
`obj` | `Object=undefined`. JSON object or `undefined`. Mirrors `body` property. (`Legacy` property)

##### Response Interceptor

Response interceptor can be configured via `responseInterceptor` property in `Request` object.
When set, it intercepts the `Response` object after the actual HTTP request was made.
Response interceptor can be defined as synchronous (transformer) or asynchronous function (allows other async operations inside).

*Transformer usage:*

```js
import SwaggerClient from 'swagger-client';

const request = {
  url: 'https://httpbin.org/',
  method: 'GET',
  responseInterceptor: res => {
    res.arbitraryProp = 'arbitrary value';
    return res;
  },
};

SwaggerClient.http(request); 
/**
 * Promise({
 *   ok: true,
 *   status: 200,
 *   statusText: 'OK', 
 *   url: 'https://httpbin.org/',
 *   headers: {...},
 *   text: '{"prop":"value"}',
 *   data: '{"prop":"value"}',
 *   body: {prop: 'value'},
 *   obj: {prop: 'value'},
 *   arbitraryProp: 'arbitrary value',
 * })
 */
```

*Async operation usage:*

```js
import SwaggerClient from 'swagger-client';

const request = {
  url: 'https://httpbin.org/',
  method: 'GET',
  responseInterceptor: async res => {
    const { body: { idToken } } = await SwaggerClient.http({ url: 'https://identity.com/idtoken.json' });
    res.idToken = idToken;
    return res;
  },
};

SwaggerClient.http(request); 
/**
 * Promise({
 *   ok: true,
 *   status: 200,
 *   statusText: 'OK', 
 *   url: 'https://httpbin.org/',
 *   headers: {...},
 *   text: '{"prop":"value"}',
 *   data: '{"prop":"value"}',
 *   body: {prop: 'value'},
 *   obj: {prop: 'value'},
 *   idToken: '308949304832084320',
 * })
 */
```

You're not limited to using one Response interceptor function. You can easily
compose `pipe` of response interceptors.

```js
import SwaggerClient from 'swagger-client';

const pipeP = (...fns) => args => fns.reduce((arg, fn) => arg.then(fn), Promise.resolve(args))

const interceptor1 = res => {
  res.prop += 'value1';
  return res;
}
const interceptor2 = async res => {
  res.prop += '+value2';
  return Promise.resolve(res);
};

const request = {
  url: 'https://httpbin.org/',
  method: 'GET',
  responseInterceptor: pipeP(interceptor1, interceptor2),
};

SwaggerClient.http(request); 
/**
 * Promise({
 *   ok: true,
 *   status: 200,
 *   statusText: 'OK', 
 *   url: 'https://httpbin.org/',
 *   headers: {...},
 *   text: '{"prop":"value"}',
 *   data: '{"prop":"value"}',
 *   body: {prop: 'value'},
 *   obj: {prop: 'value'},
 *   prop: 'value1+value2',
 * })
 */
```

> *__Note:__ you can mutate or assign any property of `Response` object as long as your
interceptor produces a valid `Response` object again.* 

###### Accessing request in Response Interceptor

In order to access original `Request` in `responseInterceptor` you have to declare
`responseInterceptor` either as [function declaration](https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Statements/function) or [function expression](https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Operators/function).
By doing so, the interceptor will be bound to the original `Request`.

```js
import SwaggerClient from 'swagger-client';

const request = {
  url: 'https://httpbin.org/',
  method: 'GET',
  responseInterceptor: function(res) {
    const request = this;
    console.log(request.url); // https://httpbin.org/
    console.log(request.method); // GET
    
    res.arbitraryProp = 'arbitrary value';
    return res;
  },
};

SwaggerClient.http(request); 
```

> *__Note:__ this will not work if [arrow functions](https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Functions/Arrow_functions) are used to define a `responseInterceptor`.*


#### Response serialization

We detect the response `Content-Type` which identifies the payload of the `Response`.
If the `Content-Type` headers signals that the data can be represented as something we can parse, 
we parse the data as and expose the result as `Response.body` property.

Supported serialization formats: `json`, `yaml`

#### Headers serialization

Our headers serialization algorithm serializes headers into an object,
where mutliple-headers result in an array.

```js
// eg: Cookie: one
//     Cookie: two
//  =  { Cookie: [ "one", "two" ]
```

### Errors

##### HTTP Error

HTTP Client promise will reject with a TypeError when a network error is encountered
or CORS is misconfigured on the server-side, although this usually means permission issues
or similar. 

```js
import SwaggerClient from 'swagger-client';

const request = {
  url: 'https://httpbin.org/',
  method: 'GET',
};

SwaggerClient.http(request); // network problem or CORS misconfiguration
/**
 * Rejected promise will be returned.
 *
 * Promise.<Error> 
 */
```

##### Status Error

HTTP Client will reject all responses with `ok` field set to `false` -  status outside of the range 200-299.
This is another distinction from standard `Fetch API`.

```js
import SwaggerClient from 'swagger-client';

const request = {
  url: 'https://httpbin.org/non-existing-path',
  method: 'GET',
};

SwaggerClient.http(request);
/**
 * Rejected promise will be returned.
 *
 * Promise.<Error{
 *   message: 'NOT FOUND',
 *   statusCode: 404,
 *   response: Response // original response object
 * }>
 *    
 */
```

##### Serialization Error

When there is an error during headers or response serialization, the `Response`
object will contain one additional property `parseError` and `body`/`obj` properties
will not be present in `Response`.

Property | Description
--- | ---
`parseError` | `Error=undefined`. Error produced during headers or response serialization.

##### Interceptor Error

If you defined `responseInterceptor` on `Request` object, it can theoretically produce an unexpected Error.
When it happens HTTP Client will produce a rejected promise with following signature:

```js
import SwaggerClient from 'swagger-client';

const request = {
  url: 'https://httpbin.org/',
  method: 'GET',
  responseInterceptor: () => { throw new Error('error'); },
};

SwaggerClient.http(request);
/**
 * Rejected promise will be returned.
 *
 * Promise.<Error{
 *   message: 'OK',
 *   statusCode: 200,
 *   responseError: Error // error thrown in responseInterceptor
 * }>
 *    
 */
```

### Custom Fetch

HTTP client allows you to override the behavior of how it makes actual HTTP Request
by supplying an asynchronous function under the property called `userFetch` in `Request` object.

**Warning:** `userFetch` function must return instance of [Fetch Compatible Response](https://developer.mozilla.org/en-US/docs/Web/API/Response) class or
a compatible object of expected shape or behavior.  After importing the `SwaggerClient`
in your current module, the `Response` symbol will be available in the current scope. 

###### Example 1.)

*Using [axios](https://github.com/axios/axios) library as override.*

```js
import SwaggerClient from 'swagger-client';
import axios from 'axios';

const request = {
  url: 'https://httpbin.org/',
  method: 'GET',
  userFetch: async (url, req) => {
    const axiosRequest = { ...req, data: req.body };
    const axiosResponse = await axios(axiosRequest);

    return new Response(axiosResponse.data.data, {
      status: response.status,
      headers: response.headers,
    });
  },
};

SwaggerClient.http(request);
```
###### Example 2.)

*Using [axios](https://github.com/axios/axios) library as override in browser and tracking upload progress.*

```html
<html>
  <head>
    <script src="//unpkg.com/swagger-client"></script>
    <script src="//cdnjs.cloudflare.com/ajax/libs/axios/0.19.2/axios.js"></script>
    <script>
      const request = {
        url: 'https://httpbin.org/post',
        method: 'POST',
        body: "data".repeat(1000000),
        userFetch: async (url, req) => {
          const onUploadProgress = (progressEvent) => {
            const completed = Math.round((progressEvent.loaded * 100) / progressEvent.total);
            console.log(`${completed}%`);
          }
          const axiosRequest = { ...req, data: req.body, onUploadProgress };
          const axiosResponse = await axios(axiosRequest);

          return new Response(axiosResponse.data.data, {
            status: response.status,
            headers: response.headers,
          });
        },
      };

      SwaggerClient.http(request);
    </script>
  </head>
  <body>
    check console in browser's dev. tools
  </body>
</html>
```

### CORS

Cross-Origin Resource Sharing (`CORS`) is a mechanism that uses additional HTTP headers
to tell browsers to give a web application running at one origin, 
access to selected resources from a different origin. A web application executes a cross-origin HTTP request
when it requests a resource that has a different origin (domain, protocol, or port) from its own.

HTTP Client supports cors via two properties on `Request` object.

Property | Description
--- | ---
`mode` | `String=["cors"*, "no-cors", "same-origin", "navigate"]`. Contains the mode of the request. See more in `Request.mode` [documentation](https://developer.mozilla.org/en-US/docs/Web/API/Request/mode).
`credentials` | `String=["omit", "same-origin"*, "include"]`. Contains the credentials of the request. See more in `Request.credentials` [documentation](https://developer.mozilla.org/en-US/docs/Web/API/Request/credentials).

###### CORS enabled globally

If you need to activate CORS globally for every request, just enable it by `withCredentials` on [HTTP Client](http-client.md).
When enabled, it automatically sets `credentials="include"` on every request implicitly for you.

```js
import SwaggerClient from 'swagger-client';

SwaggerClient.http.withCredentials = true;
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
    await SwaggerClient.http({ url: 'https://www.google.com', signal });
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
            await SwaggerClient.http({ url: 'https://www.google.com', signal });
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

It's also possible (for convenience) to call HTTP Client from `SwaggerClient` instances.

```js
import SwaggerClient from 'swagger-client';

const { client } = new SwaggerClient({ spec: 'http://petstore.swagger.io/v2/swagger.json' });
client.http(request);
```
