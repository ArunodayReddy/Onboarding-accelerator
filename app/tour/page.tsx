import Link from "next/link";
import { Badge, Callout, Card, PageHeader } from "../../components/viz";

const REPO = "https://github.com/ArunodayReddy/Onboarding-accelerator/blob/main";

type Stop = {
  n: string;
  title: string;
  story: string;
  outcome: string;
  code: { label: string; path: string }[];
  live: { label: string; href: string };
};

const STOPS: Stop[] = [
  {
    n: "01",
    title: "The client problem",
    story:
      "Harborline Freight is a regional 3PL running its operation on spreadsheet extracts. Four date formats, typo'd statuses, currency-formatted numbers, inconsistent casing — the classic week-one mess. The engagement goal isn't a demo; it's getting this data trusted and operational in days, not quarters.",
    outcome: "A framed business problem before a single line of pipeline code.",
    code: [{ label: "README.md", path: "README.md" }],
    live: { label: "Read the engagement brief", href: "/" },
  },
  {
    n: "02",
    title: "Ingest — trust nothing",
    story:
      "Drop in the raw CSV extracts. The profiler infers a type for every column and surfaces the data-quality issues hiding inside: pickup_date mixes ISO, MM/DD/YYYY, “Sep 7 2026”, and “8-Sep-2026”; the Status column hides a “delviered” typo cluster. Nothing is silently coerced — every finding is shown.",
    outcome: "Schema + data-quality report generated automatically on load.",
    code: [
      { label: "lib/seed.ts", path: "lib/seed.ts" },
      { label: "lib/csv.ts", path: "lib/csv.ts" },
      { label: "lib/infer.ts", path: "lib/infer.ts" },
    ],
    live: { label: "Open Ingest", href: "/ingest" },
  },
  {
    n: "03",
    title: "Ontology — speak the client's language",
    story:
      "Source columns are mapped onto a typed ontology — Shipment, Carrier, Facility. Mappings are auto-suggested with confidence scores, not hand-wired: “ShipmentID” → Shipment.id, “carrier_name” → Shipment.carrier. You confirm or override, and every override is explicit.",
    outcome: "All 21 source columns mapped with confidence scores.",
    code: [
      { label: "lib/ontology.ts", path: "lib/ontology.ts" },
      { label: "lib/types.ts", path: "lib/types.ts" },
    ],
    live: { label: "Open Ontology", href: "/ontology" },
  },
  {
    n: "04",
    title: "Materialize — dirty rows in, typed records out",
    story:
      "Materialization coerces types, canonicalizes statuses (“delviered” → delivered), normalizes casing, and parses every date format into one canonical form. The report accounts for every row: zero dropped in this engagement, and any drop would be listed, not hidden.",
    outcome: "Clean, typed records with a full materialization report.",
    code: [
      { label: "lib/ontology.ts (materialize*)", path: "lib/ontology.ts" },
      { label: "lib/store.tsx", path: "lib/store.tsx" },
    ],
    live: { label: "Materialize in the app", href: "/ontology" },
  },
  {
    n: "05",
    title: "Operate — the dashboard",
    story:
      "The ops dashboard runs on the modeled data and answers the questions the ops manager actually asks: 15 at-risk shipments surfaced on day one (9 delivered late, 6 in transit past promise), a 55% on-time baseline, and cost-per-mile by carrier so the expensive lanes are visible.",
    outcome: "Exceptions queue + KPIs the business can act on immediately.",
    code: [{ label: "lib/analytics.ts", path: "lib/analytics.ts" }],
    live: { label: "Open Dashboard", href: "/dashboard" },
  },
  {
    n: "06",
    title: "Ask data — answers in plain English",
    story:
      "A deterministic natural-language layer over the clean data — no LLM hallucinations, just parsed intents over typed records. “Which shipments are delayed?” returns the 15 exceptions; “Which carrier is cheapest per mile?” names the winner. The whole pipeline is covered by an end-to-end test that mirrors the UI flow exactly.",
    outcome: "Deterministic Q&A, verified by 31 passing tests.",
    code: [
      { label: "lib/nlq.ts", path: "lib/nlq.ts" },
      { label: "lib/__tests__/pipeline.test.ts", path: "lib/__tests__/pipeline.test.ts" },
    ],
    live: { label: "Ask a question", href: "/query" },
  },
];

export default function Tour() {
  return (
    <div>
      <PageHeader
        title="Guided tour"
        subtitle="Six stops through a simulated week-one FDE engagement — each with the business story, the code behind it, and the live surface. Built for a hiring manager with five minutes."
      />

      <div className="space-y-5">
        {STOPS.map((s) => (
          <Card key={s.n} className="p-6">
            <div className="flex items-start gap-4">
              <div className="shrink-0 w-10 h-10 rounded-full bg-indigo-600 text-white grid place-items-center font-bold text-sm">
                {s.n}
              </div>
              <div className="min-w-0 flex-1">
                <h2 className="text-xl font-bold text-slate-900">{s.title}</h2>
                <p className="mt-2 text-slate-600 leading-relaxed">{s.story}</p>
                <div className="mt-3">
                  <Badge tone="green">{s.outcome}</Badge>
                </div>
                <div className="mt-4 flex flex-wrap items-center gap-x-5 gap-y-2 text-sm">
                  <span className="text-slate-500 font-medium">Under the hood:</span>
                  {s.code.map((c) => (
                    <a
                      key={c.path}
                      href={`${REPO}/${c.path}`}
                      target="_blank"
                      rel="noreferrer"
                      className="text-indigo-600 hover:text-indigo-800 font-mono text-[13px] underline decoration-indigo-200 underline-offset-2"
                    >
                      {c.label}
                    </a>
                  ))}
                  <Link
                    href={s.live.href}
                    className="ml-auto inline-flex items-center gap-1 font-semibold text-slate-900 hover:text-indigo-700"
                  >
                    {s.live.label} →
                  </Link>
                </div>
              </div>
            </div>
          </Card>
        ))}
      </div>

      <div className="mt-8">
        <Callout title="Why this matters">
          This is what forward-deployed engineering looks like: ambiguous client
          data in, trusted operational system out — with every transformation
          visible, tested, and tied to a business outcome. The full source is on{" "}
          <a
            href="https://github.com/ArunodayReddy/Onboarding-accelerator"
            target="_blank"
            rel="noreferrer"
            className="underline font-semibold"
          >
            GitHub
          </a>
          .
        </Callout>
      </div>
    </div>
  );
}
