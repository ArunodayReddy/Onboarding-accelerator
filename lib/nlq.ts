/**
 * Rule-based natural-language querying over the modeled data.
 *
 * Deliberately deterministic (no LLM API key required): the demo has to
 * work the moment it opens. The parser recognizes a focused set of
 * operational questions — the kind an ops manager actually asks — and
 * compiles them into filters/aggregations over Shipment records.
 * `answerQuestion` is the seam where an LLM planner could be plugged in
 * later; the QueryResult contract wouldn't change.
 */
import {
  computeKpis,
  costByCarrier,
  findExceptions,
  isDelayed,
  knownCities,
  referenceDate,
} from "./analytics";
import type { QueryResult, Shipment } from "./types";

const money = (n: number) =>
  "$" + n.toLocaleString("en-US", { maximumFractionDigits: 2, minimumFractionDigits: n % 1 === 0 ? 0 : 2 });

function omit(
  row: Record<string, string | number>,
  ...keys: string[]
): Record<string, string | number> {
  const out: Record<string, string | number> = {};
  for (const [k, v] of Object.entries(row)) if (!keys.includes(k)) out[k] = v;
  return out;
}

function toRows(shipments: Shipment[]): QueryResult["rows"] {
  return shipments.map((s) => ({
    ID: s.id,
    Origin: s.origin,
    Destination: s.destination,
    Carrier: s.carrier,
    Status: s.status,
    "Cost (USD)": s.costUsd ?? "—",
    "Promised": s.promisedDate,
    "Delivered": s.deliveryDate ?? "—",
  }));
}

function findCity(q: string, cities: string[]): string | null {
  const lower = q.toLowerCase();
  // Longest match wins ("St. Louis" before "Louis").
  const sorted = [...cities].sort((a, b) => b.length - a.length);
  for (const city of sorted) {
    if (lower.includes(city.toLowerCase())) return city;
  }
  return null;
}

function amountAfter(q: string, words: string[]): number | null {
  for (const w of words) {
    const m = q.match(new RegExp(`${w}\\s*\\$?([\\d,]+(?:\\.\\d+)?)`));
    if (m) return Number(m[1].replace(/,/g, ""));
  }
  return null;
}

