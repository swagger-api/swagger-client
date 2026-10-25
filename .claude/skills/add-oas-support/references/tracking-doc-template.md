# Tracking Doc Template

Create `ADD-OAS-{VERSION}.md` (e.g. `ADD-OAS-3.3.md`) at the repository root. Don't commit it;
it carries the work across sessions.

```markdown
# OpenAPI {X.Y} in swagger-client

- Pinned patch: {X.Y.Z} ({spec URL})
- Parent line: {X.Y-1}
- ApiDOM release: {version} (namespace, apidom-reference openapi-{X-Y} strategies)
- ApiDOM tracking doc: {path or "not available"}

## spec-status.mjs

{output of spec-status.mjs --oas X.Y, before and after each PR}

## Field Map (what swagger-client needs)

| Field / change | Object | Area: resolution / normalization / execute | PR | Status |
|----------------|--------|--------------------------------------------|----|--------|
| {e.g. $self}   | OpenAPI | resolution (base URI) | 2 | todo |

## PR Plan

| PR | Branch | Content | State |
|----|--------|---------|-------|
| 1 | feat/oas{XY} | basic support, parity with {X.Y-1} | |
| 2 | feat/oas{XY}-{feature} | {rows} | |

## Decisions

| DECIDE line or question | Answer | By |
|-------------------------|--------|----|
| {file names X.Y-1 but not X.Y} | {wired / parent-only because ...} | {user / assumption} |
```
