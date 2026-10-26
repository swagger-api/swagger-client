---
type: llm
focus: trace
weight: 1
---

The report finds that src/subtree-resolver/index.js excludes only OpenAPI 3.1 from skipNormalization, so 3.2 documents are not normalized in subtree resolution, with file:line evidence, rated as its most severe finding (blocker, or the top of the report's own scale).
