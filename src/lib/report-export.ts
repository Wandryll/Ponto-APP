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
  generatedBy: string;
  daysWorked: number | null;
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
    @page { size: A4 landscape; margin: 10mm 12mm; }
    body { color: #17202a; font-family: Arial, sans-serif; font-size: 11px; margin: 0; }
    .institutional-header { align-items: center; border-bottom: 2px solid #173f35; display: grid;
      grid-template-columns: 90px 1fr 150px; gap: 16px; margin-bottom: 16px; padding-bottom: 12px; }
    .logo-dct { height: 76px; width: 76px; object-fit: contain; }
    .logo-prefeitura { height: 70px; width: 145px; object-fit: contain; }
    .institution { text-align: center; }
    .institution strong { color: #173f35; display: block; font-size: 15px; text-transform: uppercase; }
    .institution span { display: block; font-size: 11px; margin-top: 3px; }
    h1 { color: #173f35; font-size: 20px; margin: 0 0 4px; text-align: center; text-transform: uppercase; }
    .subtitle { color: #5f6b66; margin-bottom: 18px; }
    .summary { display: grid; grid-template-columns: repeat(4, 1fr); gap: 8px; margin: 14px 0; }
    .item { border: 1px solid #d9e2de; border-radius: 6px; padding: 8px; }
    .label { color: #66736d; display: block; font-size: 9px; text-transform: uppercase; }
    .value { font-size: 13px; font-weight: bold; margin-top: 3px; }
    table { border-collapse: collapse; margin-top: 14px; width: 100%; }
    th { background: #173f35; color: white; text-align: left; }
    th, td { border: 1px solid #d9e2de; padding: 6px; }
    tbody tr:nth-child(even) { background: #f4f7f5; }
    thead { display: table-header-group; }
    tr { break-inside: avoid; }
    .signatures { display: grid; grid-template-columns: 1fr 1fr; gap: 70px; margin: 42px 45px 0; }
    .signature { border-top: 1px solid #39463f; padding-top: 5px; text-align: center; }
    .signature span { color: #66736d; display: block; font-size: 9px; margin-top: 2px; }
    footer { color: #66736d; font-size: 9px; margin-top: 12px; }
  `;
  doc.head.appendChild(style);

  const institutionalHeader = doc.createElement("header");
  institutionalHeader.className = "institutional-header";
  const dctLogo = doc.createElement("img");
  dctLogo.className = "logo-dct";
  dctLogo.src = new URL("/logo-01.jpeg", window.location.origin).href;
  dctLogo.alt = "Logo do Departamento de Ciências e Tecnologia";
  const institution = doc.createElement("div");
  institution.className = "institution";
  const city = doc.createElement("strong");
  city.textContent = "Prefeitura Municipal de Manacapuru";
  const department = doc.createElement("span");
  department.textContent = "Departamento de Ciências e Tecnologia — DCT";
  const destination = doc.createElement("span");
  destination.textContent = "Documento destinado à SEMEC";
  institution.append(city, department, destination);
  const cityLogo = doc.createElement("img");
  cityLogo.className = "logo-prefeitura";
  cityLogo.src = new URL("/logo-02.jpeg", window.location.origin).href;
  cityLogo.alt = "Logo da Prefeitura de Manacapuru";
  institutionalHeader.append(dctLogo, institution, cityLogo);
  doc.body.appendChild(institutionalHeader);

  const heading = doc.createElement("h1");
  heading.textContent = "Relatório de registros de frequência";
  doc.body.appendChild(heading);

  const subtitle = doc.createElement("div");
  subtitle.className = "subtitle";
  subtitle.textContent = `${summary.period} • Funcionário: ${summary.employee} • Equipe: ${summary.team}`;
  doc.body.appendChild(subtitle);

  const summaryElement = doc.createElement("div");
  summaryElement.className = "summary";
  const items = [
    [
      "Dias trabalhados",
      summary.daysWorked === null ? "Selecione um funcionário" : String(summary.daysWorked),
    ],
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

  const signatures = doc.createElement("div");
  signatures.className = "signatures";
  const dctSignature = doc.createElement("div");
  dctSignature.className = "signature";
  dctSignature.textContent = "Responsável pelo DCT";
  const dctSignatureHint = doc.createElement("span");
  dctSignatureHint.textContent = "Assinatura e identificação";
  dctSignature.appendChild(dctSignatureHint);
  const semecSignature = doc.createElement("div");
  semecSignature.className = "signature";
  semecSignature.textContent = "Recebido pela SEMEC";
  const semecSignatureHint = doc.createElement("span");
  semecSignatureHint.textContent = "Assinatura, identificação e data";
  semecSignature.appendChild(semecSignatureHint);
  signatures.append(dctSignature, semecSignature);
  doc.body.appendChild(signatures);

  const footer = doc.createElement("footer");
  footer.textContent = `Emitido por ${summary.generatedBy} no Ponto DCT em ${dateTimeFormatter.format(new Date())}. Documento gerado a partir dos registros armazenados no Supabase.`;
  doc.body.appendChild(footer);

  const waitForImage = (image: HTMLImageElement) =>
    image.complete
      ? Promise.resolve()
      : new Promise<void>((resolve) => {
          image.addEventListener("load", () => resolve(), { once: true });
          image.addEventListener("error", () => resolve(), { once: true });
        });
  void Promise.race([
    Promise.all([waitForImage(dctLogo), waitForImage(cityLogo)]),
    new Promise((resolve) => reportWindow.setTimeout(resolve, 2_000)),
  ]).then(() => reportWindow.setTimeout(() => reportWindow.print(), 100));
  return true;
}