export function answerQuestion(
  question: string,
  shipments: Shipment[]
): QueryResult {
  const q = question.toLowerCase().trim();
  const cities = knownCities(shipments);
  const today = referenceDate(shipments);
  const delayed = shipments.filter((s) => isDelayed(s, today));

  const lane = (list: Shipment[]): Shipment[] => {
    const toCity = /(?:\bto\b|\binto\b)\s+([a-z.\s]+)/.exec(q)?.[1]?.trim();
    const fromCity = /\bfrom\b\s+([a-z.\s]+)/.exec(q)?.[1]?.trim();
    let out = list;
    if (toCity) {
      const c = findCity(toCity, cities);
      if (c) out = out.filter((s) => s.destination === c);
    }
    if (fromCity) {
      const c = findCity(fromCity, cities);
      if (c) out = out.filter((s) => s.origin === c);
    }
    return out;
  };

  // 1. Delayed shipments
  if (/\b(delayed|late|overdue|at risk|at-risk)\b/.test(q)) {
    const rows = lane(delayed);
    return {
      intent: "delayed_shipments",
      answer: `${rows.length} shipment${rows.length === 1 ? " is" : "s are"} currently delayed (delivered after the promised date, or still in transit past it).`,
      columns: ["ID", "Origin", "Destination", "Carrier", "Status", "Promised", "Delivered"],
      rows: toRows(rows).map((r) => omit(r, "Cost (USD)")),
    };
  }

  // 2. Lane questions: "shipments to Chicago", "from Detroit to Nashville"
  if (/\b(to|from|between)\b/.test(q) && /\bshipments?\b/.test(q)) {
    const rows = lane(shipments.filter((s) => s.status !== "cancelled"));
    return {
      intent: "lane_filter",
      answer: `Found ${rows.length} shipment${rows.length === 1 ? "" : "s"} matching that lane.`,
      columns: ["ID", "Origin", "Destination", "Carrier", "Status", "Cost (USD)", "Promised"],
      rows: toRows(rows),
    };
  }

  // 3. Counts
  if (/\bhow many\b/.test(q) && /\bshipments?\b/.test(q)) {
    const active = shipments.filter((s) => s.status !== "cancelled");
    return {
      intent: "count",
      answer: `There are ${active.length} active shipments in the modeled data (${shipments.length - active.length} cancelled).`,
      columns: ["Metric", "Value"],
      rows: [
        { Metric: "Active shipments", Value: active.length },
        { Metric: "Delivered", Value: active.filter((s) => s.status === "delivered").length },
        { Metric: "In transit", Value: active.filter((s) => s.status === "in_transit").length },
        { Metric: "Booked", Value: active.filter((s) => s.status === "booked").length },
        { Metric: "Delayed", Value: delayed.length },
      ],
    };
  }

  // 4. Total cost, optionally by carrier
  if (/\b(total|spend|spending)\b/.test(q) && /\bcost\b/.test(q)) {
    const kpis = computeKpis(shipments);
    if (/\bby carrier\b/.test(q)) {
      const rows = costByCarrier(shipments);
      return {
        intent: "cost_by_carrier",
        answer: `Total freight spend is ${money(kpis.totalCostUsd)} across ${rows.length} carriers.`,
        columns: ["Carrier", "Shipments", "Total cost", "Cost / mile"],
        rows: rows.map((r) => ({
          Carrier: r.carrier,
          Shipments: r.shipments,
          "Total cost": money(r.totalCost),
          "Cost / mile": "$" + r.costPerMile.toFixed(2),
        })),
      };
    }
    return {
      intent: "total_cost",
      answer: `Total freight spend across active shipments is ${money(kpis.totalCostUsd)} (${money(kpis.costPerMile)} per mile).`,
      columns: ["Metric", "Value"],
      rows: [
        { Metric: "Total spend", Value: money(kpis.totalCostUsd) },
        { Metric: "Cost per mile", Value: "$" + kpis.costPerMile.toFixed(2) },
      ],
    };
  }

  // 5. Average transit time
  if (/\b(avg|average)\b/.test(q) && /\b(transit|delivery|days)\b/.test(q)) {
    const kpis = computeKpis(shipments);
    return {
      intent: "avg_transit",
      answer: `Average transit time is ${kpis.avgTransitDays} days across ${kpis.delivered} delivered shipments.`,
      columns: ["Metric", "Value"],
      rows: [{ Metric: "Avg transit (days)", Value: kpis.avgTransitDays }],
    };
  }

  // 6. On-time performance
  if (/\bon[- ]?time\b/.test(q)) {
    const kpis = computeKpis(shipments);
    const exc = findExceptions(shipments);
    return {
      intent: "on_time",
      answer: `On-time performance is ${kpis.onTimePct}% — ${kpis.delivered - exc.filter((e) => e.reason.startsWith("Delivered")).length} of ${kpis.delivered} delivered shipments arrived on or before the promised date.`,
      columns: ["ID", "Origin", "Destination", "Carrier", "Promised", "Reason"],
      rows: exc.map((e) => ({
        ID: e.id,
        Origin: e.origin,
        Destination: e.destination,
        Carrier: e.carrier,
        Promised: e.promisedDate,
        Reason: e.reason,
      })),
    };
  }

  // 7. Cheapest / most expensive carrier
  if (/\b(cheapest|most expensive|costliest)\b/.test(q) && /\bcarrier\b/.test(q)) {
    const rows = costByCarrier(shipments).sort((a, b) => a.costPerMile - b.costPerMile);
    const pick = /\bcheapest\b/.test(q) ? rows[0] : rows[rows.length - 1];
    return {
      intent: "carrier_rank",
      answer: `${pick.carrier} is the ${/\bcheapest\b/.test(q) ? "cheapest" : "most expensive"} at $${pick.costPerMile.toFixed(2)} per mile across ${pick.shipments} shipments.`,
      columns: ["Carrier", "Shipments", "Total cost", "Cost / mile"],
      rows: rows.map((r) => ({
        Carrier: r.carrier,
        Shipments: r.shipments,
        "Total cost": money(r.totalCost),
        "Cost / mile": "$" + r.costPerMile.toFixed(2),
      })),
    };
  }

  // 8. Cost threshold: "shipments over $1500"
  const threshold = amountAfter(q, ["over", "above", "more than", "greater than", "exceeding"]);
  if (threshold !== null && /\bshipments?\b/.test(q)) {
    const rows = shipments.filter((s) => (s.costUsd ?? 0) > threshold);
    return {
      intent: "cost_threshold",
      answer: `${rows.length} shipment${rows.length === 1 ? "" : "s"} cost more than ${money(threshold)}.`,
      columns: ["ID", "Origin", "Destination", "Carrier", "Status", "Cost (USD)"],
      rows: toRows(rows).map((r) => omit(r, "Promised", "Delivered")),
    };
  }

  // 9. Carrier list
  if (/\bcarriers?\b/.test(q) && /\b(list|which|show|all)\b/.test(q)) {
    const rows = costByCarrier(shipments);
    return {
      intent: "carrier_list",
      answer: `${rows.length} carriers are active in the modeled data.`,
      columns: ["Carrier", "Shipments", "Total cost", "Cost / mile"],
      rows: rows.map((r) => ({
        Carrier: r.carrier,
        Shipments: r.shipments,
        "Total cost": money(r.totalCost),
        "Cost / mile": "$" + r.costPerMile.toFixed(2),
      })),
    };
  }

  // 10. Status summary
  if (/\bstatus\b/.test(q)) {
    const counts = new Map<string, number>();
    for (const s of shipments) counts.set(s.status, (counts.get(s.status) ?? 0) + 1);
    return {
      intent: "status_summary",
      answer: `Shipment status breakdown across ${shipments.length} records.`,
      columns: ["Status", "Count"],
      rows: [...counts.entries()].map(([Status, Count]) => ({ Status, Count })),
    };
  }

  return {
    intent: "unknown",
    answer:
      "I can answer operational questions about the modeled shipments. Try one of these:",
    columns: ["Example questions"],
    rows: [
      { "Example questions": "Which shipments are delayed?" },
      { "Example questions": "Show shipments to Chicago" },
      { "Example questions": "What is our total freight cost by carrier?" },
      { "Example questions": "What is the average transit time?" },
      { "Example questions": "Which carrier is the cheapest per mile?" },
      { "Example questions": "Show shipments over $1500" },
    ],
  };
}

export const EXAMPLE_QUESTIONS = [
  "Which shipments are delayed?",
  "Show shipments to Chicago",
  "What is our total freight cost by carrier?",
  "What is the average transit time?",
  "Which carrier is cheapest per mile?",
  "Show shipments over $1500",
];
