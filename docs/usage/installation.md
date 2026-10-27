# Installation

## Distribution channels

### NPM Registry

We publish single module to npm: [swagger-client](https://www.npmjs.com/package/swagger-client).
`swagger-client` is meant for consumption by any JavaScript engine (node.js, browser, etc...).
The npm package contains transpiled and minified ES5 compatible code.

```shell script
 $ npm install swagger-client
``` 

**Increasing installation speed:**

`swagger-client` integrates with [ApiDOM](https://github.com/swagger-api/apidom) and use it
as a direct dependency. Some transitive dependencies of ApiDOM are [optional](https://docs.npmjs.com/cli/v8/configuring-npm/package-json#optionaldependencies),
which means you can run `npm install --omit=optional` to speed up the installation:

```json
"optionalDependencies": {
  "@swagger-api/apidom-ns-asyncapi-2": "^1.11.3",
  "@swagger-api/apidom-ns-asyncapi-3": "^1.11.3",
  "@swagger-api/apidom-ns-openapi-2": "^1.11.3",
  "@swagger-api/apidom-parser-adapter-api-design-systems-json": "^1.11.3",
  "@swagger-api/apidom-parser-adapter-api-design-systems-yaml": "^1.11.3",
  "@swagger-api/apidom-parser-adapter-asyncapi-json-2": "^1.11.3",
  "@swagger-api/apidom-parser-adapter-asyncapi-json-3": "^1.11.3",
  "@swagger-api/apidom-parser-adapter-asyncapi-yaml-2": "^1.11.3",
  "@swagger-api/apidom-parser-adapter-asyncapi-yaml-3": "^1.11.3",
  "@swagger-api/apidom-parser-adapter-json": "^1.11.3",
  "@swagger-api/apidom-parser-adapter-json-schema-json-2020-12": "^1.11.3",
  "@swagger-api/apidom-parser-adapter-json-schema-yaml-2020-12": "^1.11.3",
  "@swagger-api/apidom-parser-adapter-openapi-json-2": "^1.11.3",
  "@swagger-api/apidom-parser-adapter-openapi-yaml-2": "^1.11.3",
  "@swagger-api/apidom-parser-adapter-openapi-json-3-0": "^1.11.3",
  "@swagger-api/apidom-parser-adapter-openapi-json-3-1": "^1.11.3",
  "@swagger-api/apidom-parser-adapter-openapi-json-3-2": "^1.11.3",
  "@swagger-api/apidom-parser-adapter-openapi-yaml-3-0": "^1.11.3",
  "@swagger-api/apidom-parser-adapter-openapi-yaml-3-1": "^1.11.3",
  "@swagger-api/apidom-parser-adapter-openapi-yaml-3-2": "^1.11.3",
  "@swagger-api/apidom-parser-adapter-arazzo-json-1": "^1.11.3",
  "@swagger-api/apidom-parser-adapter-arazzo-yaml-1": "^1.11.3",
  "@swagger-api/apidom-parser-adapter-yaml-1-2": "^1.11.3"
}
```

> NOTE: When ApiDOM optional dependencies fail to install, you can safely ignore it as `swagger-client` can work without these optional dependencies.

After installed successfully:

[ES6 imports](https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Statements/import)
```js
import SwaggerClient from 'swagger-client';
```

[CommonJS imports](https://en.wikipedia.org/wiki/CommonJS)
```js
const SwaggerClient = require('swagger-client');
```

### unpkg

You can embed Swagger UI's code directly in your HTML by using [unpkg's](https://unpkg.com/) interface.

```html
<!DOCTYPE html>
<html lang="en">
  <head>
    <meta charset="utf-8">
    <title>SwaggerClient test</title>
    <script src="https://unpkg.com/swagger-client"></script>
    <script>
      new SwaggerClient('http://petstore.swagger.io/v2/swagger.json')
        .then(
          client => client.apis.pet.addPet({ id: 1, body: { name: "bobby" } }),
          reason => console.error('failed to load the spec: ' + reason)
        )
        .then(
          addPetResult => console.log(addPetResult.body),
          reason => console.error('failed on api call: ' + reason)
        );
    </script>
  </head>
  <body>
    check console in browser's dev. tools
  </body>
</html>
```

See unpkg's main page for more information on how to use [unpkg](https://unpkg.com/).
