# Integration Points

Every place an OpenAPI version is wired, in the order to work through them. Each names the 3.2
file to copy (`a964cd06`, plus `05111861` for the subtree resolver). `spec-status.mjs --oas X.Y`
checks each one; the unwired scan finds places this list doesn't know yet (add them here).

## 1. Predicate

`src/helpers/openapi-predicates.js`: `isOpenAPIXY` with the version's regex
(`/^3\.2\.(?:[1-9]\d*|0)$/` for 3.2), and the new predicate in `isOpenAPI3`. `isOpenAPI3` is what
`src/execute/index.js` (request building, base URL) and `src/index.js`
(`Swagger.prototype.applyDefaults`, the default server) branch on, so leaving it out makes the
version execute like Swagger 2.0.

## 2. Resolve Strategy

`src/resolver/strategies/openapi-X-Y-apidom/`, copied from the parent's folder:

- `index.js`: `{ name: 'openapi-X-Y-apidom', match, normalize, resolve }`. `match` is the
  predicate; `normalize` pre-normalizes plain objects once (`pojoAdapter`, `$$normalized`) and
  post-normalizes elements.
- `resolve.js`: refracts with the version's root element (`OpenApi3_2Element.refract`), builds
  the `ReferenceSet`, calls `dereferenceApiDOM` with the version's parsers, resolve strategy and
  swagger-client dereference strategy (`resolver-architecture.md`). Every apidom-reference import
  names the new version (`resolve/strategies/openapi-X-Y`), not the parent's.
- `normalize.js`: the namespace's refractor plugins (operation ids, parameters, security
  requirements, parameter and header examples) and `pojoAdapter`, which fills `resolve.js`'s
  cache.

## 3. Parsers

`src/resolver/apidom/reference/parse/parsers/openapi-{json,yaml}-X-Y/index.js`: classes named
`OpenAPIJSON3_2Parser`/`OpenAPIYAML3_2Parser`, parser names
`openapi-{json,yaml}-X-Y-swagger-client`, `detectionRegExp` for the version, media types from the namespace. They parse with
`JSON.parse` or js-yaml (`JSON_SCHEMA`) and refract with the version's root element, so the
tree-sitter parser adapters aren't loaded.

## 4. Dereference Strategy

`src/resolver/apidom/reference/dereference/strategies/openapi-X-Y-swagger-client/`: `index.js`
extends apidom-reference's `openapi-X-Y` dereference strategy; `visitors/root.js` merges
`dereference.js` (always), `properties.js` (`modelPropertyMacro`), `all-of.js` (unless
`mode: 'strict'`) and `parameters.js` (`parameterMacro`); `utils/` and `errors/SchemaRefError.js`
come along. New referenceable fields (Step 1 of the skill) are handled in `visitors/dereference.js`
in a feature PR.

## 5. Registration in `src/index.js`

- imports of the strategy, both parsers and the dereference strategy;
- `Swagger.resolveStrategies['openapi-X-Y-apidom']`;
- both default arrays, `Swagger.resolve` and `Swagger.resolveSubtree`, newest version first;
- `Swagger.apidom.parse.parsers` (`OpenApiJsonX_YParser`, `OpenApiYamlX_YParser`) and
  `Swagger.apidom.dereference.strategies` (`OpenApiX_YSwaggerClientDereferenceStrategy`).

The module defaults in `src/resolver/index.js` and `src/subtree-resolver/index.js` list only the
specmap strategies on purpose (consumers such as Swagger UI compose their own lists); leave them.

## 6. Subtree Resolver

`src/subtree-resolver/index.js`: `skipNormalization: !isOpenAPI31(obj) && !isOpenAPI32(obj)`.
ApiDOM-based versions normalize after resolving; a version missing here is never normalized in
subtree resolution (Swagger UI's only path). #3575 fixed it for 3.1, #4295 again for 3.2.

## 7. Version-Gated Helpers and Execute

Features gated by a predicate: `src/helpers/each-operation.js` (`additionalOperations`, 3.2),
with `src/helpers/id-from-path-method/` and `src/execute/index.js` (#4238). When the new version
keeps the feature, extend the gate (`isOpenAPI32(spec) || isOpenAPI33(spec)`); the unwired scan
lists every such file. All 3.x versions share `src/execute/oas3/` (`build-request.js`,
`parameter-builders.js`, `style-serializer.js`, `content-serializer.js`); there is no
per-version execute folder.

## 8. Build and Lint

- `.eslintrc.js`: `import/no-unresolved` ignore patterns for
  `@swagger-api/apidom-reference/{resolve,dereference}/strategies/openapi-X-Y` (and the
  dereference strategy's `selectors/$anchor`, `selectors/uri` if imported).
- `config/webpack/browser.config.babel.js`: `performance.maxEntrypointSize` (3.2 raised it to
  590000); `npm run build` reports when the bundle exceeds it.

## 9. Dependencies

`package.json`: `@swagger-api/apidom-ns-openapi-X-Y` in `dependencies` and in the `link:apidom`
script; the version's two parser adapters in `optionalDependencies` (mirroring apidom-reference);
every `@swagger-api/apidom-*` on the same release.

## 10. Docs

- `README.md`: the compatibility table gets a row for the release (versions `..., X.Y.0`).
- `docs/usage/installation.md`: the `optionalDependencies` list includes the new adapters.
- `CLAUDE.md`: supported versions, the strategy list and the "identify the OpenAPI version"
  steps name `openapi-X-Y-apidom`.
