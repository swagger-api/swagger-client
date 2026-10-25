# Fixture

Not read by `claude plugin eval`; used when running this case with skill-creator.

Worktree at `a964cd06` (#4153, OAS 3.2 support, before the #4295 fix); the review compares it with
`a964cd06^`: `git worktree add ../swagger-client-skills-workspace/wt-oas32 a964cd06`.

Runs are read-only in the fixture: they write their output (`PLAN.md`, the review report) to the
run's outputs directory, never into the worktree. Read the skill files from the main checkout's
`.claude/skills/` (fixture commits predate the skills); call scripts by their main-checkout path
with `--root <worktree>`. Link the main checkout's `node_modules` into the worktree
(`ln -s <main>/node_modules <worktree>/node_modules`) so upstream checks have packages to read;
they then describe today's packages, not the fixture's.
