---
type: llm
focus: trace
weight: 1
---

The report finds that src/subtree-resolver/index.js excludes only OpenAPI 3.1 from skipNormalization, so 3.2 documents are not normalized in subtree resolution, as a blocker with file:line evidence.
