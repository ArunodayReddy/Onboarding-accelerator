import { describe, expect, it } from "vitest";
import { computeKpis } from "../analytics";
import { answerQuestion } from "../nlq";
import { materializeShipments, suggestMappings } from "../ontology";
import { loadSeedDatasets } from "../seed";
import type { Shipment } from "../types";

function seedShipments(): Shipment[] {
  const ds = loadSeedDatasets().find((d) => d.id === "shipments")!;
  return materializeShipments(ds, suggestMappings(ds, "Shipment")).records;
}

describe("computeKpis", () => {
  it("derives delays from dates, not from raw status text", () => {
    const kpis = computeKpis(seedShipments());
    // 9 delivered late + 6 in transit past promised = 15 exceptions.
    expect(kpis.exceptionCount).toBe(15);
    // 11 of 20 delivered arrived on/before promised.
    expect(kpis.onTimePct).toBe(55);
    expect(kpis.avgTransitDays).toBe(2.5);
    expect(kpis.totalShipments).toBe(29); // 30 rows minus 1 cancelled
  });
});

describe("answerQuestion", () => {
  const shipments = seedShipments();

  it("answers delayed-shipment questions", () => {
    const r = answerQuestion("Which shipments are delayed?", shipments);
    expect(r.intent).toBe("delayed_shipments");
    expect(r.rows).toHaveLength(15);
    expect(r.answer).toContain("15");
  });

  it("filters lanes by city", () => {
    const r = answerQuestion("Show shipments to Chicago", shipments);
    expect(r.intent).toBe("lane_filter");
    expect(r.rows).toHaveLength(5);
    expect(
      r.rows.every((row) => row["Destination"] === "Chicago")
    ).toBe(true);
  });

  it("aggregates cost by carrier", () => {
    const r = answerQuestion(
      "What is our total freight cost by carrier?",
      shipments
    );
    expect(r.intent).toBe("cost_by_carrier");
    expect(r.rows).toHaveLength(6);
  });

  it("answers threshold questions", () => {
    const r = answerQuestion("Show shipments over $1500", shipments);
    expect(r.intent).toBe("cost_threshold");
    expect(
      r.rows.every((row) => Number(String(row["Cost (USD)"]).replace(/[$,]/g, "")) > 1500)
    ).toBe(true);
  });

  it("gracefully handles the unknown", () => {
    const r = answerQuestion("What is the meaning of life?", shipments);
    expect(r.intent).toBe("unknown");
    expect(r.rows.length).toBeGreaterThan(0);
  });
});
