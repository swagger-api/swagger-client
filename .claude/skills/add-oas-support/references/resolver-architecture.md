# Resolver Architecture

How swagger-client resolves a document, so a new version's strategy is copied with understanding.
File references are to `main` on 2026-10-25; re-check with `git grep` before relying on a line.

## Entry Points

- `Swagger.resolve` (`src/resolver/index.js` `makeResolve`): fetches the document when only a URL
  is given, picks the first strategy whose `match(spec)` is true and returns
  `strategy.resolve(options)`: `{ spec, errors }`.
- `Swagger.resolveSubtree` (`src/subtree-resolver/index.js` `makeResolveSubtree`): normalizes the
  whole document with the matching strategy, resolves it with `pathDiscriminator: path`,
  `allowMetaPatches: true` and `skipNormalization` (true unless the version is ApiDOM-based),
  and returns the subtree at `path`. Swagger UI resolves only through this (lazily, per path:
  `specActions.requestResolvedSubtree`).

Strategy order matters: `match` is tried in array order and `generic` matches everything, so it
is last and each new strategy goes before the ones it must win against.

## Strategy Shape

```js
{ name: 'openapi-3-2-apidom', match(spec), normalize(spec), async resolve(options) }
```

The specmap strategies (`generic`, `openapi-2`, `openapi-3-0`) resolve JSON References with
`src/resolver/specmap` plugins. The ApiDOM strategies (`openapi-3-1-apidom`, `openapi-3-2-apidom`)
delegate to apidom-reference; that is where `$id`-based URIs, `$anchor` and the OpenAPI 3.1+
referencing rules come from.

## An ApiDOM Strategy's `resolve.js` (`openapi-3-2-apidom`)

1. Base URI: the retrieval URI resolved against `url.cwd()`, or `DEFAULT_BASE_URL` outside a
   browser.
2. Refract the plain object into the root element (`OpenApi3_2Element.refract`), cached in a
   `WeakMap` keyed by the object (`resolve.cache`; `normalize.js`'s `pojoAdapter` fills it).
3. Fragment: `pathDiscriminator` compiled to a JSON Pointer and evaluated; the fragment becomes
   the element to dereference (`refSet.rootRef` is reset for it). An invalid pointer returns the
   document unchanged with no errors (#3760 aligned this across strategies).
4. `dereferenceApiDOM(fragment, options)` with:
   - `resolve`: `baseURI` with the fragment, `HTTPResolverSwaggerClient` (timeout, redirects,
     request/response interceptors), the version's apidom-reference resolve strategy;
   - `parse`: the version's swagger-client JSON and YAML parsers, then generic JSON, YAML and
     binary parsers;
   - `dereference`: `maxDepth: 100`, the swagger-client dereference strategy with
     `allowMetaPatches`, `useCircularStructures`, `parameterMacro`, `modelPropertyMacro`, `mode`
     and `ancestors`; `refSet`; `dereferenceOpts.errors` (collects errors instead of throwing);
     `circular: useCircularStructures ? 'ignore' : 'replace'` with `circularReplacer` (a cycle
     becomes a plain `{ $ref: <absolute URI> }`).
5. `transclude(fragment, dereferenced, root)`, then `strategy.normalize` unless
   `skipNormalization`, then `{ spec: toValue(normalized), errors }`.

## Normalization (`normalize.js`, `index.js`)

- **Pre-normalization**: once per plain object, before the first dereference; `pojoAdapter`
  refracts, runs the plugins and marks the result `$$normalized`.
- **Post-normalization**: after each dereference, on elements.
- Plugins come from the namespace: `refractorPluginNormalizeOperationIds` (with `opId`),
  `...Parameters`, `...SecurityRequirements`, `...ParameterExamples`, `...HeaderExamples`.

## The Dereference Strategy (`openapi-3-2-swagger-client`)

`index.js` extends apidom-reference's strategy for the version: it clones the `ReferenceSet` when
`immutable`, runs `visitors/root.js` over the root reference with the namespace's `keyMap` and
`getNodeType`, and cleans the sets up. `root.js` merges:

| Visitor | When | Does |
|---------|------|------|
| `dereference.js` | always | `ReferenceElement`, `PathItemElement` (`$ref`), `SchemaElement` (`$ref` with `$id` base URIs and `$anchor`), `ExampleElement` (`externalValue`); `LinkElement` is a no-op. Tracks ancestor lineage for cycles; with `allowMetaPatches` sets `$$ref` on merged objects; wraps failures in `SchemaRefError` with `fullPath` and pushes them to `dereferenceOpts.errors` |
| `properties.js` | `modelPropertyMacro` is a function | applies the macro to Schema `properties` |
| `all-of.js` | `mode !== 'strict'` | merges `allOf` into the schema |
| `parameters.js` | `parameterMacro` is a function | applies the macro to Operation parameters |

A new referenceable field means a new hook or a new branch in `dereference.js`, in a feature PR
with its fixtures.

## Execute

`src/execute/index.js` builds requests for every 3.x version through `src/execute/oas3/`
(`build-request.js`, `parameter-builders.js`, `style-serializer.js`, `content-serializer.js`),
switching on `isOpenAPI3`. Operations are found by `src/helpers/each-operation.js` and
`src/helpers/id-from-path-method/`; version-specific operation locations are gated there
(`isOpenAPI32` for `additionalOperations`, #4238).
