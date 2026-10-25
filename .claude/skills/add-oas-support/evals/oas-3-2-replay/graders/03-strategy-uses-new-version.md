---
type: llm
focus: trace
weight: 1
---

PLAN.md creates src/resolver/strategies/openapi-3-2-apidom (index, resolve, normalize) from the 3.1 strategy and has resolve.js import the 3.2 element, parsers and apidom-reference openapi-3-2 strategies rather than the 3.1 ones.
