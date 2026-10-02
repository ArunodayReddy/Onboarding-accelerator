# Architecture

## Data flow

```
┌─────────────┐   parseCsv()    ┌──────────────────────┐
│ raw CSV text │ ─────────────▶ │ Dataset              │
└─────────────┘                │  columns, rows,      │
                               │  ColumnProfile[]     │
                               └──────────┬───────────┘
                                          │ profileDataset()
                                          │  per-column: inferred type,
                                          │  null/distinct rates, samples,
                                          │  data-quality issues
                                          ▼
                               ┌──────────────────────┐
                               │ FieldMapping[]       │◀── suggestMappings()
                               │  source column  ─┐   │    name similarity +
                               │  target field    │   │    synonym table,
                               │  confidence      │   │    greedy de-dup
                               │  overridden?     │   │    (user can override)
                               └──────────┬───────┘   │
                                          │ materialize*()
                                          │  coerce · canonicalize · report
                                          ▼
                    ┌─────────────────────────────────────────┐
                    │ Shipment[] / Carrier[] / Facility[]     │
                    └───────┬─────────────────────┬───────────┘
                            │                     │
                analytics.ts│                     │ nlq.ts
                            ▼                     ▼
                    ┌──────────────┐    ┌──────────────────┐
                    │ KPIs, delays │    │ QueryResult      │
                    │ by-status,   │    │  answer, columns │
                    │ cost/carrier,│    │  rows, intent    │
                    │ exceptions   │    └──────────────────┘
                    └──────────────┘
```

## Module responsibilities

| Module | Owns | Deliberately doesn't own |
|---|---|---|
| `lib/csv.ts` | Quoted-field CSV parsing | Streaming / huge files (swap for papaparse) |
| `lib/infer.ts` | Type inference, `parseDate`/`parseNumber`, issue detection (mixed formats, casing, typo clusters via Levenshtein ≤ 2, currency symbols, null rates) | Semantic understanding of columns |
| `lib/ontology.ts` | `ONTOLOGY` entity definitions, `SYNONYMS`, `suggestMappings()`, `canonicalizeStatus()`, `materialize*()` with `MaterializeReport` | Persistence |
| `lib/analytics.ts` | KPIs, derived `isDelayed()` (dates, not raw status), `referenceDate()` (max pickup date — deterministic "today"), cost-by-carrier, exceptions | Rendering |
| `lib/nlq.ts` | Rule-based NL → filters/aggregations; `EXAMPLE_QUESTIONS`; the `answerQuestion()` seam for a future LLM planner | LLM calls (works with zero keys) |
| `lib/store.tsx` | Session context: datasets → mappings → materialized records | Cross-session persistence (in-memory by design for the demo) |
| `lib/seed.ts` | Fictional Harborline extracts, messy on purpose | — |

## Key decisions

1. **Client-side only.** The demo must open and work instantly — no backend to deploy, no keys to configure. For a real engagement this pipeline would move server-side with a proper store.
2. **Deterministic NLQ over LLM.** An LLM needs a key and is non-deterministic; the rule-based parser answers the ops team's actual recurring questions reliably. The `QueryResult` contract is the LLM-planner seam.
3. **Derived, not stored, truth.** "Delayed" is computed from promised vs. actual dates at query time. Storing it would let the model and the source disagree.
4. **Reports, not silent drops.** `MaterializeReport` surfaces dropped rows and warnings — FDEs never silently discard client data.
5. **Deterministic "today".** Analytics use the max pickup date in the extract as the reference date, so the dashboard and tests agree forever.

## Extension points

- `SYNONYMS` in `ontology.ts` — per-client vocabulary lives here.
- `canonicalizeStatus()` — add enum canonicalizers the same way.
- `answerQuestion()` in `nlq.ts` — add intents, or route unknown intents to an LLM planner with the deterministic parser as validator.
- `SessionProvider` — swap in-memory state for localStorage / a backend without touching pages.
