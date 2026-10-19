import { describe, expect, it } from "vitest";

import { buildAttendanceCsv } from "@/lib/report-export";

describe("buildAttendanceCsv", () => {
  it("exports records with an Excel-compatible separator and BOM", () => {
    const csv = buildAttendanceCsv([
      {
        employee: "Maria Silva",
        team: "Administrativo",
        type: "checkin",
        timestamp: "2026-10-19T12:30:00.000Z",
        latitude: -3.284848,
        longitude: -60.631474,
      },
    ]);

    expect(csv.startsWith("\uFEFF")).toBe(true);
    expect(csv).toContain('"Maria Silva";"Administrativo";"Entrada"');
    expect(csv).toContain('"-3.284848";"-60.631474"');
  });

  it("neutralizes spreadsheet formulas from text fields", () => {
    const csv = buildAttendanceCsv([
      {
        employee: '=HYPERLINK("https://example.com")',
        team: "+Equipe",
        type: "checkout",
        timestamp: "2026-10-19T12:30:00.000Z",
        latitude: -3.284848,
        longitude: -60.631474,
      },
    ]);

    expect(csv).toContain('"\'=HYPERLINK(""https://example.com"")"');
    expect(csv).toContain('"\'+Equipe"');
  });
});
