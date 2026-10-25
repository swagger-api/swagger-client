# Review Lessons

Defect classes from earlier version work in this repository, each with the fix that found it.
Read before wiring; `/review-spec-support` checks each one.

| # | Lesson | Found by | Check |
|---|--------|----------|-------|
| 1 | **Version lists outside the strategy.** #3575 made the subtree resolver normalize 3.1 after dereferencing (`skipNormalization: !isOpenAPI31(obj)`); #4153 added 3.2 everywhere but there, so subtree resolution, Swagger UI's only path, skipped it for 3.2 until #4295. | #3575, #4295 | `spec-status.mjs`: `MISSING wiring ... subtree-resolver` and the `DECIDE unwired` scan |
| 2 | **Copied files keep the parent's imports.** A new version's `resolve.js` that still imports the parent's apidom-reference resolve strategy resolves with the parent's rules. On `main`, `openapi-3-2-apidom/resolve.js` still uses `resolve/strategies/openapi-3-1`. | this skill's first run | `MISSING wiring ... still imports` |
| 3 | **Plugins the parent applies.** 3.1 resolved without `modelPropertyMacro`, `parameterMacro` and `allOf` merging until they were added as dereference visitors. A new version's `visitors/root.js` must merge the same visitors. | #3521 | diff `visitors/root.js` against the parent's (identical modulo the version on `main`) |
| 4 | **Execute and new shapes.** Server Object overrides needed a fix in execute for 3.1. | #3223 | `isOpenAPI3` includes the version; execute tests for servers |
| 5 | **Normalization that doesn't apply.** Server Object normalization was removed from the 3.1 normalizer. | #3628 | the normalizer runs only the namespace plugins listed in `resolver-architecture.md` |
| 6 | **Cycles and side effects.** Cycle detection in the 3.1 resolver needed three fixes, and resolving had side effects (#3456 changed the dereference strategy's `index.js`). | #2911, #2970, #3226, #3456 | the `cycle-internal` / `cycle-external` fixtures, `useCircularStructures` tests, `immutable` handling |
| 7 | **Cache.** Normalization must return the cached element for an already normalized object. | #3281 | `pojoAdapter` fills `resolve.cache`; strategy tests resolve the same object twice |
| 8 | **Invalid fragments.** Strategies must agree on what an invalid `pathDiscriminator` returns (the document, no errors). | #3760 | a `pathDiscriminator` test with a missing path |
| 9 | **Features gated by one version.** `additionalOperations` is gated by `isOpenAPI32`; a later version that keeps it must extend the gate. | #4238 | the unwired scan lists `each-operation.js` |
| 10 | **Tests thinner than the parent's.** 3.2's dereference tests cover 32 of 3.1's 399 files; the predicate test has no `isOpenAPI32` block. | this skill's first run | `DECIDE tests`, `MISSING tests` |

Read a fix with `git show <sha>`; the PR numbers resolve on
`https://github.com/swagger-api/swagger-client/pull/<n>`.
