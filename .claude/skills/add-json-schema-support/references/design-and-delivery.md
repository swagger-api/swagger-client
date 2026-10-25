# Design and Delivery

The "Standalone JSON Schema" design doc (SwaggerHub, Confluence SHUB page 4687691955) plans
editing, previewing and validating plain JSON Schema documents, 2020-12 first. Its plan 1 runs
through four repositories, strictly in order; each stage starts when the previous one is
released.

| Order | Repository | Owns | Skill |
|-------|------------|------|-------|
| 1 | `swagger-api/apidom` | namespace, parser adapters, apidom-reference strategies, apidom-ls | `/add-spec-version` (`references/json-schema-dialects.md`) |
| 2 | `swagger-api/swagger-client` | `$ref` resolution for the Swagger UI preview: the `json-schema-<dialect>-apidom` strategy | this skill |
| 3 | `swagger-api/swagger-ui` | detection, native rendering, the `json-schema-document` plugin; imports this strategy | `/add-json-schema-support` |
| 4 | `swagger-api/swagger-editor` | content detection, routing to the Swagger UI preview, language features, downloads | `/add-json-schema-support` |

## Decisions

Answered (record them in the tracking doc as given):

1. **Who resolves `$ref` in the preview** (2026-10-25): swagger-client, through an ApiDOM-based
   strategy, so `$id` base URIs and `$anchor`s resolve as in OpenAPI 3.1 Schema Objects. Swagger
   UI registers the strategy; SwaggerEditor gets it through swagger-ui-react.
2. **`$dynamicRef`** (2026-10-25): left in place, as for OpenAPI 3.1. Supporting it is a later
   change for both, in ApiDOM's schema visitor.
3. **Unrecognised `$schema` values** (2026-10-25): refused. Swagger UI doesn't render them, so
   the predicate doesn't match them and they keep the `generic` strategy.
4. **Bundling** is out of scope here: swagger-client dereferences; bundling is apidom-reference's
   `bundle()` (deferred there too).
5. **allOf merging and macros** (2026-10-25): as for OpenAPI 3.1 Schema Objects. The dereference
   strategy merges `allOf` unless `mode: 'strict'` and applies `modelPropertyMacro`, so a schema
   resolves the same standalone and inside an OpenAPI 3.1 document.

## PR Plan

| PR | Content |
|----|---------|
| 1 per dialect | predicate, strategy, parsers, dereference strategy, registration, deps, docs, tests |

A later dialect (2019-09, Draft 7, 6, 4) is its own PR after its ApiDOM release, reusing the
first dialect's files with its namespace; which dialects follow, and when, is decided outside
the 2020-12 work.
