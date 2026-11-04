# Stonewake at a glance (organizers' one-page PDF)

Source: `stonewake-at-a-glance.pdf` from the organizers, received 2026-11-04 18:07. Official map of the
10 dashboard areas and where each one opens. Every area opens from the left sidebar; a workspace shows
only the parts its team uses.

| # | Area | What it is | Where |
|---|---|---|---|
| 1 | Deal Book | Live export finance, project finance and real estate deals, each with its sources. The team selector at the top of the sidebar switches whose book you see. The **Following** tab holds the deals, companies, people and topics you follow. | Sidebar > Deal Book |
| 2 | Network and Institutions | Company lookup: owners, officers, register data, sanctions and risk status, each linked to its source. Institutions lists the agencies, banks, multilaterals and exporters behind your deals. | Sidebar > Network (company lookup), Institutions (registry) |
| 3 | Screenings | Check an organization, a country or a person against official sanctions lists and adverse media. Every finding cites its source; **a person is never rated**. Each screening downloads as a PDF report. | Sidebar > Screenings > New screening |
| 4 | Portfolio | Monitored exposures with status and score, status changes in the last 30 days, overdue reviews, sanctions name matches awaiting review. **Your alerts** sits on this page. | Sidebar > Portfolio |
| 5 | Countries | Country risk for every market from Transparency International, World Bank, OECD, verified adverse news, OFAC/EU/UN sanctions programs, EU high-risk list, FATF lists. Open a country for its cited profile. | Sidebar > Countries |
| 6 | Tenders | Public tenders matching the desk's sectors and regions, found daily, each with its notice. **Add to Deal Book** or **Dismiss**. | Sidebar > Tenders |
| 7 | Monitoring and alerts | What is checked for followed deals and names and how often; pause, resume or change frequency. New alerts arrive under Your alerts. | Sidebar > Monitoring; Your alerts on Portfolio |
| 8 | Exports | Deals, companies, screenings and countries as PDF; deals and companies also as PowerPoint. Export on Deal Book and Countries saves an Excel workbook. | Download buttons on each page |
| 9 | API and MCP | API and MCP server documented at docs.stonewake.ai. Admins create API keys in Settings. **Connected assistants** lists every assistant allowed to read the workspace (always read-only) and can end its access. | docs.stonewake.ai, Settings |
| 10 | Settings | Workspace, team and role, alert mail and dashboard alerts, Connected assistants. Admins also: Members, API keys, Single sign on, Sign in and directory, Audit log (CSV download). | Click the workspace name at the bottom of the sidebar |

Help: competition WhatsApp group, **How it works** at the bottom of the sidebar, docs.stonewake.ai.

## What this adds to DEMO_VIDEO.md and the notes (testing impact)
- **Tenders** and **Institutions** are areas the demo-video sidebar did not show. Check which ones our
  Finalist 4 workspace actually has before planning tests ("your workspace shows the parts your team uses").
- **Settings** opens from the workspace name at the bottom of the sidebar, not from a sidebar item.
- **Your alerts** lives on the Portfolio page, not on Monitoring.
- Testable rules stated as facts (good assertions / bug oracles):
  - a screening of a **person never shows a rating** (score/risk level);
  - every finding/fact is **cited with a source link** (Deal Book, Network, Screenings, Countries, Tenders);
  - Connected assistants are **always read-only**;
  - export formats per page: PDF (deals, companies, screenings, countries), PPTX (deals, companies),
    XLSX (Export on Deal Book and Countries). Assert with `page.waitForEvent('download')` + filename extension.
- Team selector changes whose Deal Book is shown: tests must pin the team so data does not leak between tests.
