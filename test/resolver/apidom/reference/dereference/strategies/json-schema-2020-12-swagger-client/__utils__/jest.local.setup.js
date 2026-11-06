/* eslint-disable camelcase */
import { options } from '@swagger-api/apidom-reference/configuration/empty';
import FileResolver from '@swagger-api/apidom-reference/resolve/resolvers/file';
import BinaryParser from '@swagger-api/apidom-reference/parse/parsers/binary';
import JSONSchema2020_12ResolveStrategy from '@swagger-api/apidom-reference/resolve/strategies/json-schema-2020-12';
import JSONSchema2020_12DereferenceStrategy from '@swagger-api/apidom-reference/dereference/strategies/json-schema-2020-12';

import JSONParser from '../../../../../../../../src/resolver/apidom/reference/parse/parsers/json/index.js';
import YAMLParser from '../../../../../../../../src/resolver/apidom/reference/parse/parsers/yaml-1-2/index.js';
import JSONSchemaJSON2020_12Parser from '../../../../../../../../src/resolver/apidom/reference/parse/parsers/json-schema-json-2020-12/index.js';
import JSONSchemaYAML2020_12Parser from '../../../../../../../../src/resolver/apidom/reference/parse/parsers/json-schema-yaml-2020-12/index.js';
import HTTPResolverSwaggerClient from '../../../../../../../../src/resolver/apidom/reference/resolve/resolvers/http-swagger-client/index.js';
import JSONSchema2020_12SwaggerClientDereferenceStrategy from '../../../../../../../../src/resolver/apidom/reference/dereference/strategies/json-schema-2020-12-swagger-client/index.js';

export const beforeAll = () => {
  // configure custom parser plugins globally
  options.parse.parsers = [
    new JSONSchemaJSON2020_12Parser({ allowEmpty: false, sourceMap: false }),
    new JSONSchemaYAML2020_12Parser({ allowEmpty: false, sourceMap: false }),
    new JSONParser({ allowEmpty: false, sourceMap: false }),
    new YAMLParser({ allowEmpty: false, sourceMap: false }),
    new BinaryParser({ allowEmpty: false, sourceMap: false }),
  ];

  // configure custom resolver plugins globally
  options.resolve.resolvers = [
    new FileResolver({ fileAllowList: ['*'] }),
    new HTTPResolverSwaggerClient(),
  ];

  // configure custom resolver strategies globally
  options.resolve.strategies = [new JSONSchema2020_12ResolveStrategy()];

  // configure custom dereference strategy globally
  options.dereference.strategies = [
    new JSONSchema2020_12SwaggerClientDereferenceStrategy(),
    new JSONSchema2020_12DereferenceStrategy(),
  ];
};

export const afterAll = () => {
  options.parse.parsers = [];
  options.resolve.resolvers = [];
  options.resolve.strategies = [];
  options.dereference.strategies = [];
};
/* eslint-enable camelcase */
