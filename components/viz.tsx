import type { ReactNode } from "react";

export function PageHeader({
  title,
  subtitle,
}: {
  title: string;
  subtitle: string;
}) {
  return (
    <div className="mb-8">
      <h1 className="text-3xl font-bold text-slate-900 tracking-tight">{title}</h1>
      <p className="mt-2 text-slate-600 max-w-3xl">{subtitle}</p>
    </div>
  );
}

export function Card({
  children,
  className = "",
}: {
  children: ReactNode;
  className?: string;
}) {
  return (
    <div className={`bg-white border border-slate-200 rounded-xl shadow-sm ${className}`}>
      {children}
    </div>
  );
}

export function KpiCard({
  label,
  value,
  hint,
}: {
  label: string;
  value: string;
  hint?: string;
}) {
  return (
    <Card className="p-5">
      <div className="text-xs font-medium uppercase tracking-wide text-slate-500">
        {label}
      </div>
      <div className="mt-1 text-3xl font-bold text-slate-900">{value}</div>
      {hint && <div className="mt-1 text-sm text-slate-500">{hint}</div>}
    </Card>
  );
}

export function Badge({
  children,
  tone = "slate",
}: {
  children: ReactNode;
  tone?: "slate" | "indigo" | "green" | "amber" | "red" | "blue";
}) {
  const tones: Record<string, string> = {
    slate: "bg-slate-100 text-slate-700",
    indigo: "bg-indigo-100 text-indigo-800",
    green: "bg-emerald-100 text-emerald-800",
    amber: "bg-amber-100 text-amber-800",
    red: "bg-red-100 text-red-800",
    blue: "bg-blue-100 text-blue-800",
  };
  return (
    <span
      className={`inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium ${tones[tone]}`}
    >
      {children}
    </span>
  );
}

/** Simple horizontal bar chart rendered as SVG — no chart lib needed. */
export function BarChart({
  data,
  formatValue = (n: number) => String(n),
}: {
  data: { label: string; value: number; color?: string }[];
  formatValue?: (n: number) => string;
}) {
  const max = Math.max(...data.map((d) => d.value), 1);
  const rowH = 36;
  const height = data.length * rowH + 8;
  return (
    <svg
      viewBox={`0 0 560 ${height}`}
      className="w-full"
      role="img"
      aria-label="Bar chart"
    >
      {data.map((d, i) => {
        const w = Math.max(4, (d.value / max) * 380);
        const y = i * rowH + 8;
        return (
          <g key={d.label}>
            <text x={0} y={y + 16} fontSize={13} fill="#475569" width={140}>
              {d.label.replace(/_/g, " ")}
            </text>
            <rect
              x={150}
              y={y + 4}
              width={w}
              height={20}
              rx={6}
              fill={d.color ?? "#4f46e5"}
            />
            <text x={150 + w + 8} y={y + 19} fontSize={13} fill="#0f172a" fontWeight={600}>
              {formatValue(d.value)}
            </text>
          </g>
        );
      })}
    </svg>
  );
}

export function DataTable({
  columns,
  rows,
  empty = "No rows.",
}: {
  columns: string[];
  rows: Record<string, string | number>[];
  empty?: string;
}) {
  if (rows.length === 0) {
    return <p className="text-sm text-slate-500 py-6 text-center">{empty}</p>;
  }
  return (
    <div className="overflow-x-auto">
      <table className="w-full text-sm">
        <thead>
          <tr className="border-b border-slate-200">
            {columns.map((c) => (
              <th
                key={c}
                className="text-left px-3 py-2 font-semibold text-slate-700 whitespace-nowrap"
              >
                {c}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {rows.map((r, i) => (
            <tr
              key={i}
              className={i % 2 === 0 ? "bg-white" : "bg-slate-50/60"}
            >
              {columns.map((c) => (
                <td key={c} className="px-3 py-2 text-slate-700 whitespace-nowrap">
                  {String(r[c] ?? "—")}
                </td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

export function Callout({
  title,
  children,
}: {
  title: string;
  children: ReactNode;
}) {
  return (
    <div className="rounded-xl border border-indigo-200 bg-indigo-50/60 p-5">
      <div className="font-semibold text-indigo-900 text-sm mb-1">{title}</div>
      <div className="text-sm text-indigo-900/80">{children}</div>
    </div>
  );
}
