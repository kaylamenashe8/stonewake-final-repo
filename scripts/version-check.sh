#!/usr/bin/env bash
# Fails when the Playwright Docker image tag differs from @playwright/test (package.json + package-lock.json).
# Checks Dockerfile and every workflow under .github/workflows.
set -euo pipefail
cd "$(dirname "$0")/.."

pkg=$(node -p "(require('./package.json').devDependencies||{})['@playwright/test'] || (require('./package.json').dependencies||{})['@playwright/test'] || ''")
pkg=${pkg#^}; pkg=${pkg#~}
lock=""
if [ -f package-lock.json ]; then
  lock=$(node -p "((require('./package-lock.json').packages||{})['node_modules/@playwright/test']||{}).version || ''")
fi

fail=0
if [ -z "$pkg" ]; then echo "✗ @playwright/test not found in package.json"; exit 1; fi
if ! [[ "$pkg" =~ ^[0-9]+\.[0-9]+\.[0-9]+$ ]]; then
  echo "✗ @playwright/test must be pinned to an exact version (found '$pkg')"; fail=1
fi
if [ -n "$lock" ] && [ "$lock" != "$pkg" ]; then
  echo "✗ package-lock.json has @playwright/test $lock, package.json has $pkg"; fail=1
fi

files=(Dockerfile)
while IFS= read -r f; do files+=("$f"); done < <(ls .github/workflows/*.yml .github/workflows/*.yaml 2>/dev/null || true)
for f in "${files[@]}"; do
  [ -f "$f" ] || continue
  while IFS= read -r tag; do
    [ -z "$tag" ] && continue
    if [ "$tag" != "$pkg" ]; then
      echo "✗ $f uses playwright image v$tag, expected v$pkg"; fail=1
    fi
  done < <(grep -oE 'mcr\.microsoft\.com/playwright:v[0-9]+\.[0-9]+\.[0-9]+' "$f" | sed -E 's/.*:v//' | sort -u)
done

if [ "$fail" -ne 0 ]; then exit 1; fi
echo "✓ Playwright $pkg matches the Docker image tag in ${#files[@]} file(s)"
