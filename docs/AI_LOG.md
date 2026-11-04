# AI log

> How AI was used. The prompt log at the bottom is appended automatically by the `UserPromptSubmit` hook
> (`.claude/hooks/prompt-logger.mjs`, secrets redacted). The Scribe fills the curated sections.

## Tools
Claude Code (Lead session + subagents in `.claude/agents/`), Playwright MCP, Playwright test agents (planner/generator/healer), `anthropics/claude-code-action` in triage.yml, direct Messages API fallback (`triage/claude-diagnose.ts`).

## What AI created or changed (per folder)
| Folder | Created / changed by | Reviewed by Kayla (commit) |
|---|---|---|
| | | |

## AI-generated tests promoted (human-reviewed)
| Test | Origin (crawler / Claude) | Promotion PR | Reviewing commit |
|---|---|---|---|
| | | | |

## Key prompts
### Session 1: setup and product study (Claude Code, model Claude Opus 5.5, 17:30-18:10, run outside this repo so the hook did not log it)
1. "Review this PRD ... build what I need": built the itac-kit in advance (disclosed, D12); dry runs on 3-4 Nov.
2. Read the Stonewake brief email and "read all of the documentation on the site to fully understand the product" (docs only, no crawling, not a test target): 3 Claude subagents read docs.stonewake.ai (llms-full.txt) and the public site in parallel -> `docs/product/notes-A/B/C.md`.
3. "Make sure you take into account ... where we should focus our testing": notes re-organised around the judges' six flows -> `docs/product/JUDGES_FOCUS.md`.
4. "Fork it for me" + "I prefer master": forked, kept `master`, applied the kit, pointed the kit at `master` (D14).
5. "We are tracking all of these bugs ... so we can explain everything": automation faults logged in `docs/FIXES.md` (F1-F10).
6. Demo video: frames extracted every 4 s with ffmpeg and read by Claude -> `docs/product/DEMO_VIDEO.md`.
7. Login PDF: switched from the judges' committed login to our own Finalist 4 workspace (F9, D15).
8. Opening-briefing transcript: rules and Luca's walkthrough added to `JUDGES_FOCUS.md`.

## Reviewed and rejected
| What AI proposed | Why Kayla rejected it |
|---|---|
| | |

## Prompt log (auto-appended)

