---
type: llm
focus: trace
weight: 1
---

PLAN.md registers the strategy in src/index.js: Swagger.resolveStrategies['openapi-3-2-apidom'], both default strategy arrays (resolve and resolveSubtree) ahead of 3.1, and the parsers and dereference strategy under Swagger.apidom.
