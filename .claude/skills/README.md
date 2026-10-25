# Claude Code Skills for swagger-client

Skills for adding specification support to swagger-client: new OpenAPI versions, and resolution
of standalone JSON Schema documents as described in the SwaggerHub design doc "Standalone JSON
Schema" (Confluence, SHUB space, page 4687691955). They are modelled on the ApiDOM, Swagger UI
and SwaggerEditor skills.

swagger-client is the second link of a chain. Each skill checks the link before it and names
the skill after it:

| Order | Repository | Skill there | Provides |
|-------|------------|-------------|----------|
| 1 | `swagger-api/apidom` | `/add-spec-version` | namespaces, apidom-reference strategies (what this repository builds on) |
| 2 | `swagger-api/swagger-client` | the skills below | `openapi-X-Y-apidom` and `json-schema-<dialect>-apidom` resolve strategies, execute |
| 3 | `swagger-api/swagger-ui` | `/add-oas-support`, `/add-json-schema-support` | imports the strategies into its swagger-client plugin, renders |
| 4 | `swagger-api/swagger-editor` | `/add-oas-support`, `/add-json-schema-support` | gets them through swagger-ui-react |

## Recent Updates

**2026-10-25**: Rebuilt as skill directories. The flat `add-oas-version.md` and
`add-oas-version-checklist.md` (#4153) were never discovered as skills (skills are directories)
and described an execute layout that doesn't exist (per-version `src/execute/openapi-X-Y/`); they
are replaced by `/add-oas-support`, `/add-json-schema-support` and `/review-spec-support`.

## Skill Layout

```
{skill}/
├── SKILL.md        # workflow, gates, hand-off (loaded on invocation)
├── references/     # templates and detail, read at the step that names them
├── scripts/        # deterministic checks (add-oas-support only; shared by all skills)
└── evals/          # skill-creator test cases: {case}/prompt.md, case.yaml, graders/, fixture.md
```

## Skills

### `/add-oas-support`

Adds an OpenAPI version line (3.3, 4.0, ...). Step 0 stops while ApiDOM lacks the version. Then:
research and an uncommitted `ADD-OAS-{VERSION}.md`, dependencies, PR 1 with basic support (parity
with the parent version: predicate, strategy, parsers, dereference strategy, registration,
subtree resolver, build, docs, mirrored tests), then one PR per feature. The OAS 3.2 work is the
reference: `a964cd06` (#4153), `7b4d3722` (#4238), `05111861` (#4295).

### `/add-json-schema-support`

Adds the `json-schema-<dialect>-apidom` strategy so `$ref`s in standalone JSON Schema documents
resolve against `$id` base URIs and `$anchor`s, as in OpenAPI 3.1 Schema Objects (2020-12 first).
Swagger UI imports it for its preview.

### `/review-spec-support`

Fresh-context review of a branch for either skill. Produces `REVIEW-{target}-{branch}.md` with
severity, file:line, evidence and fix per finding.

## Scripts

In `add-oas-support/scripts/`, run from the repository root:

| Script | Checks |
|--------|--------|
| `spec-status.mjs --oas X.Y [--parent X.Y]` / `--json-schema <dialect>` | ApiDOM packages (`UPSTREAM`, exit 3), every integration point (`MISSING`, exit 1), tests without a counterpart of the parent's, and files that name the parent version but not the new one (`DECIDE`). `--root` for another checkout. |
| `verify-urls.mjs <paths>` / `--diff main` | HTTP status and `#anchor` of URLs (from ApiDOM via Swagger UI and SwaggerEditor). |
| `test/smoke.sh` | Exit codes, plus a replay showing `spec-status.mjs --oas 3.2` at `a964cd06` reports the subtree resolver gap #4295 fixed. |

On `main` (2026-10-25) `spec-status.mjs --oas 3.2` reports real gaps; see `FOLLOW-UPS.md`.

## Evaluating Skills

Test cases use the skill-creator case-folder format, so `claude plugin eval` can run them too.
Each case's `fixture.md` says which commit to check out.

| Skill | Case | Fixture | Measures |
|-------|------|---------|----------|
| add-oas-support | `oas-3-2-replay` | `5faa738f` (`a964cd06^`) | regression: replays #4153 plus the gap #4295 fixed |
| add-oas-support | `oas-3-3-upstream-gate` | `main` | generalization: a version no skill mentions; must stop at the ApiDOM gate |
| add-json-schema-support | `json-schema-2020-12-plan` | `main` | regression: the design doc's swagger-client part against today's code |
| review-spec-support | `oas-3-2-real-defect` | `a964cd06` | the real defects of #4153: subtree resolver, 3.1 resolve strategy import, thin tests |

They haven't been run yet (`FOLLOW-UPS.md`). The regression cases share answers with the skills
(the skills were written from the same history), so they measure regressions more than ability;
keep the generalization case honest.

## Development Guidelines

Carried over from the ApiDOM skills (`swagger-api/apidom`, `.claude/skills/README.md`):

1. **Templates come from real files.** Name the file a template was copied from. The flat skill
   this set replaces had invented an execute layout; skills must not.
2. **Never name a function, file or script you haven't checked exists.**
3. **One rule, one place.** Repository conventions live in CLAUDE.md; wiring lessons in
   `add-oas-support/references/review-lessons.md`.
4. **Prefer a script over a prose check** when the check is mechanical, and keep
   `test/smoke.sh` passing.
5. **Questions need a fallback.** Skills may run as subagents that can't ask; each "ask the
   user" says what to assume and where to record it.
6. **Lessons go into rules, answers don't.** Add the general lesson from a review, not the
   answer for one version.
7. **State-dependent facts carry a date** and the command that re-checks them.

New skills: `.claude/skills/{name}/SKILL.md` with `name` and a `description` that says when to
use it, SKILL.md under 500 lines, details in `references/`, at least one eval case.
