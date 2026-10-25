# Dialects

The root `$schema` identifiers (from each meta-schema's `$id`,
https://json-schema.org/specification-links) and the names this repository uses per dialect.
`spec-status.mjs` has the same table (`DIALECTS`); change both together and run
`verify-urls.mjs` on the identifiers.

| `--json-schema` | Root `$schema` | ApiDOM namespace | Strategy | Predicate | `Swagger.apidom` suffix |
|-----------------|----------------|------------------|----------|-----------|-------------------------|
| `2020-12` | `https://json-schema.org/draft/2020-12/schema` | `apidom-ns-json-schema-2020-12` | `json-schema-2020-12-apidom` | `isJSONSchema202012` | `2020_12` |
| `2019-09` | `https://json-schema.org/draft/2019-09/schema` | `apidom-ns-json-schema-2019-09` | `json-schema-2019-09-apidom` | `isJSONSchema201909` | `2019_09` |
| `draft-07` | `http://json-schema.org/draft-07/schema#` | `apidom-ns-json-schema-draft-7` | `json-schema-draft-7-apidom` | `isJSONSchemaDraft7` | `Draft7` |
| `draft-06` | `http://json-schema.org/draft-06/schema#` | `apidom-ns-json-schema-draft-6` | `json-schema-draft-6-apidom` | `isJSONSchemaDraft6` | `Draft6` |
| `draft-04` | `http://json-schema.org/draft-04/schema#` | `apidom-ns-json-schema-draft-4` | `json-schema-draft-4-apidom` | `isJSONSchemaDraft4` | `Draft4` |

Draft 5 kept the Draft 4 meta-schema, so Draft 4 documents cover it.

## Matching (same as Swagger UI)

- Only the document root's `$schema`, and only when there is no `openapi` or `swagger` field:
  OpenAPI 3.1+ Schema Objects carry `$schema` too.
- The identifier exactly, with an empty fragment normalised: up to Draft 7 the identifiers end in
  `#`, from 2019-09 they don't; documents add or drop it.
- Nothing else: the other scheme (`http://json-schema.org/draft/2020-12/schema`), custom
  meta-schemas, OpenAPI dialect ids and dialects not delivered yet are refused. Swagger UI
  doesn't render them, so they keep the `generic` strategy.

ApiDOM names for the dialect (2020-12): root element `JSONSchemaElement` (element name
`JSONSchema202012`), `mediaTypes` (`JSONSchema202012MediaTypes`), `isJSONSchemaElement`, `refract`
from `@swagger-api/apidom-ns-json-schema-2020-12`; `keyMap` and `getNodeType` live in its
`src/traversal/visitor.ts` and must be exported from the index (an ApiDOM phase 3 prerequisite,
see `strategy-design.md`).
