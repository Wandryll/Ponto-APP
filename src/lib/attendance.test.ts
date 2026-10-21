import { describe, expect, it } from "vitest";

import { calculateWorkedMilliseconds, dailyCheckpointState } from "./attendance";
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

describe("dailyCheckpointState", () => {
  it("permite novo check-in quando a entrada pendente pertence ao dia anterior em Manaus", () => {
    const records = [record("checkin", "2026-10-20T20:00:00Z")];

    expect(dailyCheckpointState(records, "user-1", new Date("2026-10-21T12:00:00Z"))).toEqual({
      latest: undefined,
      canCheckin: true,
      canCheckout: false,
    });
  });

  it("mantém o checkout vinculado ao check-in do dia atual", () => {
    const yesterday = record("checkin", "2026-10-20T20:00:00Z");
    const today = record("checkin", "2026-10-21T12:03:00Z");

    expect(
      dailyCheckpointState([yesterday, today], "user-1", new Date("2026-10-21T16:00:00Z")),
    ).toEqual({
      latest: today,
      canCheckin: false,
      canCheckout: true,
    });
  });

  it("respeita a virada do dia no fuso America/Manaus", () => {
    const lateCheckin = record("checkin", "2026-10-21T03:30:00Z");

    expect(
      dailyCheckpointState([lateCheckin], "user-1", new Date("2026-10-21T03:45:00Z")),
    ).toMatchObject({ canCheckin: false, canCheckout: true });
    expect(
      dailyCheckpointState([lateCheckin], "user-1", new Date("2026-10-21T04:05:00Z")),
    ).toMatchObject({ canCheckin: true, canCheckout: false });
  });
});
