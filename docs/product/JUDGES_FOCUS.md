# Judges' focus (from the ITAC brief email, 2026-11-04)

Luca, who owns the system at Stonewake, recommends starting with these six flows:

1. **Deal Book**: search and filter deals, open a deal with its summary and sources, export it.
2. **Screenings**: run a background check on a company and read the result with its sources.
3. **Network and Institutions**: a company's profile, its financing and its ownership chain.
4. **Countries**: a country's risk score and its indicators.
5. **Monitoring and Portfolio**: add a company to monitoring and receive its updates.
6. **API and MCP**: read the same data through the API and through the MCP server. Both are read-only.

These six are a starting point, not a limit. The rest of the product is in scope too, including performance and security testing on the day.

## Required deliverables

1. **Improved code**: the test repo, stabilized and extended (gate 5/5 green).
2. **Updated STP**: the software test plan (kit: `docs/STP.md`), updated to Stonewake and the six flows.
3. **Bug report**: every product bug found, with steps, expected, actual and evidence (kit: `docs/BUGS.md`, filed with `npm run spira`).

## Rules from the opening briefing (Zoom, 17:43-17:57)

- **Scenario:** you joined a new company. A developer with no testing background wrote this automation; it sort of works and is flaky. Make it a real, stable project. "Lots of things don't work well": find them yourself.
- **Stack is fixed:** TypeScript only, Playwright, GitHub, GitHub Actions allowed. Same for everyone, for fairness.
- **AI is fully open** (any tool or model). **Very important for scoring:** show how you worked with the AI: every model used and every prompt. Ask the AI to summarise the session if needed. -> `docs/AI_LOG.md` + the prompt logger hook.
- **Deliverables:** the code with green runs; a **bug report**; an updated STP; a **video** that shows the run executing (can be recorded; a short walkthrough is fine).
- **A test that stays red because of a product bug is acceptable:** keep it (skipped/annotated) and state why it remains.
- **Repo:** fork the given repo to your own account; no PRs to the original. Work in your repo and submit its link through the form.
- **Judging** happens remotely tomorrow; judges include Omri Maman, Igor, Sefi, Yoni, Nachum Dimer, Yair, Jack.
- **Product questions:** Luca (Stonewake) answers in the WhatsApp group during the competition.

## Product notes from Luca's walkthrough

- Three pillars: deal sourcing (Deal Book, Tenders), counterparty intelligence (Network, Screenings), portfolio monitoring.
- **Teams:** Real Estate, Export Finance, Project Finance. The Deal Book changes with the team you pick (Project Finance does not see real-estate deals).
- **Deal Book:** deals found in public sources; open one for its brief, its source and "view at source"; each deal has a score, and **Scoring** settings change which deals appear and how they rank.
- **Tenders:** like the Deal Book but official government data; can be added to the Deal Book.
- **Countries:** compiled country risk score. **Institutions:** exposure to institutions (less important).
- **Network:** who owns and runs a company, ownership chain, subsidiaries.
- **Monitoring:** monitor a deal or a company and get periodic updates.
- **Portfolio:** upload a book or add a company (searched from the Network); it computes credit-monitoring scores and shows financing, register records, officers and ownership.
- Data is sometimes incomplete (restricted or paid datasets), so some companies show more than others; every value links to its source. Do not treat "less data" alone as a bug.
- **Screening:** a person or a company; enter the name and details, start the screening, read adverse media (corruption, bribery, sanctions, fraud...).

## Environment rules

- The final runs on the live product, in separate workspaces set up only for the competition and filled with test data.
- Each competitor gets a personal account; the invite comes from Stonewake to the registration email.
- The public site and docs (stonewake.ai, docs.stonewake.ai) are background only. They are not the test target, and nothing found on them is a test target.
- Product questions go to the judges, who relay them to Stonewake.
- Submit everything through the form before the competition ends: https://forms.gle/TuATq3R2cu8hL8yY9
