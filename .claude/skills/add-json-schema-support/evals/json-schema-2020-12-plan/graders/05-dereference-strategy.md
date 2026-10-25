---
type: llm
focus: trace
weight: 1
---

PLAN.md builds a json-schema-2020-12-swagger-client dereference strategy that keeps the schema $ref hook (renamed to the JSONSchema202012Element traversal key), drops the OpenAPI-only hooks and the parameter macro, and leaves $dynamicRef untouched.
