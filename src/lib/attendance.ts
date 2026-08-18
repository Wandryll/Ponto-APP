import type { CheckpointRecord } from "@/types";

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
