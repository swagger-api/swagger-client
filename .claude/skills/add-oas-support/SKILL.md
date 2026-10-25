---
name: add-oas-support
description: Adds support for a new OpenAPI Specification version (e.g. 3.3, a 4.0 line) to swagger-client, the link between ApiDOM and Swagger UI/SwaggerEditor. Stops while the installed ApiDOM lacks the version's namespace and apidom-reference strategies; then builds the `openapi-X-Y-apidom` resolve strategy, dereference strategy and parsers, the predicate, registration in `src/index.js`, the subtree resolver's normalization list, dependencies, docs and tests mirrored from the parent version, then one PR per new feature (referenceable fields, operation locations, request building). Each PR is gated by `spec-status.mjs` (including a scan for files that name only the parent version) and a fresh-context `/review-spec-support`. Use whenever someone wants swagger-client to resolve, normalize or execute a new OpenAPI version, bumps ApiDOM for a new OpenAPI release, or asks why a new version's `$ref`s aren't resolved or its operations aren't found, even if they don't name this skill.
---

# Add OpenAPI Version Support to swagger-client

swagger-client resolves, normalizes and executes API documents. For OpenAPI 3.1 and later the
work is done by ApiDOM: swagger-client refracts the document into the version's namespace and
dereferences it with apidom-reference, through its own parsers, HTTP resolver and dereference
strategy. So a version needs ApiDOM first:

| Order | Repository | Provides |
|-------|------------|----------|
| 1 | `swagger-api/apidom` (`/add-spec-version`) | namespace `apidom-ns-openapi-X-Y`, apidom-reference `openapi-X-Y` resolve and dereference strategies |
| 2 | `swagger-api/swagger-client` (this skill) | `openapi-X-Y-apidom` resolve strategy, execute support |
| 3 | `swagger-api/swagger-ui` (`/add-oas-support`) | imports the strategy into its swagger-client plugin, renders the version |
| 4 | `swagger-api/swagger-editor` (`/add-oas-support`) | gets it through swagger-ui-react |

