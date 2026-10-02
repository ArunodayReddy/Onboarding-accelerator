/**
 * The Harborline ontology + the mapping/materialization pipeline.
 *
 * Ontology: three entities (Shipment, Carrier, Facility) with typed fields.
 * Mapping: auto-suggest source-column -> ontology-field links by name
 * similarity, with a synonym table for the usual client naming quirks.
 * Materialization: coerce every row into typed records — multi-format dates,
 * currency strings, fuzzy status canonicalization, city casing — and report
 * what had to be dropped or guessed.
 */
import { parseDate, parseNumber } from "./infer";
import type {
  Dataset,
  FieldMapping,
  MaterializeReport,
  OntologyEntity,
  Shipment,
  Carrier,
  Facility,
  ShipmentStatus,
} from "./types";

export const ONTOLOGY: OntologyEntity[] = [
  {
    name: "Shipment",
    label: "Shipment",
    description:
      "A single freight movement from origin to destination, tendered to a carrier.",
    fields: [
      { name: "id", label: "Shipment ID", type: "string", required: true, description: "Client's shipment identifier" },
      { name: "origin", label: "Origin", type: "string", required: true, description: "Origin city" },
      { name: "destination", label: "Destination", type: "string", required: true, description: "Destination city" },
      { name: "pickupDate", label: "Pickup date", type: "date", required: true, description: "Tender / pickup date" },
      { name: "promisedDate", label: "Promised date", type: "date", required: true, description: "Promised delivery date" },
      { name: "deliveryDate", label: "Delivery date", type: "date", required: false, description: "Actual delivery date, if delivered" },
      { name: "carrier", label: "Carrier", type: "string", required: true, description: "Carrier name" },
      { name: "status", label: "Status", type: "enum", required: true, enumValues: ["booked", "in_transit", "delivered", "delayed", "cancelled"], description: "Canonical shipment status" },
      { name: "weightLbs", label: "Weight (lbs)", type: "number", required: false, description: "Shipment weight in pounds" },
      { name: "costUsd", label: "Cost (USD)", type: "number", required: false, description: "Freight cost in USD" },
      { name: "miles", label: "Miles", type: "number", required: false, description: "Route miles" },
    ],
  },
  {
    name: "Carrier",
    label: "Carrier",
    description: "A contracted trucking carrier.",
    fields: [
      { name: "id", label: "Carrier ID", type: "string", required: true, description: "Carrier identifier" },
      { name: "name", label: "Carrier name", type: "string", required: true, description: "Carrier legal/trade name" },
      { name: "mcNumber", label: "MC number", type: "string", required: false, description: "FMCSA motor carrier number" },
      { name: "fleetSize", label: "Fleet size", type: "number", required: false, description: "Power units in fleet" },
      { name: "onTimePct", label: "On-time %", type: "number", required: false, description: "Reported on-time percentage" },
    ],
  },
  {
    name: "Facility",
    label: "Facility",
    description: "A Harborline warehouse or cross-dock.",
    fields: [
      { name: "code", label: "Facility code", type: "string", required: true, description: "Facility code" },
      { name: "city", label: "City", type: "string", required: true, description: "Facility city" },
      { name: "state", label: "State", type: "string", required: true, description: "Two-letter state" },
      { name: "kind", label: "Kind", type: "string", required: false, description: "warehouse | cross_dock" },
      { name: "capacityPallets", label: "Capacity (pallets)", type: "number", required: false, description: "Pallet positions" },
    ],
  },
];

/** Known client-naming quirks per ontology field. */
const SYNONYMS: Record<string, Record<string, string[]>> = {
  Shipment: {
    id: ["shipmentid", "shipment_id", "shipid"],
    origin: ["from", "origin_city", "origincity"],
    destination: ["to", "dest", "destination_city", "destcity"],
    pickupDate: ["pickupdate", "pickup", "tenderdate", "shipdate"],
    promisedDate: ["promiseddate", "promised", "etadate", "duedate"],
    deliveryDate: ["deliverydate", "delivereddate", "actualdelivery"],
    carrier: ["carriername", "carrier_name", "scac"],
    status: ["shipmentstatus", "state"],
    weightLbs: ["weightlbs", "weight_lbs", "weight", "lbs"],
    costUsd: ["costusd", "cost_usd", "cost", "freightcost", "amount"],
    miles: ["distance", "distancemiles"],
  },
  Carrier: {
    id: ["carrierid", "carrier_id", "id"],
    name: ["carriername", "name", "carrier"],
    mcNumber: ["mcnumber", "mc_number", "mc"],
    fleetSize: ["fleetsize", "fleet_size", "trucks"],
    onTimePct: ["ontimepct", "on_time_pct", "otpct", "ontime"],
  },
  Facility: {
    code: ["facilitycode", "facility_code", "code", "id"],
    city: ["facilitycity"],
    state: ["st", "province"],
    kind: ["facilitytype", "type"],
    capacityPallets: ["capacitypallets", "capacity_pallets", "capacity"],
  },
};

