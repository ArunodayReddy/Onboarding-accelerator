import Link from "next/link";
import { Callout, Card } from "../components/viz";

const PHASES = [
  {
    n: "01",
    title: "Ingest",
    body: "Drop in the client's raw CSV extracts. The profiler infers a schema for every column and flags the data-quality issues hiding in it — mixed date formats, inconsistent casing, typo clusters, currency-formatted numbers.",
  },
  {
    n: "02",
    title: "Model",
    body: "Map source columns onto a typed ontology (Shipment, Carrier, Facility). Mappings are auto-suggested with confidence scores; you confirm or override. Materialization coerces, canonicalizes, and reports every dropped row.",
  },
  {
    n: "03",
    title: "Operate",
    body: "The ops dashboard and natural-language query layer run on the modeled data — on-time %, cost per mile, exceptions — the answers the client's ops manager actually asks for, in plain English.",
  },
];

const FINDINGS = [
  ["4 date formats", "pickup_date mixes ISO, MM/DD/YYYY, “Sep 7 2026”, and “8-Sep-2026” — all parsed to one canonical form."],
  ["Status chaos", "“delviered”, “In-Transit”, “IN TRANSIT”, “in-transit” — fuzzy-matched to a 5-value canonical enum."],
  ["Casing drift", "“chicago” vs “Chicago” vs “CHICAGO” — normalized at materialization."],
  ["Dirty numbers", "“$1,780.50” with currency symbols and commas — stripped and coerced to float."],
];

export default function Home() {
  return (
    <div>
      <div className="max-w-3xl">
        <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-indigo-100 text-indigo-800 text-xs font-semibold mb-5">
          SIMULATED FDE ENGAGEMENT · WEEK 1
        </div>
        <h1 className="text-4xl font-bold tracking-tight text-slate-900">
          Onboarding Harborline Freight in days, not quarters.
        </h1>
        <p className="mt-4 text-lg text-slate-600">
          Harborline is a regional 3PL running its operation on spreadsheet
          extracts. This accelerator is the playbook: land in their messy data,
          build a typed ontology over it, and ship the operational tooling their
          team uses on day one.
        </p>
        <div className="mt-6 flex gap-3">
          <Link
            href="/ingest"
            className="px-5 py-2.5 rounded-lg bg-indigo-600 text-white font-medium hover:bg-indigo-700 transition-colors"
          >
            Start the ingest →
          </Link>
          <Link
            href="/dashboard"
            className="px-5 py-2.5 rounded-lg border border-slate-300 text-slate-700 font-medium hover:bg-white transition-colors"
          >
            Skip to the dashboard
          </Link>
        </div>
      </div>

      <div className="mt-12 grid md:grid-cols-3 gap-4">
        {PHASES.map((p) => (
          <Card key={p.n} className="p-6">
            <div className="text-xs font-bold text-indigo-600 tracking-widest">
              PHASE {p.n}
            </div>
            <h3 className="mt-2 text-xl font-semibold text-slate-900">{p.title}</h3>
            <p className="mt-2 text-sm text-slate-600 leading-relaxed">{p.body}</p>
          </Card>
        ))}
      </div>

      <div className="mt-12">
        <h2 className="text-2xl font-bold text-slate-900">
          What the profiler found on day one
        </h2>
        <p className="mt-1 text-slate-600 text-sm">
          Real findings from the client&apos;s September extract — each one handled by the pipeline.
        </p>
        <div className="mt-4 grid md:grid-cols-2 gap-4">
          {FINDINGS.map(([title, body]) => (
            <Card key={title} className="p-5">
              <div className="font-semibold text-slate-900">{title}</div>
              <div className="mt-1 text-sm text-slate-600">{body}</div>
            </Card>
          ))}
        </div>
      </div>

      <div className="mt-12">
        <Callout title="How to run this demo">
          <ol className="list-decimal ml-5 space-y-1">
            <li>
              <Link href="/ingest" className="underline font-medium">Ingest</Link> — load the sample client extracts (or upload your own CSVs).
            </li>
            <li>
              <Link href="/ontology" className="underline font-medium">Ontology</Link> — review the auto-suggested mappings, then materialize.
            </li>
            <li>
              <Link href="/dashboard" className="underline font-medium">Dashboard</Link> — explore KPIs, costs by carrier, and exceptions.
            </li>
            <li>
              <Link href="/query" className="underline font-medium">Ask data</Link> — query the modeled data in plain English.
            </li>
          </ol>
        </Callout>
      </div>

      <div className="mt-12 grid md:grid-cols-3 gap-4 text-sm">
        <Card className="p-5">
          <div className="font-semibold text-slate-900 mb-1">Stack</div>
          <div className="text-slate-600">Next.js 16 · React 19 · TypeScript · Tailwind. Zero backend — the whole pipeline runs client-side.</div>
        </Card>
        <Card className="p-5">
          <div className="font-semibold text-slate-900 mb-1">Deterministic NLQ</div>
          <div className="text-slate-600">Natural-language queries compile to filters and aggregations with no API key. The parser is the seam where an LLM planner plugs in later.</div>
        </Card>
        <Card className="p-5">
          <div className="font-semibold text-slate-900 mb-1">Portfolio signal</div>
          <div className="text-slate-600">Schema inference, ontology modeling, data-quality remediation, and shipping a working product — the FDE loop, end to end.</div>
        </Card>
      </div>
    </div>
  );
}
