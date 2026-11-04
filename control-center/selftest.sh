#!/usr/bin/env bash
# Live self-test of every gh-backed Control Center action against the real repo.
#   bash control-center/selftest.sh            # PR flow: state, diff, request changes, approve + merge, cleanup
#   bash control-center/selftest.sh --gate     # also triggers stability-gate.yml (parallel) and checks it queued
# Needs: `GITHUB_TOKEN= gh auth login` done once as the personal account; origin = github-personal SSH.
set -euo pipefail
cd "$(dirname "$0")/.."
unset GITHUB_TOKEN GH_TOKEN
PORT=4099
BASE="http://127.0.0.1:$PORT"
WITH_GATE=0; [ "${1:-}" = "--gate" ] && WITH_GATE=1
pass() { printf '  \033[32mPASS\033[0m %s\n' "$1"; }
fail() { printf '  \033[31mFAIL\033[0m %s\n' "$1"; FAILED=1; }
FAILED=0
post() { curl -s -X POST -H "Origin: $BASE" -H 'Content-Type: application/json' -d "$2" "$BASE$1"; }

echo "1. gh auth"
LOGIN=$(gh api user -q .login 2>/dev/null || true)
REPO=$(gh repo view --json nameWithOwner -q .nameWithOwner 2>/dev/null || true)
[ -n "$REPO" ] && pass "gh as $LOGIN sees $REPO" || { fail "gh cannot see the repo (run: GITHUB_TOKEN= gh auth login)"; exit 1; }

echo "2. start server"
PORT=$PORT node control-center/server.mjs >/tmp/cc-selftest.log 2>&1 &
SRV=$!
trap 'kill $SRV 2>/dev/null || true' EXIT
for _ in $(seq 1 20); do curl -s "$BASE/api/state" >/dev/null && break; sleep 0.5; done

echo "3. open a throwaway PR (branch agent/scribe-<ts>)"
for l in P1 P2 P3; do gh label create "$l" --force >/dev/null 2>&1 || true; done
BR="agent/scribe-$(date +%s)"
git fetch -q origin main
git switch -q -c "$BR" origin/master
mkdir -p docs && echo "Control Center self-test $(date -u +%FT%TZ)" > docs/_cc_selftest.md
git add docs/_cc_selftest.md && git commit -qm "chore: control center self-test (auto-reverted)"
git push -q -u origin "$BR"
PR_URL=$(gh pr create --base master --head "$BR" --title "Control Center self-test" --label P3 \
  --body $'Cause: self-test.\nFix: none.\n- Self-review 1: throwaway\n- e2e: n/a')
N=${PR_URL##*/}
git switch -q - ; git branch -q -D "$BR"
pass "PR #$N opened"

echo "4. GET /api/state lists it (server caches gh for 20s, so poll up to 30s)"
found=1
for _ in $(seq 1 15); do
  post_state=$(curl -s "$BASE/api/state")
  echo "$post_state" | node -e "let d='';process.stdin.on('data',c=>d+=c).on('end',()=>{const s=JSON.parse(d);const p=s.prs.find(x=>x.n===$N);process.exit(p&&p.agent==='scribe'?0:1)})" && { found=0; break; }
  sleep 2
done
[ $found = 0 ] && pass "PR #$N in review queue as scribe" || fail "PR #$N missing from /api/state (errors: $(echo "$post_state" | node -pe 'JSON.stringify(JSON.parse(require("fs").readFileSync(0)).errors)'))"

echo "5. GET /api/pr/$N/diff"
curl -s "$BASE/api/pr/$N/diff" | grep -q "_cc_selftest" && pass "diff served" || fail "diff missing"

echo "6. POST request-changes"
R=$(post "/api/pr/$N/request-changes" '{"text":"self-test: please ignore"}')
echo "$R" | grep -q '"ok":true' && pass "request-changes: $R" || fail "request-changes: $R"
gh pr view "$N" --json comments,reviews -q '[.comments[].body, .reviews[].body] | join("\n")' | grep -q "self-test: please ignore" \
  && pass "request visible on GitHub" || fail "request not found on the PR"

echo "7. POST approve-merge"
R=$(post "/api/pr/$N/approve-merge" '{"force":true}')
echo "$R" | grep -q '"ok":true' && pass "approve-merge: $R" || fail "approve-merge: $R"
[ "$(gh pr view "$N" --json state -q .state)" = "MERGED" ] && pass "PR #$N merged" || fail "PR #$N not merged"

echo "8. cleanup main"
git fetch -q origin main
if git cat-file -e origin/master:docs/_cc_selftest.md 2>/dev/null; then
  WT=$(mktemp -d); git worktree add -q "$WT" origin/master
  (cd "$WT" && git rm -q docs/_cc_selftest.md && git commit -qm "chore: remove control center self-test file" && git push -q origin HEAD:master)
  git worktree remove --force "$WT"; pass "self-test file removed from main"
fi
git push -q origin --delete "$BR" 2>/dev/null || true

echo "9. local actions"
R=$(post "/api/agent/scribe/note" '{"text":"self-test note"}'); echo "$R" | grep -q '"ok":true' && pass "note" || fail "note: $R"
R=$(post "/api/agent/scribe/pause" '{}');  echo "$R" | grep -q '"ok":true' && pass "pause" || fail "pause: $R"
R=$(post "/api/agent/scribe/resume" '{}'); echo "$R" | grep -q '"ok":true' && pass "resume" || fail "resume: $R"
rm -f .agents/inbox/scribe.md .agents/status/scribe.json

if [ $WITH_GATE = 1 ]; then
  echo "10. POST /api/gate (real stability gate run, uses Actions minutes)"
  R=$(post "/api/gate" '{"mode":"parallel"}'); echo "$R" | grep -q '"ok":true' && pass "gate: $R" || fail "gate: $R"
  sleep 5; gh run list -w stability-gate.yml -L 1 --json status,url -q '.[0] | "\(.status) \(.url)"'
fi

[ $FAILED = 0 ] && echo "ALL PASS" || { echo "SOME CHECKS FAILED (server log: /tmp/cc-selftest.log)"; exit 1; }
