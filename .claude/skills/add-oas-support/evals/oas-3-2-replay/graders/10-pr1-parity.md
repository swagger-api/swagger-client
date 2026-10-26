---
type: llm
focus: trace
weight: 1
---

PLAN.md keeps the basic-support PR at parity with 3.1: it changes no behaviour for 3.0 or 3.1 documents and adds no 3.2 semantics ($self as the base URI, additionalOperations, querystring parameters, new security or cookie handling). Those come in their own PRs, gated with isOpenAPI32 so older versions are unchanged. A plan that puts any of them in the first PR, or changes older versions' behaviour to support them, fails.
