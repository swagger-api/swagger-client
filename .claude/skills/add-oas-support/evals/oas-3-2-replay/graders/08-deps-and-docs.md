---
type: llm
focus: trace
weight: 1
---

PLAN.md adds apidom-ns-openapi-3-2 to dependencies and to the link:apidom script, stubs the 3.2 parser adapters the way this checkout stubs the others (the package.json overrides and the overrides snippet in docs/usage/installation.md; optionalDependencies replaced them later, in #4240), and updates README.md and CLAUDE.md.
