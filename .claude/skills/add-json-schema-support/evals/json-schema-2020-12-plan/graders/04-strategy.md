---
type: llm
focus: trace
weight: 1
---

PLAN.md builds the json-schema-2020-12-apidom strategy from an OpenAPI ApiDOM strategy (openapi-3-1-apidom, or openapi-3-2-apidom, which has the same structure) with JSONSchemaElement refraction, keeping fragments (pathDiscriminator), circular handling and error collection, with a normalize that does nothing.
