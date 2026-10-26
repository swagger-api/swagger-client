---
type: llm
focus: trace
weight: 1
---

Before any code change, PLAN.md checks the ApiDOM this checkout installs from its lockfile (1.5.1) for apidom-ns-openapi-3-2 and apidom-reference's openapi-3-2 resolve and dereference strategies, finds them missing, finds a release on the npm registry that has them (1.6.0 or later), and makes bumping every @swagger-api/apidom-* package to that one release a prerequisite. Reporting the 3.2 packages as installed fails: the fixture installs the lockfile, which has none of them.
