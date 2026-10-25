# Review Checklist

Sections follow `.claude/skills/add-oas-support/references/integration-points.md`; the lessons
are in `.claude/skills/add-oas-support/references/review-lessons.md` (numbers in brackets).

## 1. Upstream and Dependencies

- [ ] Every `@swagger-api/apidom-*` package on one release; the lock file changed with it.
- [ ] The namespace in `dependencies` and `link:apidom`; adapters in `optionalDependencies`
      matching apidom-reference's; `docs/usage/installation.md` lists them.

## 2. Predicate

- [ ] OpenAPI: the regex accepts every patch of the line and nothing else; `isOpenAPI3` includes
      it. Run it against the new version, the parent and the next line.
- [ ] JSON Schema: root `$schema` only, the exact identifier with an empty fragment normalised,
      no `openapi`/`swagger` field; refuses the other scheme, custom meta-schemas and a nested
      `$schema`.

## 3. Strategy

- [ ] `name`, `match` and every apidom-reference import name the new version or dialect; no
      file of the new version imports the parent's strategy, element or parsers [2].
- [ ] `normalize`: pre/post normalization and the `resolve.cache` filling as in the parent [7];
      JSON Schema: the identity.
- [ ] `resolve.js`: base URI, fragments, invalid `pathDiscriminator` returns the document with no
      errors [8], `circular`/`circularReplacer`, errors collected.

## 4. Dereference Strategy and Parsers

- [ ] `visitors/root.js` merges the same visitors as the parent's [3]; JSON Schema: no
      `parameters.js`, macros and `allOf` per the recorded decision.
- [ ] New referenceable fields of the version have a hook or branch in `visitors/dereference.js`
      and fixtures; JSON Schema: the hook is the dialect's traversal key, `$dynamicRef` untouched.
- [ ] Cycles: internal and external cycle fixtures; `useCircularStructures` both ways [6].
- [ ] Parsers: names, media types, detection (JSON Schema: root predicate, not a text regex).

## 5. Registration and Version Lists

- [ ] `Swagger.resolveStrategies`, both default arrays in order (newest OpenAPI first; JSON Schema
      before `generic`), `Swagger.apidom` exports.
- [ ] `src/subtree-resolver/index.js`: an ApiDOM-based OpenAPI version is in the normalization
      list (`skipNormalization: !isOpenAPI31(obj) && !isOpenAPI32(obj) && ...`) [1].
- [ ] Every `DECIDE unwired` file is wired or justified in the tracking doc; version-gated helpers
      (`each-operation.js`) extended where the feature continues [9].
- [ ] Module defaults in `src/resolver/index.js` and `src/subtree-resolver/index.js` unchanged.

## 6. Execute

- [ ] New HTTP methods, operation locations, parameter locations or styles, request bodies,
      security schemes and server rules of the version are implemented in `src/execute/oas3/` or
      the helpers, gated by the predicate, with tests [4]; older versions unchanged.

## 7. Build, Lint, Docs

- [ ] `.eslintrc.js` patterns for the new apidom-reference subpaths; `npm run lint` clean.
- [ ] `npm run build` within the webpack limits (a raised limit is justified in the PR).
- [ ] README compatibility table, CLAUDE.md strategy list and supported versions.

## 8. Tests

- [ ] Predicate tests for the new predicate (a `describe` of its own) [10].
- [ ] The parent's strategy, dereference and parser tests mirrored, or the gap recorded
      (`DECIDE tests`) [10].
- [ ] Execute tests for every execute feature; a regression test that the parent behaves as
      before.
- [ ] JSON Schema: the cases in `add-json-schema-support/references/strategy-design.md` "Tests".
- [ ] `npm run test:unit` and `npm run test:artifact` pass on the branch.