const norm = (s: string) => s.toLowerCase().replace(/[^a-z0-9]/g, "");

function tokens(s: string): string[] {
  return s
    .replace(/([a-z])([A-Z])/g, "$1 $2")
    .toLowerCase()
    .split(/[^a-z0-9]+/)
    .filter(Boolean);
}

function similarity(field: string, column: string, synonyms: string[]): number {
  const f = norm(field);
  const c = norm(column);
  if (f === c) return 1;
  if (synonyms.some((s) => norm(s) === c)) return 0.95;
  if (f.length > 2 && (c.includes(f) || f.includes(c))) return 0.85;
  const ft = new Set(tokens(field));
  const ct = new Set(tokens(column));
  const inter = [...ft].filter((t) => ct.has(t)).length;
  const jaccard = inter / (ft.size + ct.size - inter);
  if (jaccard >= 0.5) return 0.6 + 0.2 * jaccard;
  return 0;
}

/** Auto-suggest a column mapping for every field of an entity. */
export function suggestMappings(
  dataset: Dataset,
  entityName: string
): FieldMapping[] {
  const entity = ONTOLOGY.find((e) => e.name === entityName);
  if (!entity) return [];
  const claimed = new Set<string>();
  const scored = entity.fields.map((field) => {
    const synonyms = SYNONYMS[entityName]?.[field.name] ?? [];
    let best: { column: string; score: number } | null = null;
    for (const column of dataset.columns) {
      const score = similarity(field.name, column, synonyms);
      if (score > 0 && (!best || score > best.score)) best = { column, score };
    }
    return { field: field.name, best };
  });
  // Greedy: highest-confidence claims win, so two fields never share a column.
  scored.sort((a, b) => (b.best?.score ?? 0) - (a.best?.score ?? 0));
  const result: FieldMapping[] = [];
  for (const { field, best } of scored) {
    if (best && best.score >= 0.6 && !claimed.has(best.column)) {
      claimed.add(best.column);
      result.push({
        sourceColumn: best.column,
        targetField: field,
        confidence: Math.round(best.score * 100) / 100,
        overridden: false,
      });
    } else {
      result.push({
        sourceColumn: null,
        targetField: field,
        confidence: 0,
        overridden: false,
      });
    }
  }
  // Restore canonical field order.
  const order = new Map(entity.fields.map((f, i) => [f.name, i]));
  result.sort((a, b) => (order.get(a.targetField) ?? 0) - (order.get(b.targetField) ?? 0));
  return result;
}

function titleCaseCity(raw: string): string {
  return raw
    .split(/(\s+|[.-])/)
    .map((part) =>
      /^[a-z]+$/i.test(part)
        ? part.charAt(0).toUpperCase() + part.slice(1).toLowerCase()
        : part
    )
    .join("")
    .replace(/\bSt\. Louis\b/, "St. Louis");
}

function levenshtein(a: string, b: string): number {
  const dp: number[][] = Array.from({ length: a.length + 1 }, (_, i) =>
    Array.from({ length: b.length + 1 }, (_, j) => (i === 0 ? j : j === 0 ? i : 0))
  );
  for (let i = 1; i <= a.length; i++)
    for (let j = 1; j <= b.length; j++)
      dp[i][j] = Math.min(
        dp[i - 1][j] + 1,
        dp[i][j - 1] + 1,
        dp[i - 1][j - 1] + (a[i - 1] === b[j - 1] ? 0 : 1)
      );
  return dp[a.length][b.length];
}

