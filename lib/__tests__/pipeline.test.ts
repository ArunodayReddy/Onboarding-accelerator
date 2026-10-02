/**
 * End-to-end pipeline test.
 *
 * Mirrors exactly what the UI does when a user clicks through
 * Ingest → Ontology → Materialize → Dashboard → Ask data:
 *   loadSeedDatasets → suggestMappings → materialize* →
 *   computeKpis / findExceptions / costByCarrier → answerQuestion
 */
import { describe, expect, it } from "vitest";
import { loadSeedDatasets } from "../seed";
import {
  ONTOLOGY,
  materializeCarriers,
  materializeFacilities,
  materializeShipments,
  suggestMappings,
} from "../ontology";
import {
  computeKpis,
  costByCarrier,
  findExceptions,
} from "../analytics";
import { answerQuestion } from "../nlq";
import type { Carrier, Facility, Shipment } from "../types";

/** Replicates lib/store.tsx's materialize() over the auto-suggested mappings. */
function runFullPipeline() {
  const datasets = loadSeedDatasets(); // "Load Harborline sample extracts"
  const entityOf = (name: string | null) =>
    ONTOLOGY.find((e) => e.name === name) ?? null;

  const shipments: Shipment[] = [];
  const carriers: Carrier[] = [];
  const facilities: Facility[] = [];
  const dropped: Record<string, number> = {};

  for (const ds of datasets) {
    const entity = entityOf(ds.entity);
    const map = entity ? suggestMappings(ds, entity.name) : [];
    if (!entity || map.length === 0) continue;
    if (entity.name === "Shipment") {
      const { records, report } = materializeShipments(ds, map);
      shipments.push(...records);
      dropped[ds.id] = report.dropped;
    } else if (entity.name === "Carrier") {
      const { records, report } = materializeCarriers(ds, map);
      carriers.push(...records);
      dropped[ds.id] = report.dropped;
    } else if (entity.name === "Facility") {
      const { records, report } = materializeFacilities(ds, map);
      facilities.push(...records);
      dropped[ds.id] = report.dropped;
    }
  }
  return { datasets, shipments, carriers, facilities, dropped };
}

describe("harborline end-to-end pipeline", () => {
  const { datasets, shipments, carriers, facilities, dropped } =
    runFullPipeline();

  it("ingest: loads the three client extracts with column profiles", () => {
    expect(datasets).toHaveLength(3);
    for (const ds of datasets) {
      expect(ds.profile.length).toBe(ds.columns.length);
      expect(ds.rowCount).toBeGreaterThan(0);
    }
  });

  it("ingest: profiler flags the known data-quality issues", () => {
    const shipDs = datasets.find((d) => d.entity === "Shipment")!;
    const pickup = shipDs.profile.find((p) => p.name === "pickup_date")!;
    expect(pickup.dateFormats.length).toBeGreaterThan(1); // 4 formats
    const status = shipDs.profile.find((p) => p.name === "Status")!;
    expect(status.issues.length).toBeGreaterThan(0); // delviered typo etc.
  });

  it("ontology: auto-suggest maps every source column with confidence", () => {
    for (const ds of datasets) {
      const map = suggestMappings(ds, ds.entity!);
      expect(map.length).toBeGreaterThan(0);
      for (const m of map) {
        expect(m.sourceColumn).toBeTruthy();
        expect(m.confidence).toBeGreaterThan(0);
      }
    }
    const shipDs = datasets.find((d) => d.entity === "Shipment")!;
    expect(suggestMappings(shipDs, "Shipment")).toHaveLength(
      shipDs.columns.length
    );
  });

  it("materialize: produces typed records without dropping rows", () => {
    expect(shipments.length).toBeGreaterThan(0);
    expect(carriers.length).toBeGreaterThan(0);
    expect(facilities.length).toBeGreaterThan(0);
    expect(Object.values(dropped).every((n) => n === 0)).toBe(true);
    // spot-check normalization the UI promises
    expect(
      shipments.every((s) =>
        ["booked", "in_transit", "delivered", "delayed", "cancelled"].includes(
          s.status
        )
      )
    ).toBe(true);
  });

  it("dashboard: KPIs match the verified business numbers", () => {
    const kpis = computeKpis(shipments);
    expect(kpis.totalShipments).toBe(29);
    expect(kpis.onTimePct).toBe(55);
    expect(kpis.avgTransitDays).toBe(2.5);
    expect(kpis.exceptionCount).toBe(15);
  });

  it("dashboard: exceptions queue holds the 15 at-risk shipments", () => {
    const exceptions = findExceptions(shipments);
    expect(exceptions).toHaveLength(15);
    const byId = new Map(shipments.map((s) => [s.id, s]));
    const deliveredLate = exceptions.filter(
      (e) => byId.get(e.id)?.status === "delivered"
    );
    const inTransitPastPromise = exceptions.filter(
      (e) => byId.get(e.id)?.status !== "delivered"
    );
    expect(deliveredLate).toHaveLength(9);
    expect(inTransitPastPromise).toHaveLength(6);
  });

  it("dashboard: cost-by-carrier identifies the cheapest per mile", () => {
    const costs = costByCarrier(shipments);
    expect(costs.length).toBeGreaterThan(0);
    const cheapest = [...costs].sort((a, b) => a.costPerMile - b.costPerMile)[0];
    expect(costs[0].carrier).toBe(cheapest.carrier); // sorted asc
  });

  it("ask data: 'Which shipments are delayed?' returns the 15 exceptions", () => {
    const res = answerQuestion("Which shipments are delayed?", shipments);
    expect(res.rows).toHaveLength(15);
  });

  it("ask data: cheapest-carrier question names the cheapest carrier", () => {
    const costs = costByCarrier(shipments);
    const cheapest = [...costs].sort((a, b) => a.costPerMile - b.costPerMile)[0];
    const res = answerQuestion(
      "Which carrier is cheapest per mile?",
      shipments
    );
    expect(res.answer).toContain(cheapest.carrier);
  });

  it("ask data: city filter narrows to Chicago-bound shipments", () => {
    const res = answerQuestion("Show shipments to Chicago", shipments);
    expect(res.rows.length).toBeGreaterThan(0);
    expect(
      res.rows.every((r) => String(r["Destination"]).toLowerCase() === "chicago")
    ).toBe(true);
  });
});
