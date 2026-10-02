# Harborline · FDE Onboarding Accelerator

> **The business outcome:** Harborline Freight — a regional 3PL running its operation on spreadsheet extracts — had no reliable view of on-time performance, no exception queue, and no way to compare carrier costs. This project took them from raw CSVs to a working ops dashboard in days, not quarters. On day one it surfaced **15 at-risk shipments** the ops team couldn't see, established their **on-time baseline (55%)**, and answered **which carrier is cheapest per mile**.

Built as a demonstration of forward-deployed engineering: embed in the customer's messy reality, ship working software fast, and leave the team with tooling they actually use.

## The business problem

Harborline's ops team exports CSVs from three systems that were never designed to talk to each other. The result:

- **Delayed shipments discovered by angry customers**, not by the ops team — "delayed" didn't exist as a concept in any extract; it had to be derived from promised vs. actual delivery dates.
- **No on-time baseline**, so no way to measure improvement or hold carriers accountable.
- **Carrier costs opaque** — nobody could answer "which carrier is cheapest per mile?" without a day of spreadsheet surgery.
- **Dirty data everywhere**: 4 date formats in one column, `delviered` typos, `chicago` vs `CHICAGO`, `$1,780.50` currency-formatted numbers, 20%+ null rates.

## What I shipped

| Phase | Business value |
|---|---|
| **Discover** | Took the three CSV extracts exactly as the ops team exports them. No schema docs, no data dictionary — started from their reality, not an idealized model. |
| **Profile** | Automated data-quality audit: inferred types, flagged every issue above. The audit itself is a deliverable — it's the remediation backlog. |
| **Model** | Mapped 21 source columns onto a 3-entity typed ontology (Shipment, Carrier, Facility) with confidence-scored auto-suggestions. Materialization coerced, canonicalized, and reported every dropped row — no silent data loss. |
| **Ship** | Ops dashboard (on-time %, cost/mile, exceptions queue) + natural-language querying, so the ops manager gets answers in plain English instead of filing a ticket with IT. |

**Day-one findings:** 9 shipments delivered late + 6 in transit past their promised date = **15 exceptions** now visible in one queue. On-time delivery: **55%** — the first honest number the business has ever had.

## Try it

```bash
npm install
npm run dev
# open http://localhost:3000
```

1. **Ingest** — click *Load Harborline sample extracts* (or upload your own CSVs) and inspect the schema profile + data-quality findings.
2. **Ontology** — review the auto-suggested column mappings, override where needed, then *Materialize*.
3. **Dashboard** — KPIs, shipments by status, freight spend by carrier, exceptions queue.
4. **Ask data** — e.g. `Which shipments are delayed?`, `Show shipments to Chicago`, `Which carrier is cheapest per mile?`

Or run it containerized:

```bash
docker build -t harborline .
docker run -p 3000:3000 harborline
```

## What the pipeline found on day one

- **4 date formats** in `pickup_date` (`2026-09-01`, `09/02/2026`, `Sep 3 2026`, `8-Sep-2026`) → all parsed to ISO.
- **Status chaos**: `delviered`, `In-Transit`, `IN TRANSIT`, `in-transit` → fuzzy-matched to a 5-value canonical enum.
- **Casing drift**: `chicago` / `Chicago` / `CHICAGO` → normalized.
- **Dirty numbers**: `$1,780.50` → `1780.5`.
- **Derived truth**: "delayed" doesn't exist in the raw data — it's computed from promised vs. actual delivery dates (9 delivered late + 6 in transit past promised = 15 exceptions).

## Architecture

```
raw CSV extracts
      │  lib/csv.ts        RFC-4180-ish parser
      ▼
Dataset + ColumnProfile
      │  lib/infer.ts      type inference, null/distinct rates,
      │                    mixed-format / casing / typo / currency detection
      ▼
FieldMapping (source column → ontology field)
      │  lib/ontology.ts   confidence-scored auto-suggest, synonyms,
      │                    materialization: coerce · canonicalize · report
      ▼
Shipment / Carrier / Facility (typed records)
      ├── lib/analytics.ts  KPIs, derived delays, cost-by-carrier, exceptions
      └── lib/nlq.ts        deterministic NL → filters/aggregations
```

- **Zero backend.** The whole pipeline runs client-side; session state lives in a React context (`lib/store.tsx`). No API keys, works offline — deployable anywhere on day one.
- **Deterministic NLQ.** Natural-language questions compile to filters and aggregations. `answerQuestion()` in `lib/nlq.ts` is the seam where an LLM planner plugs in later — the `QueryResult` contract wouldn't change.
- See [`docs/ARCHITECTURE.md`](docs/ARCHITECTURE.md) for module responsibilities, decisions, and extension points.

## Ontology

- **Shipment** — id, origin, destination, pickup/promised/delivery dates, carrier, status (`booked | in_transit | delivered | delayed | cancelled`), weight, cost, miles.
- **Carrier** — id, name, MC number, fleet size, on-time %.
- **Facility** — code, city, state, kind, pallet capacity.

## Development

```bash
npm run dev        # dev server
npm test           # vitest suite (21 tests)
npm run typecheck  # tsc --noEmit
npm run lint       # eslint
npm run build      # production build
```

CI (`.github/workflows/ci.yml`) runs lint → typecheck → tests → build on every push.

## Roadmap — what I'd do on-site next

1. Persist sessions (currently in-memory) and add extract versioning/diffing — so week-over-week on-time trends are automatic.
2. Plug an LLM planner into `answerQuestion()` for open-ended questions, keeping the deterministic parser as fallback/validator.
3. Add write-back: let ops annotate exceptions and export the cleaned dataset — closing the loop from insight to action.
4. Harden the CSV parser (or swap in papaparse) for truly feral extracts.

## License

MIT — see [LICENSE](LICENSE).
