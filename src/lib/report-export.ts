import { jsPDF } from "jspdf";
import autoTable from "jspdf-autotable";

import {
  formatDuration,
  formatReportDate,
  formatReportTime,
  type AttendanceDay,
  type EmployeeAttendanceReport,
} from "@/lib/attendance-report";

export interface ReportMetadata {
  start: string;
  end: string;
  generatedBy: string;
  team: string;
}

const COLORS = {
  navy: [18, 47, 76] as [number, number, number],
  green: [23, 63, 53] as [number, number, number],
  gold: [184, 143, 45] as [number, number, number],
  light: [244, 247, 245] as [number, number, number],
};

export function safeSpreadsheetText(value: string) {
  return /^[=+\-@]/.test(value) ? `'${value}` : value;
}

async function imageData(path: string) {
  const response = await fetch(path);
  if (!response.ok) throw new Error(`Não foi possível carregar ${path}`);
  const blob = await response.blob();
  return new Promise<string>((resolve, reject) => {
    const reader = new FileReader();
    reader.addEventListener("load", () => resolve(String(reader.result)), { once: true });
    reader.addEventListener("error", () => reject(reader.error), { once: true });
    reader.readAsDataURL(blob);
  });
}

async function loadLogos() {
  const results = await Promise.allSettled([
    imageData("/logo-01.jpeg"),
    imageData("/logo-02.jpeg"),
  ]);
  return {
    dct: results[0].status === "fulfilled" ? results[0].value : null,
    city: results[1].status === "fulfilled" ? results[1].value : null,
  };
}

function addInstitutionalHeader(
  doc: jsPDF,
  title: string,
  metadata: ReportMetadata,
  logos: Awaited<ReturnType<typeof loadLogos>>,
) {
  const pageWidth = doc.internal.pageSize.getWidth();
  if (logos.dct) doc.addImage(logos.dct, "JPEG", 14, 9, 20, 20);
  if (logos.city) doc.addImage(logos.city, "JPEG", pageWidth - 48, 9, 34, 18);
  doc.setTextColor(...COLORS.navy);
  doc.setFont("helvetica", "bold");
  doc.setFontSize(11);
  doc.text("PREFEITURA MUNICIPAL DE MANACAPURU", pageWidth / 2, 12, { align: "center" });
  doc.setFontSize(9);
  doc.text("SECRETARIA MUNICIPAL DE EDUCAÇÃO — SEMEC", pageWidth / 2, 17, { align: "center" });
  doc.text("DEPARTAMENTO DE CIÊNCIAS E TECNOLOGIA — DCT", pageWidth / 2, 22, { align: "center" });
  doc.setDrawColor(...COLORS.gold);
  doc.setLineWidth(0.7);
  doc.line(14, 32, pageWidth - 14, 32);
  doc.setTextColor(...COLORS.green);
  doc.setFontSize(14);
  doc.text(title, pageWidth / 2, 39, { align: "center" });
  doc.setTextColor(70, 78, 74);
  doc.setFont("helvetica", "normal");
  doc.setFontSize(8);
  doc.text(
    `Período: ${formatReportDate(`${metadata.start}T12:00:00Z`)} a ${formatReportDate(`${metadata.end}T12:00:00Z`)} | Emissão: ${formatReportDate(new Date())} | Equipe: ${metadata.team}`,
    pageWidth / 2,
    44,
    { align: "center" },
  );
}

function addPageNumbers(doc: jsPDF) {
  const pages = doc.getNumberOfPages();
  const width = doc.internal.pageSize.getWidth();
  const height = doc.internal.pageSize.getHeight();
  for (let page = 1; page <= pages; page += 1) {
    doc.setPage(page);
    doc.setFontSize(7);
    doc.setTextColor(100, 105, 102);
    doc.text(`Página ${page} de ${pages}`, width - 14, height - 7, { align: "right" });
    doc.text("Ponto DCT — Documento administrativo", 14, height - 7);
  }
}

