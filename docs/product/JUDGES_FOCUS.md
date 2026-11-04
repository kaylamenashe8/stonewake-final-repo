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

A transcript with further instructions is coming; add its rules here.

## Environment rules

- The final runs on the live product, in separate workspaces set up only for the competition and filled with test data.
- Each competitor gets a personal account; the invite comes from Stonewake to the registration email.
- The public site and docs (stonewake.ai, docs.stonewake.ai) are background only. They are not the test target, and nothing found on them is a test target.
- Product questions go to the judges, who relay them to Stonewake.
- Submit everything through the form before the competition ends: https://forms.gle/TuATq3R2cu8hL8yY9
