/**
 * Operational analytics over materialized Shipment records.
 *
 * "Delayed" is a derived truth, not a raw status: a shipment counts as
 * delayed when it was delivered after its promised date, or is still
 * in transit past the promised date (relative to the latest date in the
 * extract, so the demo is deterministic).
 */
import type { Shipment } from "./types";

export interface Kpis {
  totalShipments: number;
  delivered: number;
  onTimePct: number;
  avgTransitDays: number;
  totalCostUsd: number;
  costPerMile: number;
  exceptionCount: number;
}

export interface Exception {
  id: string;
  origin: string;
  destination: string;
  carrier: string;
  promisedDate: string;
  reason: string;
}

const dayMs = 86_400_000;

function daysBetween(aIso: string, bIso: string): number {
  return Math.round(
    (new Date(bIso + "T00:00:00Z").getTime() - new Date(aIso + "T00:00:00Z").getTime()) / dayMs
  );
}

/** Latest pickup date in the data — the demo's stand-in for "today". */
export function referenceDate(shipments: Shipment[]): string {
  return shipments.reduce(
    (max, s) => (s.pickupDate > max ? s.pickupDate : max),
    shipments[0]?.pickupDate ?? "2026-09-30"
  );
}

export function isDelayed(s: Shipment, today: string): boolean {
  if (s.status === "cancelled") return false;
  if (s.deliveryDate) return s.deliveryDate > s.promisedDate;
  return s.status === "in_transit" && today > s.promisedDate;
}

export function isOnTime(s: Shipment): boolean {
  return (
    s.status === "delivered" && !!s.deliveryDate && s.deliveryDate <= s.promisedDate
  );
}

export function computeKpis(shipments: Shipment[]): Kpis {
  const today = referenceDate(shipments);
  const active = shipments.filter((s) => s.status !== "cancelled");
  const delivered = active.filter((s) => s.status === "delivered");
  const onTime = delivered.filter(isOnTime);
  const withTransit = delivered.filter((s) => s.deliveryDate);
  const totalCost = active.reduce((sum, s) => sum + (s.costUsd ?? 0), 0);
  const totalMiles = active.reduce((sum, s) => sum + (s.miles ?? 0), 0);

  return {
    totalShipments: active.length,
    delivered: delivered.length,
    onTimePct:
      delivered.length === 0
        ? 0
        : Math.round((onTime.length / delivered.length) * 1000) / 10,
    avgTransitDays:
      withTransit.length === 0
        ? 0
        : Math.round(
            (withTransit.reduce((sum, s) => sum + daysBetween(s.pickupDate, s.deliveryDate!), 0) /
              withTransit.length) *
              10
          ) / 10,
    totalCostUsd: Math.round(totalCost * 100) / 100,
    costPerMile:
      totalMiles === 0 ? 0 : Math.round((totalCost / totalMiles) * 100) / 100,
    exceptionCount: active.filter((s) => isDelayed(s, today)).length,
  };
}

export function shipmentsByStatus(
  shipments: Shipment[]
): { status: string; count: number }[] {
  const counts = new Map<string, number>();
  for (const s of shipments) counts.set(s.status, (counts.get(s.status) ?? 0) + 1);
  const order = ["booked", "in_transit", "delivered", "delayed", "cancelled"];
  const withDelayed = new Map(counts);
  // Fold derived delays into their own bucket for the chart.
  const today = referenceDate(shipments);
  let delayed = 0;
  for (const s of shipments) if (isDelayed(s, today)) delayed++;
  if (delayed > 0) {
    withDelayed.set("delivered", (withDelayed.get("delivered") ?? 0) - delayed);
    withDelayed.set("delayed", delayed);
  }
  return order
    .filter((st) => (withDelayed.get(st) ?? 0) > 0)
    .map((st) => ({ status: st, count: withDelayed.get(st)! }));
}

export function findExceptions(shipments: Shipment[]): Exception[] {
  const today = referenceDate(shipments);
  return shipments
    .filter((s) => isDelayed(s, today))
    .map((s) => ({
      id: s.id,
      origin: s.origin,
      destination: s.destination,
      carrier: s.carrier,
      promisedDate: s.promisedDate,
      reason:
        s.deliveryDate != null
          ? `Delivered ${daysBetween(s.promisedDate, s.deliveryDate)}d late`
          : `In transit, promised ${s.promisedDate}`,
    }));
}

export interface CarrierCost {
  carrier: string;
  shipments: number;
  totalCost: number;
  costPerMile: number;
}

export function costByCarrier(shipments: Shipment[]): CarrierCost[] {
  const map = new Map<string, { cost: number; miles: number; n: number }>();
  for (const s of shipments) {
    if (s.status === "cancelled") continue;
    const e = map.get(s.carrier) ?? { cost: 0, miles: 0, n: 0 };
    e.cost += s.costUsd ?? 0;
    e.miles += s.miles ?? 0;
    e.n += 1;
    map.set(s.carrier, e);
  }
  return [...map.entries()]
    .map(([carrier, e]) => ({
      carrier,
      shipments: e.n,
      totalCost: Math.round(e.cost * 100) / 100,
      costPerMile: e.miles === 0 ? 0 : Math.round((e.cost / e.miles) * 100) / 100,
    }))
    .sort((a, b) => b.totalCost - a.totalCost);
}

export function knownCities(shipments: Shipment[]): string[] {
  const set = new Set<string>();
  for (const s of shipments) {
    set.add(s.origin);
    set.add(s.destination);
  }
  return [...set];
}