function addSignatures(doc: jsPDF, firstLabel: string, secondLabel: string, y: number) {
  const width = doc.internal.pageSize.getWidth();
  doc.setDrawColor(70, 75, 72);
  doc.line(30, y, 120, y);
  doc.line(width - 120, y, width - 30, y);
  doc.setFontSize(8);
  doc.setTextColor(60, 65, 62);
  doc.text(firstLabel, 75, y + 4, { align: "center" });
  doc.text(secondLabel, width - 75, y + 4, { align: "center" });
}

function lastTableY(doc: jsPDF) {
  return (doc as unknown as { lastAutoTable?: { finalY: number } }).lastAutoTable?.finalY ?? 50;
}

export async function exportGeneralPdf(
  reports: EmployeeAttendanceReport[],
  metadata: ReportMetadata,
  filename: string,
) {
  const doc = new jsPDF({ orientation: "landscape", unit: "mm", format: "a4" });
  const logos = await loadLogos();
  const totalMs = reports.reduce((total, item) => total + item.totalMs, 0);
  const pending = reports.reduce((total, item) => total + item.pendingCount, 0);
  addInstitutionalHeader(doc, "RELATÓRIO GERAL DE FREQUÊNCIA", metadata, logos);
  doc.setFontSize(9);
  doc.setTextColor(...COLORS.navy);
  doc.text(
    `Funcionários: ${reports.length}    Horas apuradas: ${formatDuration(totalMs)}    Pendências: ${pending}`,
    14,
    51,
  );
  autoTable(doc, {
    startY: 55,
    margin: { top: 49, right: 14, bottom: 14, left: 14 },
    head: [["Funcionário", "Equipe", "Dias registrados", "Horas apuradas", "Pendências"]],
    body: reports.map((item) => [
      item.name,
      item.team,
      String(item.daysRegistered),
      formatDuration(item.totalMs),
      String(item.pendingCount),
    ]),
    theme: "grid",
    styles: { fontSize: 8, cellPadding: 2.2, textColor: COLORS.navy },
    headStyles: { fillColor: COLORS.green, textColor: 255, fontStyle: "bold" },
    alternateRowStyles: { fillColor: COLORS.light },
    columnStyles: {
      0: { cellWidth: 85 },
      1: { cellWidth: 65 },
      2: { halign: "center" },
      3: { halign: "center" },
      4: { halign: "center" },
    },
    didDrawPage: ({ pageNumber }) => {
      if (pageNumber > 1)
        addInstitutionalHeader(doc, "RELATÓRIO GERAL DE FREQUÊNCIA", metadata, logos);
    },
  });
  let signatureY = lastTableY(doc) + 22;
  if (signatureY > 185) {
    doc.addPage();
    addInstitutionalHeader(doc, "RELATÓRIO GERAL DE FREQUÊNCIA", metadata, logos);
    signatureY = 95;
  }
  addSignatures(doc, "Responsável pelo DCT", "Recebido pela SEMEC", signatureY);
  addPageNumbers(doc);
  doc.save(filename);
}

function daySituation(day: AttendanceDay) {
  return day.status === "complete" ? "Completo" : day.issues.join("; ");
}

function extraIntervals(day: AttendanceDay) {
  return day.intervals
    .slice(2)
    .map((interval) => {
      const start = interval.checkin ? formatReportTime(interval.checkin.timestamp) : "—";
      const end = interval.checkout ? formatReportTime(interval.checkout.timestamp) : "—";
      return `${start}–${end}`;
    })
    .join(" | ");
}

