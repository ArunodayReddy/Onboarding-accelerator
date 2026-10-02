import { describe, expect, it } from "vitest";
import {
  canonicalizeStatus,
  materializeShipments,
  suggestMappings,
} from "../ontology";
import { loadSeedDatasets } from "../seed";

describe("canonicalizeStatus", () => {
  it("maps the wild spellings to the canonical enum", () => {
    expect(canonicalizeStatus("delivered")).toBe("delivered");
    expect(canonicalizeStatus("delviered")).toBe("delivered");
    expect(canonicalizeStatus("Delivered")).toBe("delivered");
    expect(canonicalizeStatus("In-Transit")).toBe("in_transit");
    expect(canonicalizeStatus("IN TRANSIT")).toBe("in_transit");
    expect(canonicalizeStatus("in-transit")).toBe("in_transit");
    expect(canonicalizeStatus("booked")).toBe("booked");
    expect(canonicalizeStatus("cancelled")).toBe("cancelled");
  });

  it("returns null for the unknown", () => {
    expect(canonicalizeStatus("")).toBeNull();
    expect(canonicalizeStatus("teleporting")).toBeNull();
  });
});

describe("suggestMappings", () => {
  it("auto-maps the messy shipment extract with high confidence", () => {
    const ds = loadSeedDatasets().find((d) => d.id === "shipments")!;
    const map = suggestMappings(ds, "Shipment");
    const byField = new Map(map.map((m) => [m.targetField, m]));
    expect(byField.get("id")?.sourceColumn).toBe("ShipmentID");
    expect(byField.get("carrier")?.sourceColumn).toBe("carrier_name");
    expect(byField.get("weightLbs")?.sourceColumn).toBe("Weight_lbs");
    expect(byField.get("costUsd")?.sourceColumn).toBe("Cost_USD");
    // Every required field got a confident suggestion.
    for (const m of map) {
      if (["id", "origin", "destination", "pickupDate", "promisedDate", "carrier", "status"].includes(m.targetField)) {
        expect(m.sourceColumn).not.toBeNull();
        expect(m.confidence).toBeGreaterThanOrEqual(0.6);
      }
    }
  });
});

describe("materializeShipments", () => {
  it("materializes all 30 seed rows with normalization applied", () => {
    const ds = loadSeedDatasets().find((d) => d.id === "shipments")!;
    const map = suggestMappings(ds, "Shipment");
    const { records, report } = materializeShipments(ds, map);

    expect(report.dropped).toBe(0);
    expect(records).toHaveLength(30);

    const s1002 = records.find((r) => r.id === "SHP-1002")!;
    expect(s1002.status).toBe("delivered"); // "delviered" canonicalized
    expect(s1002.pickupDate).toBe("2026-09-02"); // US format parsed
    expect(s1002.costUsd).toBe(1780.5); // "$1,780.50" coerced
    expect(s1002.origin).toBe("Chicago"); // casing normalized

    const s1011 = records.find((r) => r.id === "SHP-1011")!;
    expect(s1011.pickupDate).toBe("2026-09-08"); // "8-Sep-2026" parsed

    const s1004 = records.find((r) => r.id === "SHP-1004")!;
    expect(s1004.status).toBe("in_transit");
    expect(s1004.deliveryDate).toBeNull(); // missing stays missing
  });
});
