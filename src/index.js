/* eslint-disable camelcase */
import { DEFAULT_OPENAPI_3_SERVER } from './constants.js';
import Http, { makeHttp, serializeRes } from './http/index.js';
import { serializeHeaders } from './http/serializers/response/index.js';
import { makeResolve } from './resolver/index.js';
import { makeResolveSubtree } from './subtree-resolver/index.js';
import genericResolveStrategy from './resolver/strategies/generic/index.js';
import openApi2ResolveStrategy, { clearCache } from './resolver/strategies/openapi-2/index.js';
import openApi30ResolveStrategy from './resolver/strategies/openapi-3-0/index.js';
import openApi31ApiDOMResolveStrategy from './resolver/strategies/openapi-3-1-apidom/index.js';
import openApi32ApiDOMResolveStrategy from './resolver/strategies/openapi-3-2-apidom/index.js';
import jsonSchema202012ApiDOMResolveStrategy from './resolver/strategies/json-schema-2020-12-apidom/index.js';
import { makeApisTagOperation } from './interfaces.js';
import { execute, buildRequest, baseUrl } from './execute/index.js';
import { opId, isHttpUrl } from './helpers/index.js';
import { isOpenAPI2, isOpenAPI3 } from './helpers/openapi-predicates.js';
import HTTPResolverSwaggerClient from './resolver/apidom/reference/resolve/resolvers/http-swagger-client/index.js';
import JsonParser from './resolver/apidom/reference/parse/parsers/json/index.js';
import YamlParser from './resolver/apidom/reference/parse/parsers/yaml-1-2/index.js';
import OpenApiJson3_1Parser from './resolver/apidom/reference/parse/parsers/openapi-json-3-1/index.js';
import OpenApiYaml3_1Parser from './resolver/apidom/reference/parse/parsers/openapi-yaml-3-1/index.js';
import OpenApiJson3_2Parser from './resolver/apidom/reference/parse/parsers/openapi-json-3-2/index.js';
import OpenApiYaml3_2Parser from './resolver/apidom/reference/parse/parsers/openapi-yaml-3-2/index.js';
import JsonSchemaJson2020_12Parser from './resolver/apidom/reference/parse/parsers/json-schema-json-2020-12/index.js';
import JsonSchemaYaml2020_12Parser from './resolver/apidom/reference/parse/parsers/json-schema-yaml-2020-12/index.js';
import OpenApi3_1SwaggerClientDereferenceStrategy from './resolver/apidom/reference/dereference/strategies/openapi-3-1-swagger-client/index.js';
import OpenApi3_2SwaggerClientDereferenceStrategy from './resolver/apidom/reference/dereference/strategies/openapi-3-2-swagger-client/index.js';
import JsonSchema2020_12SwaggerClientDereferenceStrategy from './resolver/apidom/reference/dereference/strategies/json-schema-2020-12-swagger-client/index.js';

