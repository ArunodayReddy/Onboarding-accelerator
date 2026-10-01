"use client";

import { useRef, useState } from "react";
import Link from "next/link";
import { parseCsv } from "../../lib/csv";
import { profileDataset } from "../../lib/infer";
import { useSession } from "../../lib/store";
import type { Dataset } from "../../lib/types";
import { Badge, Card, DataTable, PageHeader } from "../../components/viz";

const TYPE_TONES: Record<string, "slate" | "blue" | "green" | "amber" | "indigo"> = {
  integer: "blue",
  float: "blue",
  boolean: "green",
  date: "indigo",
  string: "slate",
};

export default function IngestPage() {
  const { datasets, loadSeed, addDataset, removeDataset, seedLoaded } = useSession();
  const [activeId, setActiveId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const fileRef = useRef<HTMLInputElement>(null);

  const active = datasets.find((d) => d.id === activeId) ?? datasets[0] ?? null;

  const handleFile = async (file: File) => {
    setError(null);
    try {
      const text = await file.text();
      const { columns, rows } = parseCsv(text);
      if (columns.length === 0) {
        setError("Couldn't parse that file — is it a CSV?");
        return;
      }
      const ds: Dataset = {
        id: "upload",
        name: file.name,
        entity: null,
        rowCount: rows.length,
        columns,
        rows,
        profile: profileDataset(columns, rows),
      };
      addDataset(ds);
    } catch {
      setError("Couldn't read that file.");
    }
  };

  const issueCount = (d: Dataset) => d.profile.reduce((n, c) => n + c.issues.length, 0);

  return (
    <div>
      <PageHeader
        title="Ingest client extracts"
        subtitle="Load the raw CSVs exactly as the client handed them over. The profiler infers types and surfaces data-quality issues before anything is modeled."
      />

      <div className="flex flex-wrap gap-3 mb-8">
        {!seedLoaded && (
          <button
            onClick={() => loadSeed()}
            className="px-5 py-2.5 rounded-lg bg-indigo-600 text-white font-medium hover:bg-indigo-700 transition-colors"
          >
            Load Harborline sample extracts
          </button>
        )}
        <button
          onClick={() => fileRef.current?.click()}
          className="px-5 py-2.5 rounded-lg border border-slate-300 text-slate-700 font-medium hover:bg-white transition-colors"
        >
          Upload your own CSV
        </button>
        <input
          ref={fileRef}
          type="file"
          accept=".csv,text/csv"
          className="hidden"
          onChange={(e) => {
            const f = e.target.files?.[0];
            if (f) handleFile(f);
            e.target.value = "";
          }}
        />
      </div>
      {error && (
        <div className="mb-6 p-4 rounded-lg bg-red-50 border border-red-200 text-sm text-red-800">
          {error}
        </div>
      )}

      {datasets.length === 0 && (
        <Card className="p-10 text-center">
          <p className="text-slate-600">
            No datasets yet. Load the sample extracts to see the pipeline in action,
            or upload a CSV of your own.
          </p>
        </Card>
      )}

      {datasets.length > 0 && (
        <div className="flex gap-2 mb-6 flex-wrap">
          {datasets.map((d) => (
            <div key={d.id} className="flex items-center">
              <button
                onClick={() => setActiveId(d.id)}
                className={`px-4 py-2 rounded-l-lg text-sm font-medium border transition-colors ${
                  active?.id === d.id
                    ? "bg-indigo-600 text-white border-indigo-600"
                    : "bg-white text-slate-700 border-slate-300 hover:bg-slate-50"
                }`}
              >
                {d.name}
                <span className="ml-2 opacity-70">
                  {d.rowCount} rows · {issueCount(d)} issues
                </span>
              </button>
              <button
                onClick={() => {
                  removeDataset(d.id);
                  if (activeId === d.id) setActiveId(null);
                }}
                title="Remove dataset"
                className="px-2 py-2 rounded-r-lg border border-l-0 border-slate-300 bg-white text-slate-400 hover:text-red-600 text-sm"
              >
                ✕
              </button>
            </div>
          ))}
        </div>
      )}

      {active && (
        <div className="space-y-6">
          <Card className="p-6">
            <div className="flex items-center justify-between mb-4">
              <h2 className="text-lg font-semibold text-slate-900">
                Schema profile · <span className="font-mono text-base">{active.name}</span>
              </h2>
              {active.entity && <Badge tone="indigo">→ {active.entity}</Badge>}
            </div>
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-slate-200 text-left">
                    <th className="py-2 pr-3 font-semibold text-slate-700">Column</th>
                    <th className="py-2 pr-3 font-semibold text-slate-700">Inferred type</th>
                    <th className="py-2 pr-3 font-semibold text-slate-700">Nulls</th>
                    <th className="py-2 pr-3 font-semibold text-slate-700">Distinct</th>
                    <th className="py-2 pr-3 font-semibold text-slate-700">Samples</th>
                    <th className="py-2 font-semibold text-slate-700">Issues</th>
                  </tr>
                </thead>
                <tbody>
                  {active.profile.map((col) => (
                    <tr key={col.name} className="border-b border-slate-100 align-top">
                      <td className="py-2 pr-3 font-mono text-slate-900">{col.name}</td>
                      <td className="py-2 pr-3">
                        <Badge tone={TYPE_TONES[col.inferredType]}>{col.inferredType}</Badge>
                      </td>
                      <td className="py-2 pr-3 text-slate-600">
                        {col.nullCount > 0 ? `${Math.round(col.nullRate * 100)}%` : "—"}
                      </td>
                      <td className="py-2 pr-3 text-slate-600">{col.distinctCount}</td>
                      <td className="py-2 pr-3 text-slate-500 max-w-[220px] truncate">
                        {col.samples.join(" · ")}
                      </td>
                      <td className="py-2">
                        {col.issues.length === 0 ? (
                          <span className="text-slate-400">—</span>
                        ) : (
                          <ul className="space-y-1">
                            {col.issues.map((issue, i) => (
                              <li key={i} className="text-xs text-amber-800 bg-amber-50 border border-amber-200 rounded px-2 py-1">
                                ⚠ {issue}
                              </li>
                            ))}
                          </ul>
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </Card>

          <Card className="p-6">
            <h2 className="text-lg font-semibold text-slate-900 mb-4">
              Raw preview <span className="text-sm font-normal text-slate-500">(first 8 rows, unmodified)</span>
            </h2>
            <DataTable
              columns={active.columns}
              rows={active.rows.slice(0, 8)}
            />
            <div className="mt-6 flex justify-end">
              <Link
                href="/ontology"
                className="px-5 py-2.5 rounded-lg bg-indigo-600 text-white font-medium hover:bg-indigo-700 transition-colors"
              >
                Model it in the ontology →
              </Link>
            </div>
          </Card>
        </div>
      )}
    </div>
  );
}
