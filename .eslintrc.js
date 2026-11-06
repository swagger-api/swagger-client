const path = require('node:path');

module.exports = {
  root: true,
  env: {
    'shared-node-browser': true,
    es6: true,
    es2017: true,
  },
  globals: {
    File: true,
    Blob: true,
    globalThis: true,
  },
  parser: '@babel/eslint-parser',
  parserOptions: {
    babelOptions: { configFile: path.join(__dirname, 'babel.config.js') },
    sourceType: 'module',
    ecmaVersion: 2020,
    ecmaFeatures: {
      impliedStrict: true,
    },
  },
  extends: ['eslint-config-airbnb-base', 'prettier'],
  plugins: ['eslint-plugin-prettier', 'prettier'],
  rules: {
    'import/order': [
      'error',
      {
        groups: [
          ['builtin', 'external', 'internal'],
          ['parent', 'sibling', 'index'],
        ],
        'newlines-between': 'always',
      },
    ],
    'import/extensions': [
      'error',
      'always',
      {
        ignorePackages: true,
      },
    ],
    'import/no-unresolved': [
      2,
      {
        ignore: [
          '^@swagger-api/apidom-reference/configuration/empty$',
          '^@swagger-api/apidom-reference/dereference/strategies/openapi-3-1$',
          '^@swagger-api/apidom-reference/dereference/strategies/openapi-3-1/selectors/\\$anchor$',
          '^@swagger-api/apidom-reference/dereference/strategies/openapi-3-1/selectors/uri$',
          '^@swagger-api/apidom-reference/dereference/strategies/openapi-3-2$',
          '^@swagger-api/apidom-reference/dereference/strategies/openapi-3-2/selectors/\\$anchor$',
          '^@swagger-api/apidom-reference/dereference/strategies/openapi-3-2/selectors/uri$',
          '^@swagger-api/apidom-reference/dereference/strategies/json-schema-2020-12$',
          '^@swagger-api/apidom-reference/dereference/strategies/json-schema-2020-12/selectors/\\$anchor$',
          '^@swagger-api/apidom-reference/dereference/strategies/json-schema-2020-12/selectors/uri$',
          '^@swagger-api/apidom-reference/resolve/resolvers/file$',
          '^@swagger-api/apidom-reference/resolve/strategies/openapi-3-1$',
          '^@swagger-api/apidom-reference/resolve/strategies/openapi-3-2$',
          '^@swagger-api/apidom-reference/resolve/strategies/json-schema-2020-12$',
          '^@swagger-api/apidom-reference/parse/parsers/binary$',
          '^@swagger-api/apidom-json-pointer/modern$',
        ],
      },
    ],
    'prettier/prettier': 'error',
    'no-param-reassign': 0, // needs to be eliminated in future
    'no-use-before-define': [2, 'nofunc'], // needs to be eliminated in future
  },
};
