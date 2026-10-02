/**
 * Minimal RFC-4180-ish CSV parser. Handles quoted fields, escaped quotes
 * (""), and commas inside quotes. Good enough for client data extracts;
 * swap for papaparse if extracts get truly feral.
 */
export function parseCsv(text: string): {
  columns: string[];
  rows: Record<string, string>[];
} {
  const rows: string[][] = [];
  let current: string[] = [];
  let field = "";
  let inQuotes = false;

  const pushField = () => {
    current.push(field);
    field = "";
  };
  const pushRow = () => {
    pushField();
    // Skip fully-empty trailing rows.
    if (!(current.length === 1 && current[0] === "")) rows.push(current);
    current = [];
  };

  const normalized = text.replace(/\r\n/g, "\n").replace(/\r/g, "\n");
  for (let i = 0; i < normalized.length; i++) {
    const ch = normalized[i];
    if (inQuotes) {
      if (ch === '"') {
        if (normalized[i + 1] === '"') {
          field += '"';
          i++;
        } else {
          inQuotes = false;
        }
      } else {
        field += ch;
      }
    } else if (ch === '"') {
      inQuotes = true;
    } else if (ch === ",") {
      pushField();
    } else if (ch === "\n") {
      pushRow();
    } else {
      field += ch;
    }
  }
  pushRow();

  if (rows.length === 0) return { columns: [], rows: [] };
  const columns = rows[0].map((c) => c.trim());
  const data = rows.slice(1).map((r) => {
    const obj: Record<string, string> = {};
    columns.forEach((col, idx) => {
      obj[col] = (r[idx] ?? "").trim();
    });
    return obj;
  });
  return { columns, rows: data };
}
