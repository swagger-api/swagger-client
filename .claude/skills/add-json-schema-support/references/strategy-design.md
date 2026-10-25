# Strategy Design

The JSON Schema strategy is the schema part of the OpenAPI 3.1 one. Copy from
`openapi-3-1-apidom` and `openapi-3-1-swagger-client` (`../../add-oas-support/references/
resolver-architecture.md` explains them) and change only what this file lists. Names per dialect
are in `dialects.md`; 2020-12 below.

## ApiDOM Prerequisites

From the installed ApiDOM release (Step 0's `spec-status.mjs` checks all three):

- apidom-reference `resolve/strategies/json-schema-2020-12` and
  `dereference/strategies/json-schema-2020-12` with `selectors/$anchor` and `selectors/uri`
  (ApiDOM `/add-reference-support` 3.8);
- `@swagger-api/apidom-ns-json-schema-2020-12`;
- its index exporting `keyMap` and `getNodeType` (on 2026-10-25 only `src/traversal/visitor.ts`
  has them; `apidom-ns-openapi-3-1` re-exports its own). Without them neither the swagger-client
  nor the apidom-reference dereference strategy can traverse the document.

## Predicate: `src/helpers/json-schema-predicates.js`

`isJSONSchema202012(spec)`: a plain object, no `openapi` or `swagger` key, `$schema` a string
equal to the identifier after removing an empty trailing `#`. Wrap in `try`/`catch` like
`openapi-predicates.js`. Matching rules: `dialects.md`.

## Resolve Strategy: `src/resolver/strategies/json-schema-2020-12-apidom/`

- `index.js`: `name: 'json-schema-2020-12-apidom'`, `match: isJSONSchema202012`, and `normalize`
  returning its input: the OpenAPI normalization plugins (operation ids, parameters, security)
  have nothing to act on. Because of that the subtree resolver's `skipNormalization` list needs
  no entry; add one if the strategy ever normalizes.
- `resolve.js` from `openapi-3-1-apidom/resolve.js`, with `JSONSchemaElement.refract(spec)` (and
  its `WeakMap` cache), `mediaTypes.latest()` of the namespace, apidom-reference's
  `json-schema-2020-12` resolve strategy, the parsers below plus JSON, YAML and binary, and the
  dereference strategy below. Keep the base URI logic, fragments (`pathDiscriminator`),
  `ReferenceSet`, `circularReplacer`, error collection and the invalid-pointer fallback: Swagger
  UI resolves subtrees lazily, so fragments are the main path.
- `normalize.js`: the identity, exported for the same shape as the other strategies.

## Parsers: `src/resolver/apidom/reference/parse/parsers/json-schema-{json,yaml}-2020-12/`

From `openapi-json-3-1` / `openapi-yaml-3-1`: parser names
`json-schema-{json,yaml}-2020-12-swagger-client`, the namespace's media types, `JSON.parse` /
js-yaml `JSON_SCHEMA`, `JSONSchemaElement.refract`. Detect with the predicate on the parsed value
rather than a regex over the text: a regex also matches a nested `$schema`. External files
without a root `$schema` stay with the generic JSON/YAML parsers; the dereference visitor
refracts what a `$ref` points at into a schema.

## Dereference Strategy: `.../dereference/strategies/json-schema-2020-12-swagger-client/`

- `index.js` from `openapi-3-1-swagger-client/index.js`: extends apidom-reference's
  `json-schema-2020-12` dereference strategy, namespace from `apidom-ns-json-schema-2020-12`,
  `keyMap` and `getNodeType` from it.
- `visitors/dereference.js`: keep the `SchemaElement` hook, renamed to `JSONSchema202012Element`
  (the namespace's traversal key), with its lineage, cycle, `$$ref` and error handling, and the
  `$anchor`/`uri` selectors imported from `dereference/strategies/json-schema-2020-12/selectors`.
  Drop `ReferenceElement`, `PathItemElement`, `LinkElement` and `ExampleElement`: they serve
  OpenAPI objects. `$dynamicRef` stays untouched (decision 2).
- `visitors/root.js`: merge `dereference.js`, and per decision 5 `properties.js`
  (`modelPropertyMacro`) and `all-of.js` (unless `mode: 'strict'`), both moved to
  `JSONSchema202012Element`. No `parameters.js`.
- `utils/` and `errors/SchemaRefError.js` as they are.

## Registration and Build

- `src/index.js`: imports; `Swagger.resolveStrategies['json-schema-2020-12-apidom']`; both default
  arrays, before `Swagger.resolveStrategies.generic` (the predicate excludes OpenAPI documents, so
  its place among the OpenAPI strategies doesn't matter); `Swagger.apidom.parse.parsers`
  (`JsonSchemaJson2020_12Parser`, `JsonSchemaYaml2020_12Parser`) and
  `Swagger.apidom.dereference.strategies` (`JsonSchema2020_12SwaggerClientDereferenceStrategy`).
- `.eslintrc.js`: `import/no-unresolved` patterns for apidom-reference's
  `{resolve,dereference}/strategies/json-schema-2020-12` and the selectors.
- `package.json`: the namespace in `dependencies` (it is already in `link:apidom`), the dialect's
  adapters in `optionalDependencies` when apidom-reference lists them; one ApiDOM release.
- `config/webpack/browser.config.babel.js`: raise `maxEntrypointSize` only if the build says so.
- README (supported documents) and CLAUDE.md (strategy list).

## Tests

- `test/helpers/json-schema-predicates.js`: the identifier with and without `#`; refused: the
  `http://` variant, a nested-only `$schema`, an OpenAPI 3.1 document with `$schema` in a Schema
  Object, a custom meta-schema, non-objects.
- `test/resolver/strategies/json-schema-2020-12-apidom/`: through `SwaggerClient.resolve` and
  `SwaggerClient.resolveSubtree`: internal `#/$defs/...`, `$anchor`, an `$id`-relative and an
  external `$ref` (undici `MockAgent`), cycles with and without `useCircularStructures`, a
  `pathDiscriminator` fragment, an invalid one, `allOf` and `modelPropertyMacro` per decision 5,
  every `$dynamicRef` unchanged (JSON Schema Test Suite `tests/draft2020-12/dynamicRef.json`
  schemas). Regressions: an OpenAPI 3.1 document and a refused `$schema` resolve exactly as
  before.
- `test/resolver/apidom/reference/dereference/strategies/json-schema-2020-12-swagger-client/`:
  fixtures `internal-only`, `external-only`, `internal-external`, `cycle-internal`,
  `cycle-external`, `anchor`, `id-relative`, `dynamic-ref`, with `__utils__/jest.local.setup.js`
  configured for this dialect.
- `test/resolver/apidom/reference/parse/parsers/json-schema-{json,yaml}-2020-12/`.