Standalone JSON Schema uses `/add-json-schema-support`. The OAS 3.2 work is the reference:
`a964cd06` (#4153, basic support), `7b4d3722` (#4238, a feature: additional operations) and
`05111861` (#4295, the subtree resolver fix #4153 missed). Read the diff when a step is unclear:
`git show a964cd06 -- src package.json .eslintrc.js`.

## Bundled Tools

Run from the repository root.

| Tool | Use |
|------|-----|
| `node .claude/skills/add-oas-support/scripts/spec-status.mjs --oas X.Y [--parent X.Y]` | ApiDOM prerequisites (`UPSTREAM`, exit 3), every integration point (`MISSING`, exit 1), tests without a counterpart of the parent's and files that name the parent version but not the new one (`DECIDE`). |
| `node .claude/skills/add-oas-support/scripts/verify-urls.mjs <paths>` or `--diff main` | HTTP status and `#anchor` of every URL in the given files or the branch diff. |
| `bash .claude/skills/add-oas-support/scripts/test/smoke.sh` | Smoke test of the scripts, including a replay of `a964cd06`; run after changing a script. |
| `references/integration-points.md` | Every place a version is wired, with the 3.2 file to copy. Read at Step 3. |
| `references/resolver-architecture.md` | How the ApiDOM-based strategies, normalization, the subtree resolver and the dereference strategy work. Read before Step 3. |
| `references/tracking-doc-template.md` | The uncommitted `ADD-OAS-{VERSION}.md`. Read at Step 1. |
| `references/testing.md` | Jest layout, fixtures, the parent's tests to mirror. Read at Step 5. |
| `references/review-lessons.md` | Defects from earlier version work in this repository. Read before Step 3. |

## Step 0: Upstream Gate (every invocation)

1. Identify the version line (`3.3`), its latest patch (`3.3.0`) and the parent line (`3.2`).
   Pin the patch from `https://github.com/OAI/OpenAPI-Specification/tree/main/versions`, not
   from memory.
2. `npm ci` if `node_modules` is missing, then `spec-status.mjs --oas X.Y`.
3. **`UPSTREAM`: is it published?** The script reads `node_modules`; check the registry
   (`npm view @swagger-api/apidom-ns-openapi-X-Y version`). If it is published, bump ApiDOM
   (Step 2) first and re-run.
4. **Still `UPSTREAM`: stop.** Report it as ApiDOM work (`swagger-api/apidom`, `/add-spec-version`
   phases 1 and 3). As a subagent, stop with the report; don't guess versions.
5. A major version (4.0) doesn't share the 3.x document shape: the predicate, execute and the
   strategy can't be copied. Ask the user how to proceed; as a subagent, stop and report.

## Step 1: Research and Tracking Doc

1. Fetch the raw markdown of the pinned patch and the parent
   (`https://raw.githubusercontent.com/OAI/OpenAPI-Specification/main/versions/{X.Y.Z}.md`).
   ApiDOM's tracking doc for the version (`ADD-{SPEC}-{VERSION}.md` of apidom's
   `/add-spec-version`) has the field map when it is at hand; otherwise build the part this
   repository needs:
   - **Resolution**: new fields that can hold a Reference Object or `$ref`, and changed base URI
     rules (3.2's `$self`). Each is a dereference-visitor or test row.
   - **Normalization**: new places where operations, parameters or security requirements live
     (`normalize.js` plugins, `each-operation.js`).
   - **Execute**: new HTTP methods, operation locations (3.2 `additionalOperations`), parameter
     locations or styles, request bodies, security schemes, server rules.
2. Create `ADD-OAS-{VERSION}.md` from `references/tracking-doc-template.md` (uncommitted), with
   the `spec-status.mjs` output and a PR plan: PR 1 basic support, then one PR per feature row.
3. **Checkpoint:** show the user the ApiDOM version you will bump to, the PR plan and the open
   `DECIDE` lines; confirm before editing. As a subagent, record your assumption and continue.

## Step 2: Dependencies

Bump every `@swagger-api/apidom-*` package to the same release (mixed releases put two copies of
apidom-core in the bundle; the script checks). Add `@swagger-api/apidom-ns-openapi-X-Y` to
`dependencies` and to the `link:apidom` script, and the version's two parser adapters to
`optionalDependencies` (they mirror apidom-reference's). `npm install`; commit
`package-lock.json` with the change.

## Step 3: PR 1, Basic Support (parity with the parent)

Read `references/review-lessons.md` and `references/resolver-architecture.md`, then work through
`references/integration-points.md` in its order: predicate, strategy, parsers, dereference
strategy, registration, subtree resolver, ESLint, webpack limits, docs.

- Copy from the parent and change only the version: names, elements, media types, apidom-reference
  imports. A file of the new version that still imports the parent's apidom-reference strategy is
  `MISSING` in the script (3.2's `resolve.js` still uses the 3.1 resolve strategy).
- No new behaviour in PR 1: new fields come in feature PRs, so a regression is attributable.
- Every `DECIDE unwired` line: wire it, or record in the tracking doc why it stays parent-only.
  An unrecorded `DECIDE` is a defect. This is the check that would have caught #4295.

## Step 4: Feature PRs

One PR per feature row (#4238 is the model: `additionalOperations` in `each-operation.js`,
`id-from-path-method`, `execute/index.js`, tests). Version-gate new behaviour with the predicate
(`isOpenAPI32(spec)` in `each-operation.js`) so older versions are unchanged, and extend the gate
when a later version keeps the feature (the unwired scan lists such gates).

## Step 5: Tests

Follow `references/testing.md`: mirror the parent's strategy, dereference strategy and parser
tests (the script reports files without a counterpart), add execute tests in
`test/execute/openapi-X-Y.js`, and a predicate test for `isOpenAPIXY`. Each feature PR adds
tests for its rows, including one that the parent version behaves as before.

## Step 6: Gates (every PR)

- `npm run lint`, `npm run test:unit`, `npm run build`, `npm run test:artifact`.
- `spec-status.mjs --oas X.Y`: 0 `UPSTREAM`, 0 `MISSING`, every `DECIDE` wired or recorded.
- `verify-urls.mjs --diff main`: 0 `BROKEN`.
- `/review-spec-support` in a fresh subagent given only "OpenAPI X.Y" and the branch. Fix every
  finding.

## Step 7: Pull Requests

Branch `feat/oas{XY}` (PR 1) and `feat/oas{XY}-<feature>`; titles
`feat(oas{XY}): add initial OAS X.Y.Z support`, `feat(oas{XY}): support OpenAPI X.Y.Z <feature>`
(the 3.2 PRs). Commit messages follow CLAUDE.md (Conventional Commits). Body: ApiDOM version,
integration points, `DECIDE` answers, tests. Pushing and opening PRs are outward-facing: confirm
with the user first.

## Hand-off

Report the PRs, the `spec-status.mjs` summary line before and after, the `DECIDE` answers and
the swagger-client release that ships the strategy: Swagger UI imports
`swagger-client/es/resolver/strategies/openapi-X-Y-apidom` into both strategy lists of
`src/core/plugins/swagger-client/index.js`. Leave `ADD-OAS-{VERSION}.md` uncommitted.
