---
name: add-json-schema-support
description: Adds resolution of standalone JSON Schema documents (root `$schema`, no `openapi`/`swagger` field) to swagger-client, 2020-12 first, then 2019-09, Draft 7, 6 and 4, as in the "Standalone JSON Schema" design doc. Checks that the installed ApiDOM has the dialect's namespace and apidom-reference strategies, then builds a root-only `$schema` predicate, the `json-schema-<dialect>-apidom` resolve strategy over ApiDOM (so `$ref`s resolve against `$id` base URIs and `$anchor`s), a schema-only dereference strategy, parsers, registration ahead of the generic strategy and tests. Swagger UI resolves `$ref`s in its preview through this strategy. Use whenever someone wants swagger-client, Swagger UI or SwaggerEditor to resolve or dereference `$ref`s in a JSON Schema document or a specific draft, or asks why `$id`/`$anchor` references in a standalone schema don't resolve, even if they don't name this skill. Not for Schema Objects inside OpenAPI documents (that is add-oas-support).
---

# Add Standalone JSON Schema Resolution to swagger-client

Today a standalone JSON Schema document matches no OpenAPI strategy and falls to `generic`, which
resolves JSON References with specmap: relative to the document URL, without `$id` base URIs or
`$anchor`. Swagger UI renders such documents natively (its `json-schema-document` plugin) and
resolves `$ref`s through swagger-client, so swagger-client owns `$ref` resolution for them
(decided 2026-10-25). The delivery order is ApiDOM, swagger-client, Swagger UI, SwaggerEditor;
`references/design-and-delivery.md` has the ownership and decisions.

## Bundled Tools

| Tool | Use |
|------|-----|
| `node .claude/skills/add-oas-support/scripts/spec-status.mjs --json-schema <dialect>` | ApiDOM prerequisites (`UPSTREAM`), every integration point (`MISSING`), the Swagger UI hand-off (`NOTE`). |
| `node .claude/skills/add-oas-support/scripts/verify-urls.mjs <paths>` or `--diff main` | URLs and anchors (meta-schema URIs, spec sections). |
| `references/design-and-delivery.md` | Ownership, decisions (answered and open), PR plan. Read at Step 0. |
| `references/dialects.md` | `$schema` identifiers, ApiDOM packages and names per dialect. Read at Step 1. |
| `references/strategy-design.md` | What to copy from the OpenAPI 3.1 strategy and what to drop. Read before Step 2. |
| `../add-oas-support/references/resolver-architecture.md`, `testing.md`, `review-lessons.md` | How the ApiDOM strategies work, the test layout, earlier defects. |

## Step 0: Upstream Gate (every invocation)

1. Dialect: the one the user names, else 2020-12. Dialects come in order (2020-12 first); a
   later one reuses the first's structure.
2. `npm ci` if `node_modules` is missing, then `spec-status.mjs --json-schema <dialect>`.
3. **`UPSTREAM`: stop.** swagger-client needs, from the installed ApiDOM: the dialect's namespace,
   apidom-reference's `json-schema-<dialect>` resolve and dereference strategies (with their
   `selectors/`), and the namespace's `keyMap`/`getNodeType` exports. Check the registry first
   (`npm view @swagger-api/apidom-reference version` and its release notes); if published, bump
   ApiDOM and re-run. Otherwise report it as ApiDOM work (`/add-spec-version` phase 3 for
   `--spec json-schema --version <dialect>`). As a subagent, stop with the report.

## Step 1: Tracking Doc and Decisions

1. Create `ADD-JSON-SCHEMA-{DIALECT}.md` (uncommitted) from
   `../add-oas-support/references/tracking-doc-template.md`, with the status output, the ApiDOM
   version and the PR plan from `references/design-and-delivery.md`.
2. Record the decisions in `references/design-and-delivery.md` as given; all are answered. A
   question they don't cover goes to the user with your recommendation; as a subagent, plan with
   the recommendation and say so.

## Step 2: Build (one PR per dialect)

Read `references/strategy-design.md` and `../add-oas-support/references/review-lessons.md`, then:

1. Predicate `isJSONSchema<suffix>` in `src/helpers/json-schema-predicates.js` (root only, the
   exact identifier with an empty fragment normalised, no `openapi`/`swagger` field).
2. Strategy `src/resolver/strategies/json-schema-<dialect>-apidom/` (`index.js`, `resolve.js`,
   `normalize.js`).
3. Parsers `src/resolver/apidom/reference/parse/parsers/json-schema-{json,yaml}-<dialect>/`.
4. Dereference strategy
   `src/resolver/apidom/reference/dereference/strategies/json-schema-<dialect>-swagger-client/`.
5. Registration in `src/index.js` (`Swagger.resolveStrategies`, both arrays before `generic`,
   `Swagger.apidom`), `.eslintrc.js` patterns, `package.json` dependencies, webpack limits if the
   build exceeds them, README and CLAUDE.md.

## Step 3: Tests

Per `strategy-design.md` "Tests" and `../add-oas-support/references/testing.md`: predicate,
strategy (through `SwaggerClient.resolve` and `resolveSubtree`), dereference fixtures, parsers.
Include the regressions: an OpenAPI 3.1 document and a refused `$schema` still resolve as before.

## Step 4: Gates

- `npm run lint`, `npm run test:unit`, `npm run build`, `npm run test:artifact`.
- `spec-status.mjs --json-schema <dialect>`: 0 `UPSTREAM`, 0 `MISSING`.
- `verify-urls.mjs --diff main`: 0 `BROKEN`.
- `/review-spec-support` in a fresh subagent given only "JSON Schema <dialect>" and the branch.

## Step 5: Pull Request and Hand-off

Branch `feat/json-schema-<dialect>`, title `feat(json-schema): resolve standalone JSON Schema
<dialect> documents`. Pushing and opening the PR are outward-facing: confirm with the user.
Report the PR, the status summary before and after, the decisions, and for Swagger UI: the import
path `swagger-client/es/resolver/strategies/json-schema-<dialect>-apidom` and the
swagger-client release that ships it (Swagger UI adds it to both strategy lists of
`src/core/plugins/swagger-client/index.js`, its `/add-json-schema-support` decision 5).
