---
tags: [skill-creator, regression]
max_turns: 40
timeout_seconds: 1200
allowed_tools: [Read, Glob, Grep, Skill, Write, Edit, Bash]
---

Swagger UI is going to render standalone JSON Schema 2020-12 documents (root $schema, no openapi
field) and needs swagger-client to resolve their $refs. Plan the swagger-client side: write
PLAN.md with what you check first, every file you would change and what goes in it, the tests and
the open decisions. Don't change any code.
