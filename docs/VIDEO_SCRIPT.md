# Summary video script (3-4 min)

> Owner: Scribe, draft by 20:10. Record at 20:40 (screen capture + voice-over; fallback: voice-over on the README scroll).
> Upload as YouTube unlisted or Loom public; link in README and the form.

| Time | Section | On screen | Say (with numbers) |
|---|---|---|---|
| 0:00-0:30 | Starting state | BASELINE counts table, red first CI run | "We got <N> tests: <x> passing, <y> failing, <z> flaky; <h> hard waits, <l> lint errors." |
| 0:30-1:10 | Problems found | FIXES.md category summary | "Top root causes: <category> x<n>, <category> x<n>, ..." |
| 1:10-2:00 | What changed | Repo tree / ARCHITECTURE, lint job, Dockerfile, ci.yml, triage verdict | "Layered POM + fixtures, strict TS + Playwright lint, pinned Docker image, CI with Pages + Slack, a triage ladder ending with Claude." |
| 2:00-2:50 | How stability improved | Before/after flakiness matrix, gate-summary table | "5/5 green, retries 0, 0 heals, run time <before> -> <after>." |
| 2:50-3:30 | Why it is credible | README Known product bugs, Spira + Jam, decision log | "Retries 0, no healing in the gate, 5 parallel independent runs, every known bug disclosed with its Spira ID, everything reproducible from the README." |
| 3:30-3:50 | Close | README links | "Repo, gate run and report are in the README." |
