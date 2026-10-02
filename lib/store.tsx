"use client";

/**
 * Session state for the onboarding flow.
 *
 * Datasets land in Ingest, get mapped to the ontology in Ontology, and are
 * materialized into typed records that power Dashboard and Query. Everything
 * lives in memory for the session — no backend, no keys, it just works.
 */
import {
  createContext,
  useCallback,
  useContext,
  useMemo,
  useState,
  type ReactNode,
} from "react";
import { ONTOLOGY, materializeCarriers, materializeFacilities, materializeShipments, suggestMappings } from "./ontology";
import { loadSeedDatasets } from "./seed";
import type {
  Carrier,
  Dataset,
  Facility,
  FieldMapping,
  MaterializeReport,
  Shipment,
} from "./types";

interface Session {
  datasets: Dataset[];
  seedLoaded: boolean;
  loadSeed: () => void;
  addDataset: (d: Dataset) => void;
  setDatasetEntity: (id: string, entity: string) => void;
  removeDataset: (id: string) => void;
  mappings: Record<string, FieldMapping[]>;
  ensureMappings: (datasetId: string) => void;
  setMapping: (datasetId: string, targetField: string, sourceColumn: string | null) => void;
  shipments: Shipment[];
  carriers: Carrier[];
  facilities: Facility[];
  reports: MaterializeReport[];
  materialize: () => void;
  materialized: boolean;
}

const Ctx = createContext<Session | null>(null);

let uploadCounter = 0;

export function SessionProvider({ children }: { children: ReactNode }) {
  const [datasets, setDatasets] = useState<Dataset[]>([]);
  const [mappings, setMappings] = useState<Record<string, FieldMapping[]>>({});
  const [shipments, setShipments] = useState<Shipment[]>([]);
  const [carriers, setCarriers] = useState<Carrier[]>([]);
  const [facilities, setFacilities] = useState<Facility[]>([]);
  const [reports, setReports] = useState<MaterializeReport[]>([]);
  const [materialized, setMaterialized] = useState(false);

  const seedLoaded = datasets.some((d) => d.id === "shipments");

  const loadSeed = useCallback(() => {
    setDatasets((prev) => {
      if (prev.some((d) => d.id === "shipments")) return prev;
      return [...loadSeedDatasets(), ...prev];
    });
    setMaterialized(false);
  }, []);

  const addDataset = useCallback((d: Dataset) => {
    const id = d.id === "upload" ? `upload-${++uploadCounter}` : d.id;
    setDatasets((prev) => [...prev, { ...d, id }]);
    setMaterialized(false);
  }, []);

  const setDatasetEntity = useCallback((id: string, entity: string) => {
    setDatasets((prev) => prev.map((d) => (d.id === id ? { ...d, entity } : d)));
    setMaterialized(false);
  }, []);

  const removeDataset = useCallback((id: string) => {    setDatasets((prev) => prev.filter((d) => d.id !== id));
    setMappings((prev) => {
      const next = { ...prev };
      delete next[id];
      return next;
    });
    setMaterialized(false);
  }, []);

  const ensureMappings = useCallback(
    (datasetId: string) => {
      setMappings((prev) => {
        if (prev[datasetId]) return prev;
        const ds = datasets.find((d) => d.id === datasetId);
        if (!ds || !ds.entity) return prev;
        return { ...prev, [datasetId]: suggestMappings(ds, ds.entity) };
      });
    },
    [datasets]
  );

  const setMapping = useCallback(
    (datasetId: string, targetField: string, sourceColumn: string | null) => {
      setMappings((prev) => {
        const current = prev[datasetId] ?? [];
        const next = current.map((m) =>
          m.targetField === targetField
            ? { ...m, sourceColumn, confidence: 1, overridden: true }
            : m
        );
        return { ...prev, [datasetId]: next };
      });
      setMaterialized(false);
    },
    []
  );

  const materialize = useCallback(() => {
    const entityOf = (name: string | null) =>
      ONTOLOGY.find((e) => e.name === name) ?? null;
    const ship: Shipment[] = [];
    const carr: Carrier[] = [];
    const fac: Facility[] = [];
    const reps: MaterializeReport[] = [];

    for (const ds of datasets) {
      const entity = entityOf(ds.entity);
      const map = mappings[ds.id] ?? (entity ? suggestMappings(ds, entity.name) : []);
      if (!entity || map.length === 0) continue;
      if (entity.name === "Shipment") {
        const { records, report } = materializeShipments(ds, map);
        ship.push(...records);
        reps.push(report);
      } else if (entity.name === "Carrier") {
        const { records, report } = materializeCarriers(ds, map);
        carr.push(...records);
        reps.push(report);
      } else if (entity.name === "Facility") {
        const { records, report } = materializeFacilities(ds, map);
        fac.push(...records);
        reps.push(report);
      }
    }
    setShipments(ship);
    setCarriers(carr);
    setFacilities(fac);
    setReports(reps);
    setMaterialized(true);
  }, [datasets, mappings]);

  const value = useMemo<Session>(
    () => ({
      datasets,
      seedLoaded,
      loadSeed,
      addDataset,
      setDatasetEntity,
      removeDataset,
      mappings,
      ensureMappings,
      setMapping,
      shipments,
      carriers,
      facilities,
      reports,
      materialize,
      materialized,
    }),
    [
      datasets, seedLoaded, loadSeed, addDataset, setDatasetEntity, removeDataset,
      mappings, ensureMappings, setMapping,
      shipments, carriers, facilities, reports, materialize, materialized,
    ]
  );

  return <Ctx.Provider value={value}>{children}</Ctx.Provider>;
}

export function useSession(): Session {
  const s = useContext(Ctx);
  if (!s) throw new Error("useSession must be used inside SessionProvider");
  return s;
}
