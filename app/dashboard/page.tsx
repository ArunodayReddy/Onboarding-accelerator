"use client";

import Link from "next/link";
import {
  computeKpis,
  costByCarrier,
  findExceptions,
  shipmentsByStatus,
} from "../../lib/analytics";
import { useSession } from "../../lib/store";
import { BarChart, Card, DataTable, KpiCard, PageHeader } from "../../components/viz";

const STATUS_COLORS: Record<string, string> = {
  booked: "#94a3b8",
  in_transit: "#3b82f6",
  delivered: "#10b981",
  delayed: "#f59e0b",
  cancelled: "#ef4444",
};

export default function DashboardPage() {
  const { shipments, materialized } = useSession();

  if (!materialized || shipments.length === 0) {
    return (
      <div>
        <PageHeader
          title="Operations dashboard"
          subtitle="Live KPIs over the modeled shipment data."
        />
        <Card className="p-10 text-center">
          <p className="text-slate-600 mb-4">
            No modeled data yet. Ingest the extracts and materialize the ontology first —
            it takes about a minute.
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

  const kpis = computeKpis(shipments);
  const byStatus = shipmentsByStatus(shipments);
  const exceptions = findExceptions(shipments);
  const carrierCosts = costByCarrier(shipments);

  const money = (n: number) =>
    "$" + n.toLocaleString("en-US", { maximumFractionDigits: 0 });

  return (
    <div>
      <PageHeader
        title="Operations dashboard"
        subtitle={`Live view over ${kpis.totalShipments} modeled shipments · September 2026 extract`}
      />

      <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-4 mb-8">
        <KpiCard label="Active shipments" value={String(kpis.totalShipments)} />
        <KpiCard label="On-time %" value={`${kpis.onTimePct}%`} hint={`${kpis.delivered} delivered`} />
        <KpiCard label="Avg transit" value={`${kpis.avgTransitDays}d`} />
        <KpiCard label="Freight spend" value={money(kpis.totalCostUsd)} />
        <KpiCard label="Cost / mile" value={`$${kpis.costPerMile.toFixed(2)}`} />
        <KpiCard label="Exceptions" value={String(kpis.exceptionCount)} hint="need attention" />
      </div>

      <div className="grid md:grid-cols-2 gap-6 mb-8">
        <Card className="p-6">
          <h2 className="text-lg font-semibold text-slate-900 mb-4">
            Shipments by status
          </h2>
          <BarChart
            data={byStatus.map((s) => ({
              label: s.status,
              value: s.count,
              color: STATUS_COLORS[s.status] ?? "#4f46e5",
            }))}
          />
          <p className="mt-3 text-xs text-slate-500">
            “Delayed” is derived — delivered after the promised date, or still in
            transit past it. It doesn&apos;t exist in the raw extract.
          </p>
        </Card>
        <Card className="p-6">
          <h2 className="text-lg font-semibold text-slate-900 mb-4">
            Freight spend by carrier
          </h2>
          <DataTable
            columns={["Carrier", "Shipments", "Total cost", "Cost / mile"]}
            rows={carrierCosts.map((c) => ({
              Carrier: c.carrier,
              Shipments: c.shipments,
              "Total cost": money(c.totalCost),
              "Cost / mile": `$${c.costPerMile.toFixed(2)}`,
            }))}
          />
        </Card>
      </div>

      <Card className="p-6">
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-lg font-semibold text-slate-900">
            Exceptions requiring action
          </h2>
          <span className="text-sm text-slate-500">{exceptions.length} open</span>
        </div>
        <DataTable
          columns={["ID", "Origin", "Destination", "Carrier", "Promised", "Reason"]}
          rows={exceptions.map((e) => ({
            ID: e.id,
            Origin: e.origin,
            Destination: e.destination,
            Carrier: e.carrier,
            Promised: e.promisedDate,
            Reason: e.reason,
          }))}
          empty="No exceptions — everything is on track."
        />
      </Card>
    </div>
  );
}
