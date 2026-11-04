#!/usr/bin/env bash
# Backup gate evidence (D2): trigger ci.yml 5 times back to back, each waited on, giving 5 separate run links.
#
#   scripts/gate-5x.sh [-R owner/repo] [--ref master] [--workflow ci.yml]
#
# Stops at the first red run (like the sequential gate). Prints the 5 run URLs at the end.
set -euo pipefail

REPO_ARGS=(); REF="master"; WF="ci.yml"
while [ $# -gt 0 ]; do
  case "$1" in
    -R|--repo) REPO_ARGS=(-R "$2"); shift 2 ;;
    --ref) REF="$2"; shift 2 ;;
    --workflow) WF="$2"; shift 2 ;;
    *) echo "unknown arg: $1" >&2; exit 2 ;;
  esac
done

urls=()
for n in 1 2 3 4 5; do
  before=$(date -u +%Y-%m-%dT%H:%M:%SZ)
  gh workflow run "$WF" --ref "$REF" ${REPO_ARGS[@]+"${REPO_ARGS[@]}"}
  id=""
  for _ in $(seq 1 30); do
    sleep 3
    id=$(gh run list ${REPO_ARGS[@]+"${REPO_ARGS[@]}"} --workflow "$WF" --branch "$REF" --event workflow_dispatch --limit 5 \
      --json databaseId,createdAt --jq "[.[] | select(.createdAt >= \"$before\")] | sort_by(.createdAt) | .[0].databaseId // empty")
    [ -n "$id" ] && break
  done
  if [ -z "$id" ]; then echo "run $n: could not find the triggered run" >&2; exit 1; fi
  url=$(gh run view "$id" ${REPO_ARGS[@]+"${REPO_ARGS[@]}"} --json url --jq .url)
  echo "== run $n/5: $url"
  if gh run watch "$id" ${REPO_ARGS[@]+"${REPO_ARGS[@]}"} --exit-status --interval 15 >/dev/null; then
    urls+=("run-$n ✅ $url")
  else
    urls+=("run-$n ❌ $url")
    echo "Run $n is red — stopping (fix, then restart the 5x)."
    printf '%s\n' "${urls[@]}"
    exit 1
  fi
done

echo "GATE (5x ci.yml): 5/5 GREEN"
printf '%s\n' "${urls[@]}"
