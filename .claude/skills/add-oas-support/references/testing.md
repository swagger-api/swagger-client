# Testing

Jest, through `config/jest/jest.unit.config.js` (`BABEL_ENV=commonjs`, `--runInBand`). One file:
`npm run test:unit -- test/resolver/strategies/openapi-3-2-apidom/index.js`; by name:
`npm run test:unit -- --testNamePattern="OpenAPI 3.2.0 strategy"`. `npm run test:artifact` builds
the UMD, ES and CommonJS outputs and tests them; run it once per PR.

## What a Version Needs (mirrored from the parent)

`spec-status.mjs --oas X.Y` lists every file of the parent's folders without a counterpart
(`DECIDE tests`). Mirror it, or record in the tracking doc why the new version doesn't need it.
On `main`, 3.2's dereference tests have 32 of 3.1's 399 files (`FOLLOW-UPS.md`), so take 3.1 as
the model where 3.2 is thin.

| Folder | Tests | Model |
|--------|-------|-------|
| `test/helpers/openapi-predicates.js` | a `describe('isOpenAPIXY')` with accepted patches, rejected neighbours and non-objects, and `isOpenAPI3` accepting the version | the `isOpenAPI31` block |
| `test/resolver/strategies/openapi-X-Y-apidom/` | `index.js`: `SwaggerClient.resolve` over URLs (undici `MockAgent`) and objects, cycles, macros, `pathDiscriminator`; `normalize/`: the normalization plugins; `__fixtures__`, `__snapshots__` | `openapi-3-2-apidom` |
| `test/resolver/apidom/reference/dereference/strategies/openapi-X-Y-swagger-client/` | one folder per object with `$ref` handling (`schema-object`, `path-item-object`, `parameter-object`, ...), each with `__fixtures__/<case>/root.json` and `dereferenced.json` (plus `external.json` for external cases) | `openapi-3-1-swagger-client` |
| `test/resolver/apidom/reference/parse/parsers/openapi-{json,yaml}-X-Y/` | detection and parsing of a sample document | `openapi-json-3-2` |
| `test/execute/openapi-X-Y.js` | `buildRequest`/`execute` for the version, and every execute feature | `openapi-3-2.js` |

## Patterns

- **Dereference tests** call apidom-reference's `dereference(rootFilePath, { parse: { mediaType:
  mediaTypes.latest('json') } })` after `__utils__/jest.local.setup.js` configures the
  swagger-client parsers, a `FileResolver`, `HTTPResolverSwaggerClient`, the version's resolve
  strategy and the swagger-client dereference strategy globally, and compare `toValue(actual)`
  with `globalThis.loadJsonFile(<case>/dereferenced.json)`. The setup's `afterAll` empties those
  options again; copy both.
- **Strategy tests** go through `SwaggerClient.resolve` / `SwaggerClient.resolveSubtree`, so they
  also prove the registration in `src/index.js`. Mock HTTP with undici's `MockAgent`, restored in
  `afterEach`.
- **Fixture cases** for `$ref`: `internal-only`, `external-only`, `internal-external`,
  `cycle-internal`, `cycle-external` (the `schema-object` set).
- **Regression**: a feature PR adds a test that the parent version is unchanged, like "should
  ignore additionalOperations outside OpenAPI 3.2" in `test/helpers/get-operation-raw.js`.
- Snapshots are generated (`__snapshots__`); review them in the diff like code.
