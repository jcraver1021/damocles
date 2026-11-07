# Damocles

Where members of Congress stand on a set of priority issues, with cited evidence: votes, bill
sponsorship, statements, scorecards, and campaign finance. Each member gets a citizen index (0–100);
citizen campaigns track sourced positions on specific asks.

```bash
npm install
npm run setup:py   # Python deps (pypdf, ruff)
npm run ingest     # fetch sources, write public/data/
npm run dev
```

## Structure

```text
config/, data/  ──►  ingest/ (npm run ingest)  ──►  public/data/*.json  ──►  src/ (React app)
 (hand-edited)        fetch, snapshot, score         (generated)            (reads only)
```

| Path                        | What                                                                  |
| --------------------------- | --------------------------------------------------------------------- |
| `config/rubric.yaml`        | Methodology: categories, issues, anchor votes and bills, scorecards   |
| `config/campaigns.yaml`     | Citizen campaigns                                                     |
| `config/members-elect.yaml` | Members-elect, departures, uncalled races                             |
| `data/statements/`          | Sourced statements (verbatim quotes)                                  |
| `data/pledges/`             | Pledges and their signers (one file per pledge)                       |
| `data/scorecards/`          | Scorecard CSVs                                                        |
| `data/raw/`                 | Dated snapshots of every download (gitignored; `REFRESH=1` refetches) |
| `ingest/`                   | Pipeline; `index.ts` runs the steps in order                          |
| `scripts/`                  | Maintenance tools (below)                                             |
| `pipeline/`                 | Python extractors (HRC PDF → CSV)                                     |
| `src/types.ts`              | Data model shared by ingest and the app                               |
| `src/lib/`                  | `scoring.ts` (evidence → issue scores), `citizenIndex.ts`             |
| `src/components/`           | Views                                                                 |

Each YAML file's header documents its fields. The app builds everything from the rubric, so adding
an issue or category needs no code.

**Scoring:** each piece of evidence has a stance (−2 to +2) and a weight (kind × anchor weight ×
recency: half-life 6 years for votes and bills, 2 for statements and pledges). An issue score is the
weighted mean; a category is the mean of its issues, or the weakest with `aggregate: min`. The
citizen index is the priority-weighted mean, computed in the browser. For "yes" bills, members who
didn't sign on get weak "not aligned" evidence, which separates members within a party.

## Common tasks

- **Add an issue:** add it under `issues` in `config/rubric.yaml`, then `npm run ingest`.
- **Add an anchor:** add the vote or bill, then `npm run verify:anchors` (check the printed bill
  title).
- **Record a position or statement:** add it with source and quote, then
  `npm run verify:quotes -- --write`.
- **Race called:** move it from `uncalled` to `members` in `config/members-elect.yaml`; find the ID
  with `npm run find:fec`.
- **New Congress sworn in:** delete `members` and `departing` from `config/members-elect.yaml`.

Before trusting a change: `ingest`, the relevant `verify:*`, `lint`, `check-format`, `build`.

## Scripts

| Script                            | Does                                                            |
| --------------------------------- | --------------------------------------------------------------- |
| `npm run ingest`                  | Run the pipeline                                                |
| `npm run verify:anchors`          | Vote tallies vs. Voteview; bill titles vs. labels               |
| `npm run verify:quotes`           | Quotes vs. source pages (`-- --write` updates `quoteVerified`)  |
| `npm run find:fec -- <name>`      | FEC candidate lookup (`--state`, `--office H\|S`, `--district`) |
| `npm run scorecards:hrc`          | Re-extract the HRC scorecard                                    |
| `npm run lint` / `fix`            | ESLint, markdownlint, Ruff                                      |
| `npm run check-format` / `format` | Prettier, `ruff format`                                         |
| `*:ts`, `*:md`, `*:js`, `*:py`    | One language only, e.g. `lint:py`                               |

CI (`.github/workflows/`): `js-ci.yaml` runs format, lint, Markdown, and build on Node 22 and 24;
`python-ci.yaml` runs Ruff when Python files change. Generated JSON in `public/data/` is
Prettier-formatted by ingest, so `check-format` covers it.

`FEC_API_KEY` (free at [api.data.gov](https://api.data.gov/signup/)) adds the small-donor split.

## Sources

[congress-legislators](https://github.com/unitedstates/congress-legislators) (rosters, IDs),
[unitedstates/images](https://github.com/unitedstates/images), [Voteview](https://voteview.com),
[GovInfo bill status](https://www.govinfo.gov/bulkdata/BILLSTATUS),
[FEC](https://www.fec.gov/data/browse-data/?tab=bulk-data),
[HRC](https://www.hrc.org/resources/congressional-scorecard). Members-elect, campaign positions, and
statements come from news reporting; each entry cites its source.
