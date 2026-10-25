# Follow-ups

Gaps found while building the skills (2026-10-25). Re-check with
`node .claude/skills/add-oas-support/scripts/spec-status.mjs --oas 3.2` before acting.

## 1. OpenAPI 3.2 on `main`

### 1.1 ⏳ The 3.2 strategy resolves with apidom-reference's 3.1 resolve strategy

`src/resolver/strategies/openapi-3-2-apidom/resolve.js:23` imports
`@swagger-api/apidom-reference/resolve/strategies/openapi-3-1` and passes it at line 124, though
`.eslintrc.js` already allows the `openapi-3-2` subpath. Switch to `openapi-3-2`, with a test of an
external reference in a 3.2 document. `spec-status.mjs` reports it as `MISSING wiring`.

### 1.2 ⏳ No `isOpenAPI32` predicate test

`test/helpers/openapi-predicates.js` tests 3.2 only through `isOpenAPI3`. Add a
`describe('isOpenAPI32')` like the `isOpenAPI31` one.

### 1.3 ⏳ Thin 3.2 dereference tests

`test/resolver/apidom/reference/dereference/strategies/openapi-3-2-swagger-client` has 32 of the
399 files of its 3.1 counterpart: no `callback-object`, `example-object`, `header-object` or
`link-object` folders, and fewer fixtures in the folders both have. Mirror them, or record which
ones 3.2 doesn't need.

## 2. Other Repositories

### 2.1 ⏳ ApiDOM: 2020-12 namespace doesn't export `keyMap`/`getNodeType`

`apidom-ns-json-schema-2020-12/src/index.ts` doesn't re-export them from
`src/traversal/visitor.ts` (`apidom-ns-openapi-3-1` re-exports its own). Both apidom-reference's
and this repository's JSON Schema dereference strategies need them; recorded in ApiDOM's
`add-spec-version/references/json-schema-dialects.md` as a phase 3 prerequisite.

### 2.2 ⏳ Swagger UI: `fn.resolve` lacks the 3.2 strategy

`src/core/plugins/swagger-client/index.js` in swagger-ui lists 3.1, 3.0, 2.0 and generic for
`fn.resolve`, while `resolveSubtree` (the path Swagger UI uses) has 3.2. `resolveSpec` is
deprecated, so it only affects callers of `fn.resolve`; recorded in swagger-ui's FOLLOW-UPS.

## 3. Evals

### 3.1 ⏳ Not run yet

Run the four cases with skill-creator (with and without the skill), read-only in their fixture
worktrees.
