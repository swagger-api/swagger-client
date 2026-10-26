# Fixture

Not read by `claude plugin eval`; used when running this case with skill-creator.

Worktree at `5faa738f` (`a964cd06^`, the commit before #4153, OAS 3.2 support; its lockfile
has ApiDOM 1.5.1, without 3.2):
`git worktree add ../swagger-client-skills-workspace/wt-pre-oas32 5faa738f`.

Runs are read-only in the fixture: they write their output (`PLAN.md`, the review report) to the
run's outputs directory, never into the worktree. Read the skill files from the main checkout's
`.claude/skills/` (fixture commits predate the skills); call scripts by their main-checkout path
with `--root <worktree>`. Run `npm ci` in the worktree so `node_modules` matches the
commit's lockfile (about 5 seconds). Don't link the main checkout's `node_modules`: it holds a
newer ApiDOM, so upstream checks would pass for packages the commit doesn't lock.
