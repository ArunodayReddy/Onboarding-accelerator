import { describe, expect, it } from "vitest";
import { parseDate, parseNumber, profileColumn } from "../infer";

describe("parseDate", () => {
  it("parses the four formats found in client extracts", () => {
    expect(parseDate("2026-09-01")?.iso).toBe("2026-09-01");
    expect(parseDate("09/02/2026")?.iso).toBe("2026-09-02");
    expect(parseDate("Sep 3 2026")?.iso).toBe("2026-09-03");
    expect(parseDate("8-Sep-2026")?.iso).toBe("2026-09-08");
  });

  it("rejects non-dates", () => {
    expect(parseDate("delivered")).toBeNull();
    expect(parseDate("")).toBeNull();
    expect(parseDate("13/45/2026")).toBeNull();
  });
});

describe("parseNumber", () => {
  it("strips currency symbols and separators", () => {
    expect(parseNumber("$1,780.50")).toBe(1780.5);
    expect(parseNumber("1450.00")).toBe(1450);
  });

  it("rejects non-numeric strings", () => {
    expect(parseNumber("")).toBeNull();
    expect(parseNumber("N/A")).toBeNull();
  });
});

describe("profileColumn", () => {
  it("flags mixed date formats", () => {
    const p = profileColumn("pickup_date", [
      "2026-09-01",
      "09/02/2026",
      "Sep 3 2026",
      "8-Sep-2026",
    ]);
    expect(p.inferredType).toBe("date");
    expect(p.dateFormats).toHaveLength(4);
    expect(p.issues.some((i) => i.includes("Mixed date formats"))).toBe(true);
  });

  it("flags typo clusters and inconsistent casing", () => {
    const p = profileColumn("Status", [
      "delivered",
      "Delivered",
      "delviered",
      "in_transit",
    ]);
    expect(
      p.issues.some((i) => i.includes("delviered") && i.includes("delivered"))
    ).toBe(true);
    expect(p.issues.some((i) => i.includes("Inconsistent casing"))).toBe(true);
  });

  it("flags currency-formatted numbers but still infers float", () => {
    const p = profileColumn("Cost_USD", ["1450.00", "$1,780.50", "980"]);
    expect(p.inferredType).toBe("float");
    expect(p.issues.some((i) => i.includes("currency symbols"))).toBe(true);
  });

  it("flags high null rates", () => {
    const p = profileColumn("DeliveryDate", ["2026-09-03", "", "", "", ""]);
    expect(p.nullRate).toBe(0.8);
    expect(p.issues.some((i) => i.includes("High null rate"))).toBe(true);
  });
});
