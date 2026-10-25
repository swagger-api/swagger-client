#!/usr/bin/env bash
# Smoke test for the skill scripts. Run from the repository root after changing a script:
#   bash .claude/skills/add-oas-support/scripts/test/smoke.sh
# Checks exit codes (usage errors exit 2, real runs exit 0, 1 or 3, never crash), and replays the
# OAS 3.2 commit a964cd06, whose subtree resolver skipped normalization for 3.2 until #4295.
set -u
DIR="$(cd "$(dirname "$0")/.." && pwd)"
failures=0

expect() {
  local allowed="$1"
  shift
  "$@" >/dev/null 2>&1
  local code=$?
  if [[ " $allowed " != *" $code "* ]]; then
    echo "FAIL (exit $code, expected one of: $allowed): $*"
    failures=$((failures + 1))
  fi
}

expect_output() {
  local pattern="$1"
  shift
  if ! "$@" 2>&1 | grep -qE "$pattern"; then
    echo "FAIL (no line matching /$pattern/): $*"
    failures=$((failures + 1))
  fi
}

expect_no_output() {
  local pattern="$1"
  shift
  if "$@" 2>&1 | grep -qE "$pattern"; then
    echo "FAIL (unexpected line matching /$pattern/): $*"
    failures=$((failures + 1))
  fi
}

expect "0" node "$DIR/spec-status.mjs" --help
expect "2" node "$DIR/spec-status.mjs"
expect "2" node "$DIR/spec-status.mjs" --oas 3
expect "2" node "$DIR/spec-status.mjs" --oas 3.2 --json-schema 2020-12
expect "2" node "$DIR/spec-status.mjs" --json-schema draft-99
expect "2" node "$DIR/spec-status.mjs" --json-schema 2020-12 --parent 3.1
expect "2" node "$DIR/spec-status.mjs" --oas 3.2 --root /nonexistent
expect "0 1 3" node "$DIR/spec-status.mjs" --oas 3.2
expect "0 1 3" node "$DIR/spec-status.mjs" --oas 3.1 --parent 3.0
expect "0 1 3" node "$DIR/spec-status.mjs" --oas 4.0
for dialect in 2020-12 2019-09 draft-07 draft-06 draft-04; do
  expect "0 1 3" node "$DIR/spec-status.mjs" --json-schema "$dialect"
done
expect_no_output "^(MISSING|DECIDE) .*subtree-resolver" node "$DIR/spec-status.mjs" --oas 3.2
expect_output "unwired +src/helpers/each-operation.js" node "$DIR/spec-status.mjs" --oas 3.3

if git cat-file -e 'a964cd06^{commit}' 2>/dev/null; then
  worktree="$(mktemp -d)/a964cd06"
  git worktree add --quiet --detach "$worktree" a964cd06
  expect_output "MISSING +wiring +src/subtree-resolver/index.js skips normalization for 3.2" \
    node "$DIR/spec-status.mjs" --root "$worktree" --oas 3.2
  expect_output "DECIDE +unwired +src/subtree-resolver/index.js" \
    node "$DIR/spec-status.mjs" --root "$worktree" --oas 3.2
  git worktree remove --force "$worktree"
else
  echo "SKIP a964cd06 replay: commit not in this clone"
fi

# minimal checkout whose installed 2020-12 namespace lacks, then has, keyMap/getNodeType exports
root="$(mktemp -d)"
namespace="$root/node_modules/@swagger-api/apidom-ns-json-schema-2020-12/src"
mkdir -p "$root/src/resolver/strategies" "$namespace"
echo 'exports.refract = refract;' >"$namespace/index.cjs"
expect_output "UPSTREAM +upstream +.*doesn't export keyMap and getNodeType" \
  node "$DIR/spec-status.mjs" --root "$root" --json-schema 2020-12
echo 'exports.keyMap = keyMap; exports.getNodeType = getNodeType;' >"$namespace/index.cjs"
expect_output "OK +upstream +.*exports keyMap and getNodeType" \
  node "$DIR/spec-status.mjs" --root "$root" --json-schema 2020-12
rm -rf "$root"

expect "0" node "$DIR/verify-urls.mjs" --help
expect "2" node "$DIR/verify-urls.mjs"

if [[ $failures -gt 0 ]]; then
  echo "$failures smoke check(s) failed"
  exit 1
fi
echo "smoke OK"
