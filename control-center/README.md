# Control Center

Kayla's single screen for the finals (PRD "Control Center"). A local web dashboard on
**http://localhost:4000**, built to match the approved mockup (`mockup/index.html`).
It runs on the laptop because it reads the agents' local files and calls `gh`.

## Run

```bash
npm run control-center            # http://localhost:4000
PORT=4100 npm run control-center  # another port
REPO=owner/name npm run control-center   # override the repo gh would detect
```

Open http://localhost:4000/?demo=1 for the sample-data version (no GitHub needed; actions are simulated).

Requirements: Node 22+, `gh` logged in as the **personal** account. The server removes `GITHUB_TOKEN` and
`GH_TOKEN` from every `gh` call, so gh uses the login in `~/.config/gh/hosts.yml`. If that login is the
Nanit account, run `GITHUB_TOKEN= gh auth login` once and pick kaylamenashe8.

The server binds `127.0.0.1` only. POST actions require a JSON body and an `Origin` of this server, so
other sites in the browser cannot trigger them.

## Where the data comes from

| Panel | Source | Refresh |
|---|---|---|
| Agents | `.agents/status/<agent>.json` (written by `.claude/hooks/status.mjs`); "quiet 10m+" when no update for 10 minutes | every 10 s |
| Review queue | `gh pr list` (non-draft). Agent = branch `agent/<name>`; priority = `P1`/`P2`/`P3` label; cause / fix / self-review / 10/10 from the PR body, else the agent's last `docs/CHANGELOG.md` entry; "outside its files" = files not under the agent's `Owns (write)` row in `.claude/agents/<agent>.md` | gh results cached 20 s |
| Runs | `gh run list -w ci.yml` and `-w stability-gate.yml`; gate pills from `gh run view --json jobs` (jobs named `run-1`..`run-5`) | 20 s |
| Test plan | pinned issue "Automation Test Plan" (its task-list order) + `gh issue list`; `skipped-bug` / `not-added` labels; "in review" when an open PR says `Closes #n` | 20 s |
| Bugs | `docs/BUGS.md`: `### DRAFT-NN: title` blocks (`- Spira: pending` = draft, `- Spira: SPIRA-12` = filed) + table rows with a SPIRA id | every 10 s |
| Clock | phases from `docs/TIMELINE.md`, gates at 19:15, 20:00, 20:20, submit 20:55 | live |

When a source fails (no repo yet, gh logged out, a workflow not pushed yet), the page shows the rest and
lists the problems in a yellow "Some data is missing" box.

## What each button runs

| Button | Runs |
|---|---|
| Send note | appends `- <time> NOTE from Lead: <text>` to `.agents/inbox/<agent>.md` |
| Pause / Resume / Pause all | appends `PAUSE` / `RESUME` to the inbox and sets the agent's status |
| Approve and merge | `gh pr review <n> --approve` then `gh pr merge <n> --squash`. Refused (409) while an open PR from an earlier merge-order agent exists; the button turns into "Merge anyway" for a second, deliberate click |
| Ask for changes | `gh pr review <n> --request-changes -b "<text>"` (agents read PR comments before resuming) |
| Diff (in the PR sheet) | `gh pr diff <n>`, first 400 lines |
| Start gate | `gh workflow run stability-gate.yml -f mode=parallel|sequential` |
| File in Spira | `npx tsx scripts/spira-file.ts --from-bugs docs/BUGS.md --id DRAFT-NN --submit` |
| Report / History / Run / GitHub links | open GitHub Pages or GitHub in a new tab |

## Fallback if the dashboard fails on the day

Use GitHub directly: the PR list filtered by `P1` / `P2` / `P3` labels (review with `/review <n>` in
Claude Code), the pinned "Automation Test Plan" issue, and the Actions tab for gate runs.