export async function exportIndividualPdf(
  report: EmployeeAttendanceReport,
  metadata: ReportMetadata,
  filename: string,
) {
  const doc = new jsPDF({ orientation: "landscape", unit: "mm", format: "a4" });
  const logos = await loadLogos();
  addInstitutionalHeader(doc, "ESPELHO DE PONTO INDIVIDUAL", metadata, logos);
  doc.setFontSize(9);
  doc.setTextColor(...COLORS.navy);
  doc.text(`Funcionário: ${report.name} | Equipe: ${report.team}`, 14, 51);
  autoTable(doc, {
    startY: 55,
    margin: { top: 49, right: 10, bottom: 14, left: 10 },
    head: [
      [
        "Data",
        "Entrada 1",
        "Saída 1",
        "Entrada 2",
        "Saída 2",
        "Demais horários",
        "Total",
        "Situação",
      ],
    ],
    body: report.days.map((day) => [
      day.date.split("-").reverse().join("/"),
      day.intervals[0]?.checkin ? formatReportTime(day.intervals[0].checkin.timestamp) : "—",
      day.intervals[0]?.checkout ? formatReportTime(day.intervals[0].checkout.timestamp) : "—",
      day.intervals[1]?.checkin ? formatReportTime(day.intervals[1].checkin.timestamp) : "—",
      day.intervals[1]?.checkout ? formatReportTime(day.intervals[1].checkout.timestamp) : "—",
      extraIntervals(day) || "—",
      formatDuration(day.totalMs),
      daySituation(day),
    ]),
    theme: "grid",
    styles: { fontSize: 7.2, cellPadding: 1.8, textColor: COLORS.navy, overflow: "linebreak" },
    headStyles: { fillColor: COLORS.green, textColor: 255, fontStyle: "bold" },
    alternateRowStyles: { fillColor: COLORS.light },
    columnStyles: {
      0: { cellWidth: 22 },
      1: { cellWidth: 20, halign: "center" },
      2: { cellWidth: 20, halign: "center" },
      3: { cellWidth: 20, halign: "center" },
      4: { cellWidth: 20, halign: "center" },
      5: { cellWidth: 45 },
      6: { cellWidth: 20, halign: "center" },
    },
    didDrawPage: ({ pageNumber }) => {
      if (pageNumber > 1)
        addInstitutionalHeader(doc, "ESPELHO DE PONTO INDIVIDUAL", metadata, logos);
    },
  });
  let finalY = lastTableY(doc) + 8;
  doc.setFont("helvetica", "bold");
  doc.setFontSize(9);
  doc.text(`Total de horas apuradas: ${formatDuration(report.totalMs)}`, 14, finalY);
  finalY += 22;
  if (finalY > 185) {
    doc.addPage();
    addInstitutionalHeader(doc, "ESPELHO DE PONTO INDIVIDUAL", metadata, logos);
    finalY = 95;
  }
  addSignatures(doc, "Assinatura do Funcionário", "Assinatura do Responsável", finalY);
  addPageNumbers(doc);
  doc.save(filename);
}

const titleCell = (value: string, columns: number) => ({
  value,
  type: String,
  columnSpan: columns,
  align: "center" as const,
  fontSize: 14,
  fontWeight: "bold" as const,
  textColor: "#122F4C",
  height: 28,
});

const subtitleCell = (value: string, columns: number) => ({
  value,
  type: String,
  columnSpan: columns,
  align: "center" as const,
  textColor: "#46504B",
  height: 22,
});

const headerCell = (value: string) => ({
  value,
  type: String,
  align: "center" as const,
  alignVertical: "center" as const,
  fontWeight: "bold" as const,
  textColor: "#FFFFFF",
  backgroundColor: "#173F35",
  borderColor: "#D9E2DE",
  borderStyle: "thin" as const,
  height: 24,
});

const dataCell = (value: string | number, options: { format?: string; bold?: boolean } = {}) => ({
  value,
  type: typeof value === "number" ? Number : String,
  format: options.format,
  fontWeight: options.bold ? ("bold" as const) : undefined,
  borderColor: "#D9E2DE",
  borderStyle: "thin" as const,
  alignVertical: "center" as const,
  wrap: true,
});

type ExcelFileContent = File | Blob | ArrayBuffer;

function autoFilterFeature(
  reference: string,
): import("write-excel-file/browser").Feature<ExcelFileContent> {
  return {
    files: {
      transform: {
        "xl/worksheets/sheet{id}.xml": {
          transform: (content) =>
            content.replace("</sheetData>", `</sheetData><autoFilter ref="${reference}"/>`),
        },
      },
    },
  };
}

function excelColumnName(position: number) {
  let value = position;
  let result = "";
  while (value > 0) {
    value -= 1;
    result = String.fromCharCode(65 + (value % 26)) + result;
    value = Math.floor(value / 26);
  }
  return result;
}

