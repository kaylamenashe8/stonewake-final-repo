#!/usr/bin/env bash
# Push secrets and variables from .env to GitHub with gh. Values are never echoed.
#
#   scripts/setup-secrets.sh -R owner/repo [-f .env]
#
# Secrets: ANTHROPIC_API_KEY (or CLAUDE_CODE_OAUTH_TOKEN fallback, D7), SLACK_WEBHOOK_URL,
#          TEST_USER, TEST_PASSWORD, SPIRA_URL, SPIRA_USER, SPIRA_API_KEY, SPIRA_PROJECT_ID
# Variables: BASE_URL, API_URL, TEST_ID_ATTRIBUTE
set -euo pipefail

REPO=""; ENV_FILE=".env"
while [ $# -gt 0 ]; do
  case "$1" in
    -R|--repo) REPO="$2"; shift 2 ;;
    -f|--file) ENV_FILE="$2"; shift 2 ;;
    *) echo "unknown arg: $1" >&2; exit 2 ;;
  esac
done
if [ -z "$REPO" ]; then echo "usage: $0 -R owner/repo [-f .env]" >&2; exit 2; fi
if [ ! -f "$ENV_FILE" ]; then echo "$ENV_FILE not found (copy .env.example)" >&2; exit 2; fi
command -v gh >/dev/null || { echo "gh CLI required" >&2; exit 2; }

SECRETS=(ANTHROPIC_API_KEY CLAUDE_CODE_OAUTH_TOKEN SLACK_WEBHOOK_URL TEST_USER TEST_PASSWORD SPIRA_URL SPIRA_USER SPIRA_API_KEY SPIRA_PROJECT_ID)
VARS=(BASE_URL API_URL TEST_ID_ATTRIBUTE)

# Read KEY=VALUE without sourcing (no code execution from .env).
value_of() {
  local key="$1" line val
  line=$(grep -E "^[[:space:]]*${key}[[:space:]]*=" "$ENV_FILE" | tail -1 || true)
  [ -z "$line" ] && return 0
  val="${line#*=}"
  val="${val#"${val%%[![:space:]]*}"}"; val="${val%"${val##*[![:space:]]}"}"
  val="${val%\"}"; val="${val#\"}"; val="${val%\'}"; val="${val#\'}"
  printf '%s' "$val"
}

set_count=0; skipped=()
for k in "${SECRETS[@]}"; do
  v=$(value_of "$k")
  if [ -n "$v" ]; then
    printf '%s' "$v" | gh secret set "$k" -R "$REPO" >/dev/null  # value from stdin (never --body -: that stores a literal "-")
    echo "✓ secret  $k"
    set_count=$((set_count + 1))
  else
    skipped+=("$k")
  fi
done
for k in "${VARS[@]}"; do
  v=$(value_of "$k")
  if [ -n "$v" ]; then
    gh variable set "$k" -R "$REPO" --body "$v" >/dev/null
    echo "✓ variable $k"
  else
    skipped+=("$k")
  fi
done

if [ ${#skipped[@]} -gt 0 ]; then echo "– empty, not set: ${skipped[*]}"; fi
if [ -z "$(value_of ANTHROPIC_API_KEY)" ] && [ -z "$(value_of CLAUDE_CODE_OAUTH_TOKEN)" ]; then
  echo "! No Claude credential: the Claude triage step will be skipped (not failed)."
fi
echo "Done: $set_count secret(s) on $REPO. Check: gh secret list -R $REPO"
