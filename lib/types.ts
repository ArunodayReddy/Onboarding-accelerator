/**
 * Core domain types for the Harborline FDE onboarding accelerator.
 *
 * The flow is: raw CSV extracts -> Dataset (+ ColumnProfile) -> FieldMapping
 * against the Ontology -> materialized typed records (Shipment/Carrier/Facility).
 */

export type InferredType = "integer" | "float" | "boolean" | "date" | "string";

export interface ColumnProfile {
  name: string;
  inferredType: InferredType;
  nullCount: number;
  nullRate: number; // 0..1
  distinctCount: number;
  samples: string[];
  issues: string[];
  dateFormats: string[];
}

export interface Dataset {
  id: string;
  name: string;
  /** Ontology entity this dataset feeds, if assigned yet. */
  entity: string | null;
  rowCount: number;
  columns: string[];
  rows: Record<string, string>[];
  profile: ColumnProfile[];
}

export type OntologyFieldType = "string" | "number" | "date" | "enum";

export interface OntologyField {
  name: string;
  label: string;
  type: OntologyFieldType;
  required: boolean;
  enumValues?: string[];
  description: string;
}

export interface OntologyEntity {
  name: string;
  label: string;
  description: string;
  fields: OntologyField[];
}

export interface FieldMapping {
  /** Source column name, or null when the target field is intentionally unmapped. */
  sourceColumn: string | null;
  targetField: string;
  /** 0..1 — confidence of the auto-suggestion. 1 when manually overridden. */
  confidence: number;
  overridden: boolean;
}

export type ShipmentStatus =
  | "booked"
  | "in_transit"
  | "delivered"
  | "delayed"
  | "cancelled";

export interface Shipment {
  id: string;
  origin: string;
  destination: string;
  pickupDate: string; // ISO yyyy-mm-dd
  promisedDate: string; // ISO yyyy-mm-dd
  deliveryDate: string | null; // ISO yyyy-mm-dd
  carrier: string;
  status: ShipmentStatus;
  weightLbs: number | null;
  costUsd: number | null;
  miles: number | null;
}

export interface Carrier {
  id: string;
  name: string;
  mcNumber: string;
  fleetSize: number | null;
  onTimePct: number | null;
}

export interface Facility {
  code: string;
  city: string;
  state: string;
  kind: string;
  capacityPallets: number | null;
}

export interface MaterializeReport {
  entity: string;
  datasetId: string;
  records: number;
  dropped: number;
  warnings: string[];
}

export interface QueryResult {
  answer: string;
  columns: string[];
  rows: Record<string, string | number>[];
  intent: string;
}
