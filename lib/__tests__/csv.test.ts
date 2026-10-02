import { describe, expect, it } from "vitest";
import { parseCsv } from "../csv";

describe("parseCsv", () => {
  it("parses quoted fields containing commas", () => {
    const { columns, rows } = parseCsv('a,b\n1,"$1,780.50"\n2,plain');
    expect(columns).toEqual(["a", "b"]);
    expect(rows[0]).toEqual({ a: "1", b: "$1,780.50" });
    expect(rows[1]).toEqual({ a: "2", b: "plain" });
  });

  it("handles escaped quotes", () => {
    const { rows } = parseCsv('a\n"say ""hi"""\n');
    expect(rows[0]).toEqual({ a: 'say "hi"' });
  });

  it("skips the trailing empty line", () => {
    const { rows } = parseCsv("a,b\n1,2\n");
    expect(rows).toHaveLength(1);
  });
});