export async function exportGeneralXlsx(
  reports: EmployeeAttendanceReport[],
  metadata: ReportMetadata,
  filename: string,
) {
  const { default: writeXlsxFile } = await import("write-excel-file/browser");
  const rows: import("write-excel-file/browser").SheetData = [
    [titleCell("RELATÓRIO GERAL DE FREQUÊNCIA — DCT / SEMEC", 5)],
    [
      subtitleCell(
        `Período: ${metadata.start} a ${metadata.end} | Equipe: ${metadata.team} | Emitido por: ${safeSpreadsheetText(metadata.generatedBy)}`,
        5,
      ),
    ],
    ["Funcionário", "Equipe", "Dias registrados", "Horas apuradas", "Pendências"].map(headerCell),
    ...reports.map((item) => [
      dataCell(safeSpreadsheetText(item.name)),
      dataCell(safeSpreadsheetText(item.team)),
      dataCell(item.daysRegistered),
      dataCell(item.totalMs / 86_400_000, { format: "[h]:mm" }),
      dataCell(item.pendingCount),
    ]),
    [
      dataCell("TOTAL", { bold: true }),
      dataCell("", { bold: true }),
      dataCell("", { bold: true }),
      dataCell(reports.reduce((total, item) => total + item.totalMs, 0) / 86_400_000, {
        format: "[h]:mm",
        bold: true,
      }),
      dataCell(
        reports.reduce((total, item) => total + item.pendingCount, 0),
        { bold: true },
      ),
    ],
  ];
  const file = writeXlsxFile(
    rows,
    {
      sheet: "Resumo Geral",
      orientation: "landscape",
      stickyRowsCount: 3,
      columns: [{ width: 34 }, { width: 24 }, { width: 18 }, { width: 18 }, { width: 14 }],
    },
    { features: [autoFilterFeature(`A3:E${Math.max(3, reports.length + 3)}`)] },
  );
  await file.toFile(filename);
}

export async function exportIndividualXlsx(
  report: EmployeeAttendanceReport,
  metadata: ReportMetadata,
  filename: string,
) {
  const { default: writeXlsxFile } = await import("write-excel-file/browser");
  const maxIntervals = Math.max(2, ...report.days.map((day) => day.intervals.length));
  const headers = ["Data"];
  for (let index = 1; index <= maxIntervals; index += 1)
    headers.push(`Entrada ${index}`, `Saída ${index}`);
  headers.push("Total", "Situação");
  const rows: import("write-excel-file/browser").SheetData = [
    [titleCell("ESPELHO DE PONTO INDIVIDUAL — DCT / SEMEC", headers.length)],
    [
      subtitleCell(
        `${safeSpreadsheetText(report.name)} | ${safeSpreadsheetText(report.team)} | ${metadata.start} a ${metadata.end} | Emitido por: ${safeSpreadsheetText(metadata.generatedBy)}`,
        headers.length,
      ),
    ],
    headers.map(headerCell),
  ];
  report.days.forEach((day) => {
    const values = [dataCell(day.date.split("-").reverse().join("/"))];
    for (let index = 0; index < maxIntervals; index += 1) {
      const interval = day.intervals[index];
      values.push(
        dataCell(interval?.checkin ? formatReportTime(interval.checkin.timestamp) : ""),
        dataCell(interval?.checkout ? formatReportTime(interval.checkout.timestamp) : ""),
      );
    }
    values.push(
      dataCell(day.totalMs / 86_400_000, { format: "[h]:mm" }),
      dataCell(safeSpreadsheetText(daySituation(day))),
    );
    rows.push(values);
  });
  rows.push([
    dataCell("TOTAL DE HORAS APURADAS", { bold: true }),
    ...Array(headers.length - 3).fill(null),
    dataCell(report.totalMs / 86_400_000, { format: "[h]:mm", bold: true }),
    dataCell("", { bold: true }),
  ]);
  const lastColumn = excelColumnName(headers.length);
  const file = writeXlsxFile(
    rows,
    {
      sheet: "Espelho de Ponto",
      orientation: "landscape",
      stickyRowsCount: 3,
      columns: headers.map((header) => ({ width: header === "Situação" ? 38 : 16 })),
    },
    {
      features: [autoFilterFeature(`A3:${lastColumn}${Math.max(3, report.days.length + 3)}`)],
    },
  );
  await file.toFile(filename);
}
