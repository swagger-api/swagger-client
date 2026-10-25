---
name: review-spec-support
description: Reviews a swagger-client branch or PR that adds OpenAPI version support or standalone JSON Schema resolution, from a fresh context, against the official specification, the installed ApiDOM packages and swagger-client's integration points - predicates, strategy order, the subtree resolver's normalization list, files that name only the parent version, copied files still importing the parent's apidom-reference strategies, dereference visitors and macros, cycles and errors, execute gates, dependencies, ESLint and webpack, docs and tests mirrored from the parent - and produces a findings report with file:line evidence. Use after /add-oas-support or /add-json-schema-support, or whenever someone asks to review, audit or double-check spec-support changes in swagger-client ("review my OAS 3.3 branch", "check the JSON Schema strategy PR"), even if they don't name this skill.
---

# Review Spec Support Changes in swagger-client

The author reviews what they meant to write; this skill reviews what the branch does. Run it in
a **fresh subagent** that gets only:

- the target: `OpenAPI X.Y` or `JSON Schema <dialect>`,
- the branch or PR number,
- optionally the tracking doc path (`ADD-OAS-X.Y.md` / `ADD-JSON-SCHEMA-<dialect>.md`) for the
  author's recorded decisions.

Don't give it the author's summary. It is read-only: it reports, it doesn't fix.

## Inputs and Setup

1. Check out the branch (`git switch <branch>`, or `git fetch origin pull/<n>/head` and switch to
   it); don't modify files. `npm ci` if `node_modules` is stale (the status script reads it).
2. `git diff --stat main...HEAD` and the full diff of `src`, `test`, `package.json`,
   `.eslintrc.js`, `config/`, `README.md`, `CLAUDE.md`, `docs/`.
3. Status: `node .claude/skills/add-oas-support/scripts/spec-status.mjs --oas X.Y` or
   `--json-schema <dialect>`; `node .claude/skills/add-oas-support/scripts/verify-urls.mjs --diff
   main`.
4. The spec: OpenAPI raw markdown of the pinned patch and the parent
   (`https://raw.githubusercontent.com/OAI/OpenAPI-Specification/main/versions/{X.Y.Z}.md`); for
   JSON Schema the identifiers in `.claude/skills/add-json-schema-support/references/dialects.md`
   and the dialect's core specification.

## Checks

Work through `references/review-checklist.md`. Every `MISSING` and every unrecorded `DECIDE` from
the status script is a finding. Prove claims by running code where cheap: the predicate against
the new version, the parent, a neighbour and a nested `$schema`
(`node --input-type=module -e "import { isOpenAPI33 } from './src/helpers/openapi-predicates.js'; ..."`),
or a single jest file (`npm run test:unit -- <file>`). A finding without evidence is a question;
label it so.

## Report

Write `REVIEW-<target>-<branch>.md` (uncommitted) and return it as your final message:

```markdown
# Review: {target} on {branch} ({short sha})

spec-status: {summary line}   verify-urls: {n BROKEN, n UNVERIFIED}

## Findings

| # | Severity | Area | File:line | Finding | Evidence | Fix |
|---|----------|------|-----------|---------|----------|-----|
| 1 | blocker | wiring | src/subtree-resolver/index.js:58 | ... | command + output, or spec quote with URL#anchor | ... |

## Not Checked
{what you couldn't verify and why}
```

Severities: **blocker** (wrong resolution, normalization or request for users, a spec violation,
a broken build or test, an older version changed), **major** (missing integration point, missing
test for a new behaviour, unrecorded `DECIDE`), **minor** (naming, docs wording), **question**
(no evidence either way). Order by severity. No praise; nothing about what is fine beyond the
status line.
