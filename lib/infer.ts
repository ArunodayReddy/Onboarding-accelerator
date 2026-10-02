/**
 * Schema inference + data-quality profiling for raw client extracts.
 *
 * For each column we infer a type, measure null/distinct rates, capture
 * samples, and flag the classic "spreadsheet in the wild" issues FDEs hit
 * on day one: mixed date formats, inconsistent casing, typo clusters,
 * currency-formatted numbers, and stray whitespace.
 */
import type { ColumnProfile, InferredType } from "./types";

const MONTHS: Record<string, number> = {
  jan: 1, feb: 2, mar: 3, apr: 4, may: 5, jun: 6,
  jul: 7, aug: 8, sep: 9, oct: 10, nov: 11, dec: 12,
  january: 1, february: 2, march: 3, april: 4, june: 6,
  july: 7, august: 8, september: 9, october: 10, november: 11, december: 12,
};

export interface ParsedDate {
  iso: string;
  format: "ISO" | "US" | "Long" | "D-Mon-Y";
}

/** Parse the date formats commonly found in client extracts. */
export function parseDate(value: string): ParsedDate | null {
  const v = value.trim();
  let m: RegExpMatchArray | null;

  m = v.match(/^(\d{4})-(\d{2})-(\d{2})$/);
  if (m) return { iso: `${m[1]}-${m[2]}-${m[3]}`, format: "ISO" };

  m = v.match(/^(\d{1,2})\/(\d{1,2})\/(\d{4})$/);
  if (m) {
    const [mm, dd, yyyy] = [m[1].padStart(2, "0"), m[2].padStart(2, "0"), m[3]];
    if (+mm <= 12 && +dd <= 31) return { iso: `${yyyy}-${mm}-${dd}`, format: "US" };
  }

  m = v.match(/^([A-Za-z]{3,9})\s+(\d{1,2})\s+(\d{4})$/);
  if (m) {
    const mon = MONTHS[m[1].toLowerCase()];
    if (mon) {
      return {
        iso: `${m[3]}-${String(mon).padStart(2, "0")}-${m[2].padStart(2, "0")}`,
        format: "Long",
      };
    }
  }

  m = v.match(/^(\d{1,2})-([A-Za-z]{3})-(\d{4})$/);
  if (m) {
    const mon = MONTHS[m[2].toLowerCase()];
    if (mon && +m[1] <= 31) {
      return {
        iso: `${m[3]}-${String(mon).padStart(2, "0")}-${m[1].padStart(2, "0")}`,
        format: "D-Mon-Y",
      };
    }
  }
  return null;
}

export function parseNumber(value: string): number | null {
  const cleaned = value.replace(/[$,\s]/g, "");
  if (cleaned === "" || cleaned === "-" || cleaned === ".") return null;
  if (!/^-?\d+(\.\d+)?$/.test(cleaned)) return null;
  const n = Number(cleaned);
  return Number.isFinite(n) ? n : null;
}

function levenshtein(a: string, b: string): number {
  const dp: number[][] = Array.from({ length: a.length + 1 }, (_, i) =>
    Array.from({ length: b.length + 1 }, (_, j) => (i === 0 ? j : j === 0 ? i : 0))
  );
  for (let i = 1; i <= a.length; i++) {
    for (let j = 1; j <= b.length; j++) {
      dp[i][j] = Math.min(
        dp[i - 1][j] + 1,
        dp[i][j - 1] + 1,
        dp[i - 1][j - 1] + (a[i - 1] === b[j - 1] ? 0 : 1)
      );
    }
  }
  return dp[a.length][b.length];
}

const BOOLEAN_WORDS = new Set(
  ["true", "false", "yes", "no", "y", "n", "1", "0"].map((s) => s)
);

function inferType(values: string[]): { type: InferredType; dateFormats: string[] } {
  const dateFormats = new Set<string>();
  let isInt = true, isFloat = true, isBool = true, isDate = true;

  for (const v of values) {
    if (!/^-?\d+$/.test(v)) isInt = false;
    if (parseNumber(v) === null) isFloat = false;
    if (!BOOLEAN_WORDS.has(v.toLowerCase())) isBool = false;
    const d = parseDate(v);
    if (d) dateFormats.add(d.format);
    else isDate = false;
  }
  if (isInt) return { type: "integer", dateFormats: [] };
  if (isFloat) return { type: "float", dateFormats: [] };
  if (isBool) return { type: "boolean", dateFormats: [] };
  if (isDate) return { type: "date", dateFormats: [...dateFormats] };
  return { type: "string", dateFormats: [] };
}

export function profileColumn(
  name: string,
  rawValues: string[]
): ColumnProfile {
  const total = rawValues.length;
  const nonEmpty = rawValues.filter((v) => v !== "");
  const nullCount = total - nonEmpty.length;
  const { type, dateFormats } = inferType(nonEmpty);
  const distinct = new Set(nonEmpty);
  const issues: string[] = [];

  if (total > 0 && nullCount / total > 0.2) {
    issues.push(
      `High null rate — ${Math.round((nullCount / total) * 100)}% of values are empty`
    );
  }
  if (dateFormats.length > 1) {
    issues.push(`Mixed date formats in one column: ${dateFormats.join(", ")}`);
  }
  if (type === "float" || type === "integer") {
    if (nonEmpty.some((v) => /[$,]/.test(v))) {
      issues.push("Numeric values contain currency symbols or thousands separators");
    }
  }
  if (type === "string") {
    // Inconsistent casing: same value, different cases.
    const byLower = new Map<string, Set<string>>();
    for (const v of nonEmpty) {
      const k = v.toLowerCase();
      if (!byLower.has(k)) byLower.set(k, new Set());
      byLower.get(k)!.add(v);
    }
    const offenders = [...byLower.values()]
      .filter((s) => s.size > 1)
      .slice(0, 3)
      .map((s) => `"${[...s].join('" vs "')}"`);
    if (offenders.length > 0) {
      issues.push(`Inconsistent casing: ${offenders.join(", ")}`);
    }
    // Typo clusters: near-duplicate low-cardinality values.
    if (distinct.size <= 25 && distinct.size > 1) {
      const vals = [...distinct];
      const pairs: string[] = [];
      const dominant = new Map<string, number>();
      for (const v of nonEmpty) dominant.set(v, (dominant.get(v) ?? 0) + 1);
      outer: for (let i = 0; i < vals.length; i++) {
        for (let j = i + 1; j < vals.length; j++) {
          const [a, b] = [vals[i], vals[j]];
          if (a.toLowerCase() === b.toLowerCase()) continue;
          if (levenshtein(a.toLowerCase(), b.toLowerCase()) <= 2) {
            const typo = (dominant.get(a) ?? 0) >= (dominant.get(b) ?? 0) ? b : a;
            const canon = typo === a ? b : a;
            pairs.push(`"${typo}" ≈ "${canon}"`);
            if (pairs.length >= 3) break outer;
          }
        }
      }
      if (pairs.length > 0) issues.push(`Possible typos: ${pairs.join(", ")}`);
    }
  }
  if (nonEmpty.some((v) => v !== v.trim())) {
    issues.push("Values contain leading or trailing whitespace");
  }

  return {
    name,
    inferredType: type,
    nullCount,
    nullRate: total === 0 ? 0 : nullCount / total,
    distinctCount: distinct.size,
    samples: [...distinct].slice(0, 4),
    issues,
    dateFormats,
  };
}

export function profileDataset(
  columns: string[],
  rows: Record<string, string>[]
): ColumnProfile[] {
  return columns.map((col) =>
    profileColumn(col, rows.map((r) => r[col] ?? ""))
  );
}
