import { describe, expect, it } from "vitest";

import {
  buildEmployeeAttendanceReports,
  calculateAttendanceDays,
  formatDuration,
  reportDateKey,
} from "./attendance-report";
import type { CheckpointRecord, CheckpointType } from "@/types";

function record(type: CheckpointType, timestamp: string, userId = "user-1"): CheckpointRecord {
  return {
    id: `${userId}-${type}-${timestamp}`,
    userId,
    userName: "Funcionário",
    userAvatar: "",
    type,
    timestamp,
    latitude: 0,
    longitude: 0,
    address: "",
    photo: "",
    status: "on_time",
  };
}

describe("attendance reports", () => {
  it("apura uma jornada normal no fuso de Manaus", () => {
    const days = calculateAttendanceDays([
      record("checkin", "2026-10-19T12:00:00Z"),
      record("checkout", "2026-10-19T21:00:00Z"),
    ]);
    expect(days).toHaveLength(1);
    expect(days[0]).toMatchObject({ date: "2026-10-19", totalMs: 9 * 3_600_000 });
    expect(days[0].status).toBe("complete");
  });

  it("soma múltiplos intervalos do mesmo dia", () => {
    const days = calculateAttendanceDays([
      record("checkin", "2026-10-19T12:00:00Z"),
      record("checkout", "2026-10-19T16:00:00Z"),
      record("checkin", "2026-10-19T17:00:00Z"),
      record("checkout", "2026-10-19T21:00:00Z"),
    ]);
    expect(days[0].intervals).toHaveLength(2);
    expect(days[0].totalMs).toBe(8 * 3_600_000);
  });

  it("não inventa saída e diferencia ponto atual de pendência histórica", () => {
    const current = calculateAttendanceDays(
      [record("checkin", "2026-10-20T12:00:00Z")],
      new Date("2026-10-20T13:00:00Z"),
    );
    const historical = calculateAttendanceDays(
      [record("checkin", "2026-10-19T12:00:00Z")],
      new Date("2026-10-20T13:00:00Z"),
    );
    expect(current[0].status).toBe("in_progress");
    expect(historical[0].status).toBe("incomplete");
    expect(historical[0].totalMs).toBe(0);
  });

  it("sinaliza entradas e saídas duplicadas", () => {
    const days = calculateAttendanceDays([
      record("checkout", "2026-10-19T11:00:00Z"),
      record("checkin", "2026-10-19T12:00:00Z"),
      record("checkin", "2026-10-19T13:00:00Z"),
      record("checkout", "2026-10-19T17:00:00Z"),
      record("checkout", "2026-10-19T18:00:00Z"),
    ]);
    expect(days[0].issues).toEqual([
      "Saída sem entrada correspondente",
      "Entrada duplicada sem saída intermediária",
    ]);
    expect(days[0].totalMs).toBe(4 * 3_600_000);
  });

  it("atribui uma jornada que cruza meia-noite à data da entrada", () => {
    const days = calculateAttendanceDays([
      record("checkin", "2026-10-20T03:00:00Z"),
      record("checkout", "2026-10-20T05:00:00Z"),
    ]);
    expect(days[0].date).toBe("2026-10-19");
    expect(days[0].totalMs).toBe(2 * 3_600_000);
  });

  it("consolida mensalmente sem misturar funcionários", () => {
    const reports = buildEmployeeAttendanceReports(
      [
        { id: "user-2", name: "Zélia", team: "DCT" },
        { id: "user-1", name: "Ana", team: "DCT" },
      ],
      [
        record("checkin", "2026-10-01T12:00:00Z"),
        record("checkout", "2026-10-01T20:00:00Z"),
        record("checkin", "2026-10-02T12:00:00Z", "user-2"),
        record("checkout", "2026-10-02T16:00:00Z", "user-2"),
      ],
    );
    expect(reports.map((item) => item.name)).toEqual(["Ana", "Zélia"]);
    expect(reports[0].totalMs).toBe(8 * 3_600_000);
    expect(reports[1].totalMs).toBe(4 * 3_600_000);
  });

  it("formata datas e totais superiores a 24 horas", () => {
    expect(reportDateKey("2026-10-20T02:00:00Z")).toBe("2026-10-19");
    expect(formatDuration(27 * 3_600_000 + 15 * 60_000)).toBe("27:15");
  });
});
