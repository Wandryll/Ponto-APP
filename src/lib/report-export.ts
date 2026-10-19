export interface AttendanceExportRow {
  employee: string;
  team: string;
  type: "checkin" | "checkout";
  timestamp: string;
  latitude: number;
  longitude: number;
}

export interface AttendanceReportSummary {
  period: string;
  employee: string;
  team: string;
  daysWorked: number;
  late: number;
  totalHours: number;
  averageHours: number;
  overtimeHours: number;
}

const dateTimeFormatter = new Intl.DateTimeFormat("pt-BR", {
  dateStyle: "short",
  timeStyle: "medium",
});

const csvCell = (value: string | number) => {
  let text = String(value);
  if (typeof value === "string" && /^[=+\-@]/.test(text)) text = `'${text}`;
  return `"${text.replaceAll('"', '""')}"`;
};

export function buildAttendanceCsv(rows: AttendanceExportRow[]) {
  const header = ["Funcionário", "Equipe", "Tipo", "Data e hora", "Latitude", "Longitude"];
  const lines = rows.map((row) =>
    [
      row.employee,
      row.team,
      row.type === "checkin" ? "Entrada" : "Saída",
      dateTimeFormatter.format(new Date(row.timestamp)),
      row.latitude,
      row.longitude,
    ]
      .map(csvCell)
      .join(";"),
  );

  return `\uFEFF${header.map(csvCell).join(";")}\r\n${lines.join("\r\n")}`;
}

export function downloadAttendanceCsv(rows: AttendanceExportRow[], filename: string) {
  const blob = new Blob([buildAttendanceCsv(rows)], {
    type: "text/csv;charset=utf-8",
  });
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = filename;
  link.click();
  window.setTimeout(() => URL.revokeObjectURL(url), 0);
}

function addCell(row: HTMLTableRowElement, value: string, tag: "td" | "th" = "td") {
  const cell = document.createElement(tag);
  cell.textContent = value;
  row.appendChild(cell);
}

export function printAttendanceReport(
  rows: AttendanceExportRow[],
  summary: AttendanceReportSummary,
) {
  const reportWindow = window.open("", "_blank");
  if (!reportWindow) return false;
  reportWindow.opener = null;

  const doc = reportWindow.document;
  doc.title = "Relatório de ponto — DCT";

  const style = doc.createElement("style");
  style.textContent = `
    @page { size: A4 landscape; margin: 12mm; }
    body { color: #17202a; font-family: Arial, sans-serif; font-size: 11px; margin: 0; }
    h1 { color: #173f35; font-size: 22px; margin: 0 0 4px; }
    .subtitle { color: #5f6b66; margin-bottom: 18px; }
    .summary { display: grid; grid-template-columns: repeat(4, 1fr); gap: 8px; margin: 14px 0; }
    .item { border: 1px solid #d9e2de; border-radius: 6px; padding: 8px; }
    .label { color: #66736d; display: block; font-size: 9px; text-transform: uppercase; }
    .value { font-size: 13px; font-weight: bold; margin-top: 3px; }
    table { border-collapse: collapse; margin-top: 14px; width: 100%; }
    th { background: #173f35; color: white; text-align: left; }
    th, td { border: 1px solid #d9e2de; padding: 6px; }
    tbody tr:nth-child(even) { background: #f4f7f5; }
    footer { color: #66736d; font-size: 9px; margin-top: 12px; }
  `;
  doc.head.appendChild(style);

  const heading = doc.createElement("h1");
  heading.textContent = "Relatório de registros de ponto";
  doc.body.appendChild(heading);

  const subtitle = doc.createElement("div");
  subtitle.className = "subtitle";
  subtitle.textContent = `${summary.period} • Funcionário: ${summary.employee} • Equipe: ${summary.team}`;
  doc.body.appendChild(subtitle);

  const summaryElement = doc.createElement("div");
  summaryElement.className = "summary";
  const items = [
    ["Dias trabalhados", String(summary.daysWorked)],
    ["Atrasos", String(summary.late)],
    ["Horas totais", `${summary.totalHours.toFixed(1)}h`],
    ["Média por dia", `${summary.averageHours.toFixed(1)}h`],
    ["Horas extras", `${summary.overtimeHours.toFixed(1)}h`],
    ["Registros", String(rows.length)],
  ];
  items.forEach(([label, value]) => {
    const item = doc.createElement("div");
    item.className = "item";
    const labelElement = doc.createElement("span");
    labelElement.className = "label";
    labelElement.textContent = label;
    const valueElement = doc.createElement("div");
    valueElement.className = "value";
    valueElement.textContent = value;
    item.append(labelElement, valueElement);
    summaryElement.appendChild(item);
  });
  doc.body.appendChild(summaryElement);

  const table = doc.createElement("table");
  const tableHead = doc.createElement("thead");
  const headerRow = doc.createElement("tr");
  ["Funcionário", "Equipe", "Tipo", "Data e hora", "Latitude", "Longitude"].forEach((text) =>
    addCell(headerRow, text, "th"),
  );
  tableHead.appendChild(headerRow);
  table.appendChild(tableHead);

  const tableBody = doc.createElement("tbody");
  rows.forEach((record) => {
    const row = doc.createElement("tr");
    addCell(row, record.employee);
    addCell(row, record.team);
    addCell(row, record.type === "checkin" ? "Entrada" : "Saída");
    addCell(row, dateTimeFormatter.format(new Date(record.timestamp)));
    addCell(row, record.latitude.toFixed(6));
    addCell(row, record.longitude.toFixed(6));
    tableBody.appendChild(row);
  });
  table.appendChild(tableBody);
  doc.body.appendChild(table);

  const footer = doc.createElement("footer");
  footer.textContent = `Gerado pelo Ponto DCT em ${dateTimeFormatter.format(new Date())}.`;
  doc.body.appendChild(footer);

  reportWindow.setTimeout(() => reportWindow.print(), 150);
  return true;
}
