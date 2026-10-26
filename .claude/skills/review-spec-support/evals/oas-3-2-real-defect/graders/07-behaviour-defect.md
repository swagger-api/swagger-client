---
type: llm
focus: trace
weight: 1
---

Beyond the wiring, the report finds that src/helpers/each-operation.js treats every key of a Path Item as an HTTP method, so a 3.2 additionalOperations map becomes a bogus ADDITIONALOPERATIONS operation (fixed later by #4238), with file:line evidence.
