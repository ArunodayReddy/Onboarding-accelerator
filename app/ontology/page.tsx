"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { ONTOLOGY } from "../../lib/ontology";
import { useSession } from "../../lib/store";
import { Badge, Card, PageHeader } from "../../components/viz";

export default function OntologyPage() {
  const {
    datasets,
    mappings,
    ensureMappings,
    setMapping,
    setDatasetEntity,
    materialize,
    reports,
    materialized,
    shipments,
    carriers,
    facilities,
  } = useSession();
  const [activeId, setActiveId] = useState<string | null>(null);

  const active = datasets.find((d) => d.id === activeId) ?? datasets[0] ?? null;

  useEffect(() => {
    if (active?.entity) ensureMappings(active.id);
  }, [active?.id, active?.entity, ensureMappings]);

  const entity = useMemo(
    () => ONTOLOGY.find((e) => e.name === active?.entity) ?? null,
    [active]
  );
  const map = active ? mappings[active.id] ?? [] : [];

  const totalRecords = shipments.length + carriers.length + facilities.length;

  return (
    <div>
      <PageHeader
        title="Model the ontology"
        subtitle="Map each extract's columns onto the typed Harborline ontology. Suggestions are automatic with confidence scores — confirm them or override, then materialize into clean records."
      />

      {datasets.length === 0 && (
        <Card className="p-10 text-center">
          <p className="text-slate-600 mb-4">
            Nothing to model yet. Ingest the client extracts first.
          </p>
          <Link
            href="/ingest"
            className="px-5 py-2.5 rounded-lg bg-indigo-600 text-white font-medium hover:bg-indigo-700 transition-colors inline-block"
          >
            Go to ingest →
          </Link>
        </Card>
      )}

      {datasets.length > 0 && (
        <div className="flex gap-2 mb-6 flex-wrap">
          {datasets.map((d) => (
            <button
              key={d.id}
              onClick={() => setActiveId(d.id)}
              className={`px-4 py-2 rounded-lg text-sm font-medium border transition-colors ${
                active?.id === d.id
                  ? "bg-indigo-600 text-white border-indigo-600"
                  : "bg-white text-slate-700 border-slate-300 hover:bg-slate-50"
              }`}
            >
              {d.name}
            </button>
          ))}
        </div>
      )}

      {active && !entity && (
        <Card className="p-6">
          <h2 className="font-semibold text-slate-900 mb-2">Assign this extract to an entity</h2>
          <p className="text-sm text-slate-600 mb-4">
            Uploaded extracts don&apos;t have a known shape yet. Pick which ontology entity{" "}
            <span className="font-mono">{active.name}</span> feeds.
          </p>
          <div className="flex gap-2 flex-wrap">
            {ONTOLOGY.map((e) => (
              <button
                key={e.name}
                onClick={() => setDatasetEntity(active.id, e.name)}
                className="px-4 py-2 rounded-lg border border-slate-300 bg-white text-sm font-medium text-slate-700 hover:border-indigo-400 hover:text-indigo-700"
              >
                {e.label}
              </button>
            ))}
          </div>
        </Card>
      )}

      {active && entity && (
        <div className="space-y-6">
          <Card className="p-6">
            <div className="flex items-center justify-between mb-1">
              <h2 className="text-lg font-semibold text-slate-900">
                {entity.label}{" "}
                <span className="text-sm font-normal text-slate-500">
                  ← <span className="font-mono">{active.name}</span>
                </span>
              </h2>
              <Badge tone="indigo">{entity.fields.length} fields</Badge>
            </div>
            <p className="text-sm text-slate-600 mb-5">{entity.description}</p>
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-slate-200 text-left">
                    <th className="py-2 pr-3 font-semibold text-slate-700">Ontology field</th>
                    <th className="py-2 pr-3 font-semibold text-slate-700">Type</th>
                    <th className="py-2 pr-3 font-semibold text-slate-700">Source column</th>
                    <th className="py-2 font-semibold text-slate-700">Confidence</th>
                  </tr>
                </thead>
                <tbody>
                  {entity.fields.map((field) => {
                    const m = map.find((x) => x.targetField === field.name);
                    return (
                      <tr key={field.name} className="border-b border-slate-100">
                        <td className="py-2 pr-3">
                          <div className="font-medium text-slate-900">
                            {field.label}
                            {field.required && <span className="text-red-500 ml-1">*</span>}
                          </div>
                          <div className="text-xs text-slate-500">{field.description}</div>
                        </td>
                        <td className="py-2 pr-3">
                          <Badge tone="slate">{field.type}</Badge>
                        </td>
                        <td className="py-2 pr-3">
                          <select
                            value={m?.sourceColumn ?? ""}
                            onChange={(e) =>
                              setMapping(active.id, field.name, e.target.value || null)
                            }
                            className="font-mono text-sm border border-slate-300 rounded-lg px-2 py-1.5 bg-white max-w-[220px]"
                          >
                            <option value="">— unmapped —</option>
                            {active.columns.map((c) => (
                              <option key={c} value={c}>
                                {c}
                              </option>
                            ))}
                          </select>
                        </td>
                        <td className="py-2">
                          {!m || !m.sourceColumn ? (
                            <Badge tone="amber">unmapped</Badge>
                          ) : m.overridden ? (
                            <Badge tone="green">manual ✓</Badge>
                          ) : (
                            <Badge tone={m.confidence >= 0.9 ? "blue" : "slate"}>
                              auto · {Math.round(m.confidence * 100)}%
                            </Badge>
                          )}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </Card>

          <div className="flex items-center gap-4">
            <button
              onClick={materialize}
              className="px-6 py-3 rounded-lg bg-indigo-600 text-white font-medium hover:bg-indigo-700 transition-colors"
            >
              Materialize all datasets
            </button>
            {materialized && (
              <span className="text-sm text-slate-600">
                ✓ {totalRecords} records materialized —{" "}
                <Link href="/dashboard" className="text-indigo-600 font-medium underline">
                  open the dashboard
                </Link>
              </span>
            )}
          </div>

          {materialized && reports.length > 0 && (
            <div className="grid md:grid-cols-3 gap-4">
              {reports.map((r) => (
                <Card key={r.entity} className="p-5">
                  <div className="font-semibold text-slate-900">{r.entity}</div>
                  <div className="mt-2 text-sm text-slate-600">
                    <span className="text-emerald-700 font-semibold">{r.records}</span> records
                    {r.dropped > 0 && (
                      <span className="text-red-600"> · {r.dropped} dropped</span>
                    )}
                  </div>
                  {r.warnings.length > 0 && (
                    <ul className="mt-2 space-y-1">
                      {r.warnings.map((w, i) => (
                        <li key={i} className="text-xs text-amber-800 bg-amber-50 border border-amber-200 rounded px-2 py-1">
                          ⚠ {w}
                        </li>
                      ))}
                    </ul>
                  )}
                </Card>
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  );
}