Swagger.http = Http;
Swagger.makeHttp = makeHttp.bind(null, Swagger.http);
Swagger.resolveStrategies = {
  'openapi-3-2-apidom': openApi32ApiDOMResolveStrategy,
  'openapi-3-1-apidom': openApi31ApiDOMResolveStrategy,
  'openapi-3-0': openApi30ResolveStrategy,
  'openapi-2-0': openApi2ResolveStrategy,
  'json-schema-2020-12-apidom': jsonSchema202012ApiDOMResolveStrategy,
  generic: genericResolveStrategy,
};
Swagger.resolve = makeResolve({
  strategies: [
    Swagger.resolveStrategies['openapi-3-2-apidom'],
    Swagger.resolveStrategies['openapi-3-1-apidom'],
    Swagger.resolveStrategies['openapi-3-0'],
    Swagger.resolveStrategies['openapi-2-0'],
    Swagger.resolveStrategies['json-schema-2020-12-apidom'],
    Swagger.resolveStrategies.generic,
  ],
});
Swagger.resolveSubtree = makeResolveSubtree({
  strategies: [
    Swagger.resolveStrategies['openapi-3-2-apidom'],
    Swagger.resolveStrategies['openapi-3-1-apidom'],
    Swagger.resolveStrategies['openapi-3-0'],
    Swagger.resolveStrategies['openapi-2-0'],
    Swagger.resolveStrategies['json-schema-2020-12-apidom'],
    Swagger.resolveStrategies.generic,
  ],
});
Swagger.execute = execute;
Swagger.serializeRes = serializeRes;
Swagger.serializeHeaders = serializeHeaders;
Swagger.clearCache = clearCache;
Swagger.makeApisTagOperation = makeApisTagOperation;
Swagger.buildRequest = buildRequest;
Swagger.helpers = { opId };
Swagger.getBaseUrl = baseUrl;
Swagger.apidom = {
  resolve: {
    resolvers: { HTTPResolverSwaggerClient },
  },
  parse: {
    parsers: {
      JsonParser,
      YamlParser,
      OpenApiJson3_1Parser,
      OpenApiYaml3_1Parser,
      OpenApiJson3_2Parser,
      OpenApiYaml3_2Parser,
      JsonSchemaJson2020_12Parser,
      JsonSchemaYaml2020_12Parser,
    },
  },
  dereference: {
    strategies: {
      OpenApi3_1SwaggerClientDereferenceStrategy,
      OpenApi3_2SwaggerClientDereferenceStrategy,
      JsonSchema2020_12SwaggerClientDereferenceStrategy,
    },
  },
};

function Swagger(url, opts = {}) {
  // Allow url as a separate argument
  if (typeof url === 'string') {
    opts.url = url;
  } else {
    opts = url;
  }

  if (!(this instanceof Swagger)) {
    return new Swagger(opts);
  }

  Object.assign(this, opts);

  const prom = this.resolve().then(() => {
    if (!this.disableInterfaces) {
      Object.assign(this, Swagger.makeApisTagOperation(this));
    }
    return this;
  });

  // Expose this instance on the promise that gets returned
  prom.client = this;
  return prom;
}

Swagger.prototype = {
  http: Http,

  execute(options) {
    this.applyDefaults();

    return Swagger.execute({
      spec: this.spec,
      http: this.http,
      securities: { authorized: this.authorizations },
      contextUrl: typeof this.url === 'string' ? this.url : undefined,
      requestInterceptor: this.requestInterceptor || null,
      responseInterceptor: this.responseInterceptor || null,
      ...options,
    });
  },

  resolve(options = {}) {
    return Swagger.resolve({
      spec: this.spec,
      url: this.url,
      http: this.http || this.fetch,
      allowMetaPatches: this.allowMetaPatches,
      useCircularStructures: this.useCircularStructures,
      requestInterceptor: this.requestInterceptor || null,
      responseInterceptor: this.responseInterceptor || null,
      pathDiscriminator: this.pathDiscriminator || [],
      skipNormalization: this.skipNormalization || false,
      ...options,
    }).then((obj) => {
      this.originalSpec = this.spec;
      this.spec = obj.spec;
      this.errors = obj.errors;
      return this;
    });
  },
};

Swagger.prototype.applyDefaults = function applyDefaults() {
  const { spec } = this;
  const specUrl = this.url;

  if (isOpenAPI2(spec) && isHttpUrl(specUrl)) {
    const parsed = new URL(specUrl);

    if (!spec.host) {
      spec.host = parsed.host;
    }
    if (!spec.schemes) {
      spec.schemes = [parsed.protocol.replace(':', '')];
    }
    if (!spec.basePath) {
      spec.basePath = '/';
    }
  } else if (isOpenAPI3(spec)) {
    const isEmptyServerList = Array.isArray(spec.servers) && spec.servers.length === 0;

    if (!spec.servers || isEmptyServerList) {
      spec.servers = [DEFAULT_OPENAPI_3_SERVER];
    }
  }
};

// add backwards compatibility with older versions of swagger-ui
// Refs https://github.com/swagger-api/swagger-ui/issues/6210
export const { helpers } = Swagger;

export default Swagger;
/* eslint-enable camelcase */
