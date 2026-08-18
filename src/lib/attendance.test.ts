import { describe, expect, it } from "vitest";

import { calculateWorkedMilliseconds } from "./attendance";
import type { CheckpointRecord, CheckpointType } from "@/types";

function record(type: CheckpointType, timestamp: string): CheckpointRecord {
  return {
    id: `${type}-${timestamp}`,
    userId: "user-1",
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

describe("calculateWorkedMilliseconds", () => {
  it("calcula um expediente completo", () => {
    const result = calculateWorkedMilliseconds([
      record("checkin", "2026-08-17T08:00:00-04:00"),
      record("checkout", "2026-08-17T17:00:00-04:00"),
    ]);

    expect(result).toBe(9 * 60 * 60 * 1000);
  });

  it("soma múltiplos períodos e ignora check-in aberto", () => {
    const result = calculateWorkedMilliseconds([
      record("checkout", "2026-08-17T12:00:00-04:00"),
      record("checkin", "2026-08-17T13:00:00-04:00"),
      record("checkin", "2026-08-17T08:00:00-04:00"),
      record("checkout", "2026-08-17T17:00:00-04:00"),
      record("checkin", "2026-08-17T18:00:00-04:00"),
    ]);

    expect(result).toBe(8 * 60 * 60 * 1000);
  });

  it("retorna zero quando não existe um par válido", () => {
    expect(calculateWorkedMilliseconds([record("checkin", "2026-08-17T08:00:00-04:00")])).toBe(0);
  });
});
