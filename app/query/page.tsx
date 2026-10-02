"use client";

import { useState } from "react";
import Link from "next/link";
import { EXAMPLE_QUESTIONS, answerQuestion } from "../../lib/nlq";
import { useSession } from "../../lib/store";
import type { QueryResult } from "../../lib/types";
import { Badge, Card, DataTable, PageHeader } from "../../components/viz";

export default function QueryPage() {
  const { shipments, materialized } = useSession();
  const [input, setInput] = useState("");
  const [result, setResult] = useState<QueryResult | null>(null);

  if (!materialized || shipments.length === 0) {
    return (
      <div>
        <PageHeader
          title="Ask the data"
          subtitle="Natural-language queries over the modeled shipments."
        />
        <Card className="p-10 text-center">
          <p className="text-slate-600 mb-4">
            Materialize the ontology first, then ask away.
          </p>
          <Link
            href="/ingest"
            className="px-5 py-2.5 rounded-lg bg-indigo-600 text-white font-medium hover:bg-indigo-700 transition-colors inline-block"
          >
            Start with ingest →
          </Link>
        </Card>
      </div>
    );
  }

  const ask = (question: string) => {
    const q = question.trim();
    if (!q) return;
    setInput(q);
    setResult(answerQuestion(q, shipments));
  };

  return (
    <div>
      <PageHeader
        title="Ask the data"
        subtitle="Plain-English questions compiled into filters and aggregations over the modeled shipments. Deterministic — no API key, works offline."
      />

      <Card className="p-6 mb-6">
        <form
          onSubmit={(e) => {
            e.preventDefault();
            ask(input);
          }}
          className="flex gap-3"
        >
          <input
            value={input}
            onChange={(e) => setInput(e.target.value)}
            placeholder="e.g. Which shipments are delayed?"
            className="flex-1 border border-slate-300 rounded-lg px-4 py-3 text-slate-900 placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-indigo-500"
          />
          <button
            type="submit"
            className="px-6 py-3 rounded-lg bg-indigo-600 text-white font-medium hover:bg-indigo-700 transition-colors"
          >
            Ask
          </button>
        </form>
        <div className="mt-4 flex flex-wrap gap-2">
          {EXAMPLE_QUESTIONS.map((q) => (
            <button
              key={q}
              onClick={() => ask(q)}
              className="px-3 py-1.5 rounded-full border border-slate-300 text-sm text-slate-600 hover:border-indigo-400 hover:text-indigo-700 transition-colors"
            >
              {q}
            </button>
          ))}
        </div>
      </Card>

      {result && (
        <div className="space-y-4">
          <Card className="p-6 border-l-4 border-l-indigo-500">
            <div className="flex items-center gap-2 mb-2">
              <Badge tone="indigo">{result.intent.replace(/_/g, " ")}</Badge>
            </div>
            <p className="text-lg text-slate-900">{result.answer}</p>
          </Card>
          <Card className="p-6">
            <DataTable columns={result.columns} rows={result.rows} empty="No matching rows." />
          </Card>
        </div>
      )}

      {!result && (
        <p className="text-sm text-slate-500">
          Tip: the parser understands delays, lanes (“to Chicago”, “from Detroit”),
          costs, on-time performance, carrier rankings, and thresholds. Try a chip above.
        </p>
      )}
    </div>
  );
}
