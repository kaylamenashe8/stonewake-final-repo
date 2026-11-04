#!/usr/bin/env bash
# Apply the itac-kit to a competition repo without clobbering its tests or page objects.
#
#   scripts/apply-kit.sh <target-repo-dir> [--dry-run]
#
# Rules per kit file:
#   missing in target            -> copied
#   identical                    -> skipped
#   differs, under tests/ src/pages/ src/components/ or README.md  -> target kept (theirs wins)
#   differs, anything else (configs, workflows, CLAUDE.md, ...)    -> theirs backed up to <file>.orig,
#                                                                     kit version installed, listed for merge
#   package.json                 -> merged with node: kit devDependencies + scripts added
#                                   (a target script that differs is kept as "orig:<name>")
set -euo pipefail

KIT="$(cd "$(dirname "$0")/.." && pwd)"
TARGET="${1:-}"
DRY=0
[ "${2:-}" = "--dry-run" ] && DRY=1
if [ -z "$TARGET" ] || [ ! -d "$TARGET" ]; then
  echo "usage: $0 <target-repo-dir> [--dry-run]" >&2
  exit 2
fi
TARGET="$(cd "$TARGET" && pwd)"
if [ "$TARGET" = "$KIT" ]; then echo "target is the kit itself" >&2; exit 2; fi

copied=(); kept=(); merged=(); same=0

# Kit files: tracked + untracked-but-not-ignored, minus things that must never travel.
files=()
while IFS= read -r f; do files+=("$f"); done < <(git -C "$KIT" ls-files --cached --others --exclude-standard | grep -vE \
  '^(package\.json|package-lock\.json|\.env$|node_modules/|test-results/|playwright-report/|blob-report/|\.auth/|crawler/out/|triage/out/|\.agents/status/.+\.json$|.*\.orig$)' | sort -u)

theirs_win() {
  case "$1" in
    tests/*|src/pages/*|src/components/*|README.md) return 0 ;;
    *) return 1 ;;
  esac
}

for f in ${files[@]+"${files[@]}"}; do
  src="$KIT/$f"; dst="$TARGET/$f"
  [ -f "$src" ] || continue
  if [ ! -e "$dst" ]; then
    copied+=("$f")
    if [ $DRY -eq 0 ]; then mkdir -p "$(dirname "$dst")"; cp -p "$src" "$dst"; fi
  elif cmp -s "$src" "$dst"; then
    same=$((same + 1))
  elif theirs_win "$f"; then
    kept+=("$f")
  else
    merged+=("$f")
    if [ $DRY -eq 0 ]; then cp -p "$dst" "$dst.orig"; cp -p "$src" "$dst"; fi
  fi
done

# package.json merge
pkg_note="(no package.json in target: kit package.json copied)"
if [ -f "$TARGET/package.json" ]; then
  pkg_note=$(KIT="$KIT" TARGET="$TARGET" DRY="$DRY" node -e '
    const fs = require("fs");
    const kit = JSON.parse(fs.readFileSync(process.env.KIT + "/package.json", "utf8"));
    const path = process.env.TARGET + "/package.json";
    const t = JSON.parse(fs.readFileSync(path, "utf8"));
    const notes = [];
    t.devDependencies = t.devDependencies || {};
    for (const [k, v] of Object.entries(kit.devDependencies || {})) {
      const cur = t.devDependencies[k] || (t.dependencies || {})[k];
      if (cur && cur !== v) notes.push(`  dep ${k}: ${cur} -> ${v}`);
      if (t.dependencies && t.dependencies[k]) delete t.dependencies[k];
      t.devDependencies[k] = v;
    }
    t.scripts = t.scripts || {};
    for (const [k, v] of Object.entries(kit.scripts || {})) {
      if (t.scripts[k] && t.scripts[k] !== v) { t.scripts["orig:" + k] = t.scripts[k]; notes.push(`  script ${k}: theirs kept as orig:${k}`); }
      t.scripts[k] = v;
    }
    if (!t.type) notes.push("  note: target has no \"type\"; kit scripts run under tsx either way. Set \"type\": \"module\" only if their .js configs are ESM.");
    if (process.env.DRY !== "1") { fs.copyFileSync(path, path + ".orig"); fs.writeFileSync(path, JSON.stringify(t, null, 2) + "\n"); }
    console.log(notes.length ? notes.join("\n") : "  no conflicts");
  ')
elif [ $DRY -eq 0 ]; then
  cp "$KIT/package.json" "$TARGET/package.json"
fi

mkdir -p "$TARGET/.agents/status" 2>/dev/null || true

echo "== apply-kit $( [ $DRY -eq 1 ] && echo '(dry run)' ) -> $TARGET"
echo "copied:   ${#copied[@]} files"
echo "same:     $same files"
echo "kept (theirs wins, review by hand): ${#kept[@]}"
for f in ${kept[@]+"${kept[@]}"}; do echo "  $f"; done
echo "replaced (theirs saved as .orig — MERGE THESE): ${#merged[@]}"
for f in ${merged[@]+"${merged[@]}"}; do echo "  $f   (diff: diff -u $f.orig $f)"; done
echo "package.json:"
echo "$pkg_note"
cat <<'NEXT'

Next steps
  1. cd <target> && npm install && npx playwright install --with-deps chromium (or use Docker)
  2. Merge every .orig above (Architect owns playwright.config.ts, tsconfig.json, eslint.config.mjs)
  3. cp .env.example .env and fill BASE_URL / TEST_USER / TEST_PASSWORD
  4. scripts/setup-secrets.sh -R <owner>/<repo>
  5. LINT_LEVEL=warn npm run lint  (count the baseline), then npm run verify
  6. git tag baseline on the untouched commit BEFORE committing the kit (D1), then commit the kit
NEXT
