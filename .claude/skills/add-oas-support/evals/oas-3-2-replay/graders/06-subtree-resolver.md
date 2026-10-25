---
type: llm
focus: trace
weight: 1
---

PLAN.md adds isOpenAPI32 to the subtree resolver's skipNormalization condition in src/subtree-resolver/index.js, so 3.2 documents are normalized after subtree resolution (the omission #4295 later fixed).
