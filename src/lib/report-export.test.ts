import { describe, expect, it } from "vitest";

import {
  buildFrequencyMirrorRows,
  frequencyAccrualDate,
  safeSpreadsheetText,
} from "@/lib/report-export";
import type { EmployeeAttendanceReport } from "@/lib/attendance-report";

describe("safeSpreadsheetText", () => {
  it("neutraliza fórmulas em campos textuais", () => {
    expect(safeSpreadsheetText('=HYPERLINK("https://example.com")')).toBe(
      `'${'=HYPERLINK("https://example.com")'}`,
    );
    expect(safeSpreadsheetText("+Equipe")).toBe("'+Equipe");
    expect(safeSpreadsheetText("Equipe DCT")).toBe("Equipe DCT");
  });
});

describe("buildFrequencyMirrorRows", () => {
  it("mantém múltiplos períodos e registros incompletos em linhas separadas", () => {
    const report = {
      id: "employee-1",
      name: "Maria",
      team: "DCT",
      daysRegistered: 1,
      totalMs: 0,
      pendingCount: 1,
      days: [
        {
          date: "2026-10-19",
          totalMs: 0,
          status: "incomplete",
          issues: ["Entrada sem saída correspondente"],
          intervals: [
            {
              checkin: {
                id: "1",
                userId: "employee-1",
                userName: "Maria",
                userAvatar: "",
                type: "checkin",
                timestamp: "2026-10-19T11:30:00Z",
                latitude: 0,
                longitude: 0,
                address: "",
                photo: "",
                status: "on_time",
              },
              checkout: null,
              durationMs: 0,
            },
            {
              checkin: null,
              checkout: {
                id: "2",
                userId: "employee-1",
                userName: "Maria",
                userAvatar: "",
                type: "checkout",
                timestamp: "2026-10-19T16:00:00Z",
                latitude: 0,
                longitude: 0,
                address: "",
                photo: "",
                status: "on_time",
              },
              durationMs: 0,
            },
          ],
        },
      ],
    } satisfies EmployeeAttendanceReport;

    expect(buildFrequencyMirrorRows(report)).toEqual([
      ["19/10/2026", "07:30", "—"],
      ["19/10/2026", "—", "12:00"],
    ]);
  });
});

describe("frequencyAccrualDate", () => {
  it("informa a data apurada quando o período ainda não terminou", () => {
    expect(frequencyAccrualDate("2026-10-31", new Date("2026-10-20T12:00:00Z"))).toBe("20/10/2026");
  });

  it("omite a informação em períodos já encerrados", () => {
    expect(frequencyAccrualDate("2026-10-19", new Date("2026-10-20T12:00:00Z"))).toBeNull();
  });
});