/** Canonicalize the wild status spellings found in client extracts. */
export function canonicalizeStatus(raw: string): ShipmentStatus | null {
  const v = raw.toLowerCase().replace(/[-_\s]+/g, "");
  if (v === "") return null;
  const table: [string, ShipmentStatus][] = [
    ["booked", "booked"],
    ["intransit", "in_transit"],
    ["delivered", "delivered"],
    ["delayed", "delayed"],
    ["cancelled", "cancelled"],
    ["canceled", "cancelled"],
  ];
  for (const [key, status] of table) {
    if (v === key) return status;
    if (v.startsWith("deliver") || v.startsWith("delvier")) return "delivered";
    if (v.startsWith("intrans")) return "in_transit";
    if (levenshtein(v, key) <= 2) return status;
  }
  return null;
}

type Row = Record<string, string>;

function get(row: Row, mappings: FieldMapping[], field: string): string {
  const m = mappings.find((x) => x.targetField === field);
  if (!m?.sourceColumn) return "";
  return row[m.sourceColumn] ?? "";
}

export function materializeShipments(
  dataset: Dataset,
  mappings: FieldMapping[]
): { records: Shipment[]; report: MaterializeReport } {
  const records: Shipment[] = [];
  const warnings: string[] = [];
  let dropped = 0;

  dataset.rows.forEach((row, idx) => {
    const id = get(row, mappings, "id").trim();
    const pickup = parseDate(get(row, mappings, "pickupDate"));
    const promised = parseDate(get(row, mappings, "promisedDate"));
    if (!id || !pickup || !promised) {
      dropped++;
      return;
    }
    const deliveryRaw = get(row, mappings, "deliveryDate");
    const delivery = deliveryRaw.trim() ? parseDate(deliveryRaw) : null;
    if (deliveryRaw.trim() && !delivery) {
      warnings.push(`Row ${idx + 1} (${id}): unparseable delivery date "${deliveryRaw}" — treated as missing`);
    }
    const status = canonicalizeStatus(get(row, mappings, "status"));
    if (!status) {
      dropped++;
      warnings.push(`Row ${idx + 1} (${id}): unrecognized status "${get(row, mappings, "status")}" — row dropped`);
      return;
    }
    records.push({
      id,
      origin: titleCaseCity(get(row, mappings, "origin").trim()),
      destination: titleCaseCity(get(row, mappings, "destination").trim()),
      pickupDate: pickup.iso,
      promisedDate: promised.iso,
      deliveryDate: delivery ? delivery.iso : null,
      carrier: get(row, mappings, "carrier").trim(),
      status,
      weightLbs: parseNumber(get(row, mappings, "weightLbs")),
      costUsd: parseNumber(get(row, mappings, "costUsd")),
      miles: parseNumber(get(row, mappings, "miles")),
    });
  });

  return {
    records,
    report: {
      entity: "Shipment",
      datasetId: dataset.id,
      records: records.length,
      dropped,
      warnings: warnings.slice(0, 8),
    },
  };
}

export function materializeCarriers(
  dataset: Dataset,
  mappings: FieldMapping[]
): { records: Carrier[]; report: MaterializeReport } {
  const records: Carrier[] = [];
  let dropped = 0;
  for (const row of dataset.rows) {
    const id = get(row, mappings, "id").trim();
    const name = get(row, mappings, "name").trim();
    if (!id || !name) {
      dropped++;
      continue;
    }
    records.push({
      id,
      name,
      mcNumber: get(row, mappings, "mcNumber").trim(),
      fleetSize: parseNumber(get(row, mappings, "fleetSize")),
      onTimePct: parseNumber(get(row, mappings, "onTimePct")),
    });
  }
  return {
    records,
    report: { entity: "Carrier", datasetId: dataset.id, records: records.length, dropped, warnings: [] },
  };
}

export function materializeFacilities(
  dataset: Dataset,
  mappings: FieldMapping[]
): { records: Facility[]; report: MaterializeReport } {
  const records: Facility[] = [];
  let dropped = 0;
  for (const row of dataset.rows) {
    const code = get(row, mappings, "code").trim();
    const city = get(row, mappings, "city").trim();
    if (!code || !city) {
      dropped++;
      continue;
    }
    records.push({
      code,
      city: titleCaseCity(city),
      state: get(row, mappings, "state").trim().toUpperCase(),
      kind: get(row, mappings, "kind").trim(),
      capacityPallets: parseNumber(get(row, mappings, "capacityPallets")),
    });
  }
  return {
    records,
    report: { entity: "Facility", datasetId: dataset.id, records: records.length, dropped, warnings: [] },
  };
}
