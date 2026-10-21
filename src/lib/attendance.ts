import type { CheckpointRecord } from "@/types";
import { reportDateKey } from "@/lib/attendance-report";

export function dailyCheckpointState(
  records: CheckpointRecord[],
  userId: string,
  now: Date = new Date(),
) {
  const today = reportDateKey(now);
  const latest = records
    .filter((record) => record.userId === userId && reportDateKey(record.timestamp) === today)
    .sort((a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime())[0];

  return {
    latest,
    canCheckin: !latest || latest.type === "checkout",
    canCheckout: latest?.type === "checkin",
  };
}

export function calculateWorkedMilliseconds(records: CheckpointRecord[]) {
  const sorted = [...records].sort(
    (a, b) => new Date(a.timestamp).getTime() - new Date(b.timestamp).getTime(),
  );
  let openCheckin: CheckpointRecord | null = null;
  let total = 0;

  for (const record of sorted) {
    if (record.type === "checkin") {
      openCheckin = record;
    } else if (openCheckin) {
      total += Math.max(
        0,
        new Date(record.timestamp).getTime() - new Date(openCheckin.timestamp).getTime(),
      );
      openCheckin = null;
    }
  }

  return total;
}
