import type { CheckpointRecord } from "@/types";

export const REPORT_TIME_ZONE = "America/Manaus";

export interface ReportEmployee {
  id: string;
  name: string;
  team: string;
}

export interface AttendanceInterval {
  checkin: CheckpointRecord | null;
  checkout: CheckpointRecord | null;
  durationMs: number;
}

export type AttendanceDayStatus = "complete" | "in_progress" | "incomplete";

export interface AttendanceDay {
  date: string;
  intervals: AttendanceInterval[];
  totalMs: number;
  status: AttendanceDayStatus;
  issues: string[];
}

export interface EmployeeAttendanceReport extends ReportEmployee {
  days: AttendanceDay[];
  daysRegistered: number;
  totalMs: number;
  pendingCount: number;
}

const dateFormatter = new Intl.DateTimeFormat("en-CA", {
  timeZone: REPORT_TIME_ZONE,
  year: "numeric",
  month: "2-digit",
  day: "2-digit",
});

const timeFormatter = new Intl.DateTimeFormat("pt-BR", {
  timeZone: REPORT_TIME_ZONE,
  hour: "2-digit",
  minute: "2-digit",
  hour12: false,
});

const displayDateFormatter = new Intl.DateTimeFormat("pt-BR", {
  timeZone: REPORT_TIME_ZONE,
  year: "numeric",
  month: "2-digit",
  day: "2-digit",
});

export function reportDateKey(value: Date | string) {
  return dateFormatter.format(value instanceof Date ? value : new Date(value));
}

export function formatReportDate(value: Date | string) {
  return displayDateFormatter.format(value instanceof Date ? value : new Date(value));
}

export function formatReportTime(value: Date | string) {
  return timeFormatter.format(value instanceof Date ? value : new Date(value));
}

export function formatDuration(milliseconds: number) {
  const totalMinutes = Math.floor(Math.max(0, milliseconds) / 60_000);
  const hours = Math.floor(totalMinutes / 60);
  const minutes = totalMinutes % 60;
  return `${String(hours).padStart(2, "0")}:${String(minutes).padStart(2, "0")}`;
}

function dayFor(map: Map<string, AttendanceDay>, date: string) {
  const current = map.get(date);
  if (current) return current;
  const day: AttendanceDay = {
    date,
    intervals: [],
    totalMs: 0,
    status: "complete",
    issues: [],
  };
  map.set(date, day);
  return day;
}

function addIssue(day: AttendanceDay, issue: string) {
  if (!day.issues.includes(issue)) day.issues.push(issue);
}

export function calculateAttendanceDays(
  records: CheckpointRecord[],
  now: Date = new Date(),
): AttendanceDay[] {
  const sorted = [...records].sort(
    (a, b) => new Date(a.timestamp).getTime() - new Date(b.timestamp).getTime(),
  );
  const days = new Map<string, AttendanceDay>();
  let openCheckin: CheckpointRecord | null = null;

  for (const record of sorted) {
    if (record.type === "checkin") {
      if (openCheckin) {
        const openDay = dayFor(days, reportDateKey(openCheckin.timestamp));
        openDay.intervals.push({ checkin: openCheckin, checkout: null, durationMs: 0 });
        addIssue(openDay, "Entrada duplicada sem saída intermediária");
      }
      openCheckin = record;
      continue;
    }

    if (!openCheckin) {
      const day = dayFor(days, reportDateKey(record.timestamp));
      day.intervals.push({ checkin: null, checkout: record, durationMs: 0 });
      addIssue(day, "Saída sem entrada correspondente");
      continue;
    }

    const day = dayFor(days, reportDateKey(openCheckin.timestamp));
    const durationMs = Math.max(
      0,
      new Date(record.timestamp).getTime() - new Date(openCheckin.timestamp).getTime(),
    );
    day.intervals.push({ checkin: openCheckin, checkout: record, durationMs });
    day.totalMs += durationMs;
    openCheckin = null;
  }

  if (openCheckin) {
    const date = reportDateKey(openCheckin.timestamp);
    const day = dayFor(days, date);
    day.intervals.push({ checkin: openCheckin, checkout: null, durationMs: 0 });
    addIssue(
      day,
      date === reportDateKey(now) ? "Ponto em andamento" : "Entrada sem saída correspondente",
    );
  }

  return [...days.values()]
    .map((day) => {
      const inProgress = day.issues.includes("Ponto em andamento");
      return {
        ...day,
        status: day.issues.length ? (inProgress ? "in_progress" : "incomplete") : "complete",
      } satisfies AttendanceDay;
    })
    .sort((a, b) => a.date.localeCompare(b.date));
}

export function buildEmployeeAttendanceReports(
  employees: ReportEmployee[],
  records: CheckpointRecord[],
  now: Date = new Date(),
): EmployeeAttendanceReport[] {
  const recordsByEmployee = new Map<string, CheckpointRecord[]>();
  records.forEach((record) => {
    recordsByEmployee.set(record.userId, [...(recordsByEmployee.get(record.userId) ?? []), record]);
  });

  return employees
    .map((employee) => {
      const days = calculateAttendanceDays(recordsByEmployee.get(employee.id) ?? [], now);
      return {
        ...employee,
        days,
        daysRegistered: days.length,
        totalMs: days.reduce((total, day) => total + day.totalMs, 0),
        pendingCount: days.reduce((total, day) => total + day.issues.length, 0),
      };
    })
    .sort((a, b) => a.name.localeCompare(b.name, "pt-BR"));
}

export function limitAttendanceReportPeriod(
  report: EmployeeAttendanceReport,
  start: string,
  end: string,
): EmployeeAttendanceReport {
  const days = report.days.filter((day) => day.date >= start && day.date <= end);
  return {
    ...report,
    days,
    daysRegistered: days.length,
    totalMs: days.reduce((total, day) => total + day.totalMs, 0),
    pendingCount: days.reduce((total, day) => total + day.issues.length, 0),
  };
}

export function monthPeriod(reference: Date = new Date()) {
  const current = reportDateKey(reference);
  const [year, month] = current.split("-").map(Number);
  const lastDay = new Date(Date.UTC(year, month, 0)).getUTCDate();
  return {
    start: `${year}-${String(month).padStart(2, "0")}-01`,
    end: `${year}-${String(month).padStart(2, "0")}-${String(lastDay).padStart(2, "0")}`,
  };
}

export function reportRangeToUtc(start: string, end: string) {
  return {
    startUtc: `${start}T04:00:00.000Z`,
    endExclusiveUtc: `${addDays(end, 1)}T04:00:00.000Z`,
  };
}

export function addDays(date: string, amount: number) {
  const [year, month, day] = date.split("-").map(Number);
  const value = new Date(Date.UTC(year, month - 1, day + amount));
  return value.toISOString().slice(0, 10);
}
