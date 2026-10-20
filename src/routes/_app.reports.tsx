import { createFileRoute, Navigate } from "@tanstack/react-router";
import { useEffect, useMemo, useState } from "react";
import {
  AlertTriangle,
  Clock3,
  FileDown,
  FileSpreadsheet,
  LoaderCircle,
  Users,
} from "lucide-react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { StatCard } from "@/components/ui/stat-card";
import { useAuth } from "@/contexts/auth-context";
import {
  addDays,
  buildEmployeeAttendanceReports,
  formatDuration,
  formatReportTime,
  limitAttendanceReportPeriod,
  monthPeriod,
  reportDateKey,
  type EmployeeAttendanceReport,
} from "@/lib/attendance-report";
import {
  exportGeneralPdf,
  exportGeneralXlsx,
  exportIndividualPdf,
  exportIndividualXlsx,
  type ReportMetadata,
} from "@/lib/report-export";
import { supabase } from "@/lib/supabaseClient";
import type { CheckpointRecord } from "@/types";

export const Route = createFileRoute("/_app/reports")({
  head: () => ({ meta: [{ title: "Relatórios — Ponto DCT" }] }),
  component: ReportsPage,
});

interface Employee {
  id: string;
  nome: string;
  equipe: string | null;
  ativo: boolean;
}

interface AdminReportRow {
  id: number;
  colaborador_id: string;
  colaborador_nome: string;
  colaborador_equipe: string;
  tipo: string;
  data_hora: string;
  latitude: number;
  longitude: number;
}

type ReportType = "general" | "individual";
type PeriodType = "weekly" | "biweekly" | "monthly" | "custom";
type ExportType = "pdf" | "xlsx";

function presetPeriod(type: Exclude<PeriodType, "custom">) {
  const today = reportDateKey(new Date());
  if (type === "weekly") return { start: addDays(today, -6), end: today };
  if (type === "biweekly") return { start: addDays(today, -14), end: today };
  return monthPeriod();
}

function fileSafeName(value: string) {
  return value
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-zA-Z0-9]+/g, "_")
    .replace(/^_|_$/g, "");
}

function ReportsPage() {
  const { user } = useAuth();
  const initialPeriod = useMemo(() => monthPeriod(), []);
  const [records, setRecords] = useState<CheckpointRecord[]>([]);
  const [loading, setLoading] = useState(true);
  const [exporting, setExporting] = useState<ExportType | null>(null);
  const [employees, setEmployees] = useState<Employee[]>([]);
  const [reportType, setReportType] = useState<ReportType>("general");
  const [periodType, setPeriodType] = useState<PeriodType>("monthly");
  const [employee, setEmployee] = useState("all");
  const [team, setTeam] = useState("all");
  const [start, setStart] = useState(initialPeriod.start);
  const [end, setEnd] = useState(initialPeriod.end);

  useEffect(() => {
    void supabase
      .from("colaboradores")
      .select("id,nome,equipe,ativo")
      .order("nome")
      .then(({ data, error }) => {
        if (error) toast.error("Não foi possível carregar os funcionários.");
        else setEmployees((data ?? []) as Employee[]);
      });
  }, []);

  useEffect(() => {
    if (user?.role !== "admin" || !start || !end || start > end) {
      setLoading(false);
      setRecords([]);
      return;
    }

    let cancelled = false;
    const fetchRecords = async () => {
      setLoading(true);
      try {
        const rows: AdminReportRow[] = [];
        const pageSize = 1000;
        const periodStart = `${addDays(start, -1)}T04:00:00.000Z`;
        const periodEnd = `${addDays(end, 2)}T04:00:00.000Z`;
        for (let offset = 0; ; offset += pageSize) {
          const { data, error } = await supabase.rpc("relatorio_registros_admin_periodo", {
            periodo_inicio: periodStart,
            periodo_fim: periodEnd,
            limite: pageSize,
            deslocamento: offset,
          });
          if (error) throw error;
          const page = (data ?? []) as AdminReportRow[];
          rows.push(...page);
          if (page.length < pageSize) break;
        }
        if (cancelled) return;
        setRecords(
          rows.map((row) => ({
            id: String(row.id),
            userId: row.colaborador_id,
            userName: row.colaborador_nome,
            userAvatar: "",
            type: row.tipo === "CHECKOUT" ? "checkout" : "checkin",
            timestamp: row.data_hora,
            latitude: Number(row.latitude),
            longitude: Number(row.longitude),
            address: "",
            photo: "",
            status: "on_time",
          })),
        );
      } catch (error) {
        console.error("Falha ao carregar registros administrativos:", error);
        if (!cancelled) {
          setRecords([]);
          toast.error("Não foi possível carregar os registros do período.");
        }
      } finally {
        if (!cancelled) setLoading(false);
      }
    };
    void fetchRecords();
    return () => {
      cancelled = true;
    };
  }, [end, start, user?.role]);

  const activeEmployees = useMemo(() => employees.filter((item) => item.ativo), [employees]);
  const teams = useMemo(
    () =>
      Array.from(new Set(activeEmployees.map((item) => item.equipe).filter(Boolean))) as string[],
    [activeEmployees],
  );
  const selectedEmployees = useMemo(
    () =>
      activeEmployees
        .filter((item) => employee === "all" || item.id === employee)
        .filter((item) => team === "all" || item.equipe === team)
        .map((item) => ({ id: item.id, name: item.nome, team: item.equipe ?? "Sem equipe" })),
    [activeEmployees, employee, team],
  );
  const reports = useMemo(
    () =>
      buildEmployeeAttendanceReports(selectedEmployees, records).map((report) =>
        limitAttendanceReportPeriod(report, start, end),
      ),
    [end, records, selectedEmployees, start],
  );
  const individualReport = employee === "all" ? null : (reports[0] ?? null);
  const totals = useMemo(
    () => ({
      employees: reports.length,
      totalMs: reports.reduce((total, report) => total + report.totalMs, 0),
      pending: reports.reduce((total, report) => total + report.pendingCount, 0),
    }),
    [reports],
  );
  const selectedTeam = team === "all" ? "Todas" : team;
  const metadata: ReportMetadata = {
    start,
    end,
    generatedBy: user?.name ?? "Administrador",
    team: selectedTeam,
  };

  const handlePeriodChange = (value: PeriodType) => {
    setPeriodType(value);
    if (value !== "custom") {
      const period = presetPeriod(value);
      setStart(period.start);
      setEnd(period.end);
    }
  };

  const changeCustomDate = (setter: (value: string) => void, value: string) => {
    setPeriodType("custom");
    setter(value);
  };

  const ensureExportData = () => {
    if (loading) {
      toast.info("Aguarde o carregamento dos registros.");
      return false;
    }
    if (!start || !end || start > end) {
      toast.error("Informe um período válido.");
      return false;
    }
    if (reportType === "individual" && !individualReport) {
      toast.info("Selecione um funcionário para gerar o espelho de ponto.");
      return false;
    }
    if (!reports.length) {
      toast.info("Não há funcionários para os filtros selecionados.");
      return false;
    }
    return true;
  };

  const handleExport = async (format: ExportType) => {
    if (!ensureExportData()) return;
    setExporting(format);
    try {
      const reference = `${start.slice(0, 7)}_${end.slice(0, 7)}`;
      if (reportType === "general") {
        const filename = `Relatorio_Geral_DCT_${reference}.${format === "pdf" ? "pdf" : "xlsx"}`;
        if (format === "pdf") await exportGeneralPdf(reports, metadata, filename);
        else await exportGeneralXlsx(reports, metadata, filename);
      } else if (individualReport) {
        const name = fileSafeName(individualReport.name);
        const filename = `Espelho_Ponto_${name}_${reference}.${format === "pdf" ? "pdf" : "xlsx"}`;
        if (format === "pdf") await exportIndividualPdf(individualReport, metadata, filename);
        else await exportIndividualXlsx(individualReport, metadata, filename);
      }
      toast.success(`${format === "pdf" ? "PDF" : "Planilha"} gerado com sucesso.`);
    } catch (error) {
      console.error("Falha ao exportar relatório:", error);
      toast.error("Não foi possível gerar o arquivo.");
    } finally {
      setExporting(null);
    }
  };

  if (user?.role !== "admin") return <Navigate to="/checkpoint" />;

  return (
    <div className="space-y-6 max-w-[1400px] mx-auto">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <h1 className="text-2xl sm:text-3xl font-bold tracking-tight">Relatórios</h1>
          <p className="text-muted-foreground text-sm mt-1">
            Relatórios institucionais de frequência do DCT para a SEMEC.
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
          <Button
            variant="outline"
            className="gap-2"
            disabled={exporting !== null}
            onClick={() => void handleExport("pdf")}
          >
            {exporting === "pdf" ? (
              <LoaderCircle className="h-4 w-4 animate-spin" />
            ) : (
              <FileDown className="h-4 w-4" />
            )}
            Exportar PDF
          </Button>
          <Button
            variant="outline"
            className="gap-2"
            disabled={exporting !== null}
            onClick={() => void handleExport("xlsx")}
          >
            {exporting === "xlsx" ? (
              <LoaderCircle className="h-4 w-4 animate-spin" />
            ) : (
              <FileSpreadsheet className="h-4 w-4" />
            )}
            Exportar Excel
          </Button>
        </div>
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">Filtros do relatório</CardTitle>
        </CardHeader>
        <CardContent className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3">
          <div className="space-y-1.5">
            <Label className="text-xs">Tipo de relatório</Label>
            <Select
              value={reportType}
              onValueChange={(value) => setReportType(value as ReportType)}
            >
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="general">Relatório Geral — SEMEC</SelectItem>
                <SelectItem value="individual">Espelho de Ponto Individual</SelectItem>
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-1.5">
            <Label className="text-xs">Período</Label>
            <Select
              value={periodType}
              onValueChange={(value) => handlePeriodChange(value as PeriodType)}
            >
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="weekly">Semanal — últimos 7 dias</SelectItem>
                <SelectItem value="biweekly">Quinzenal — últimos 15 dias</SelectItem>
                <SelectItem value="monthly">Mensal — mês atual</SelectItem>
                <SelectItem value="custom">Personalizado</SelectItem>
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-1.5">
            <Label className="text-xs">Funcionário</Label>
            <Select value={employee} onValueChange={setEmployee}>
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all" disabled={reportType === "individual"}>
                  {reportType === "general" ? "Todos" : "Selecione um funcionário"}
                </SelectItem>
                {activeEmployees.map((item) => (
                  <SelectItem key={item.id} value={item.id}>
                    {item.nome}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-1.5">
            <Label className="text-xs">Equipe</Label>
            <Select value={team} onValueChange={setTeam}>
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Todas</SelectItem>
                {teams.map((item) => (
                  <SelectItem key={item} value={item}>
                    {item}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-1.5">
            <Label className="text-xs">Data inicial</Label>
            <Input
              type="date"
              value={start}
              onChange={(event) => changeCustomDate(setStart, event.target.value)}
            />
          </div>
          <div className="space-y-1.5">
            <Label className="text-xs">Data final</Label>
            <Input
              type="date"
              value={end}
              onChange={(event) => changeCustomDate(setEnd, event.target.value)}
            />
          </div>
        </CardContent>
      </Card>

      {reportType === "general" ? (
        <GeneralPreview reports={reports} totals={totals} loading={loading} />
      ) : (
        <IndividualPreview report={individualReport} loading={loading} />
      )}
    </div>
  );
}

function GeneralPreview({
  reports,
  totals,
  loading,
}: {
  reports: EmployeeAttendanceReport[];
  totals: { employees: number; totalMs: number; pending: number };
  loading: boolean;
}) {
  return (
    <div className="space-y-4">
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
        <StatCard
          title="Funcionários"
          value={loading ? "—" : totals.employees}
          icon={Users}
          tone="primary"
        />
        <StatCard
          title="Horas apuradas"
          value={loading ? "—" : formatDuration(totals.totalMs)}
          icon={Clock3}
          tone="success"
        />
        <StatCard
          title="Pendências"
          value={loading ? "—" : totals.pending}
          icon={AlertTriangle}
          tone={totals.pending ? "warning" : "success"}
        />
      </div>
      <Card>
        <CardHeader>
          <CardTitle className="text-base">Prévia do Relatório Geral</CardTitle>
        </CardHeader>
        <CardContent className="overflow-x-auto">
          <table className="w-full min-w-[680px] text-sm">
            <thead>
              <tr className="border-b text-left text-muted-foreground">
                <th className="py-3 pr-4">Funcionário</th>
                <th className="py-3 pr-4">Equipe</th>
                <th className="py-3 pr-4 text-center">Dias registrados</th>
                <th className="py-3 pr-4 text-center">Horas apuradas</th>
                <th className="py-3 text-center">Pendências</th>
              </tr>
            </thead>
            <tbody>
              {reports.map((report) => (
                <tr key={report.id} className="border-b last:border-0">
                  <td className="py-3 pr-4 font-medium">{report.name}</td>
                  <td className="py-3 pr-4">{report.team}</td>
                  <td className="py-3 pr-4 text-center">{report.daysRegistered}</td>
                  <td className="py-3 pr-4 text-center">{formatDuration(report.totalMs)}</td>
                  <td className="py-3 text-center">{report.pendingCount}</td>
                </tr>
              ))}
            </tbody>
          </table>
          {!loading && !reports.length && (
            <p className="py-12 text-center text-sm text-muted-foreground">
              Nenhum funcionário encontrado para os filtros selecionados.
            </p>
          )}
        </CardContent>
      </Card>
    </div>
  );
}

function IndividualPreview({
  report,
  loading,
}: {
  report: EmployeeAttendanceReport | null;
  loading: boolean;
}) {
  if (!report)
    return (
      <Card>
        <CardContent className="py-16 text-center text-sm text-muted-foreground">
          Selecione um funcionário para visualizar o espelho de ponto.
        </CardContent>
      </Card>
    );
  return (
    <div className="space-y-4">
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
        <StatCard
          title="Dias registrados"
          value={loading ? "—" : report.daysRegistered}
          icon={Users}
          tone="primary"
        />
        <StatCard
          title="Horas apuradas"
          value={loading ? "—" : formatDuration(report.totalMs)}
          icon={Clock3}
          tone="success"
        />
        <StatCard
          title="Pendências"
          value={loading ? "—" : report.pendingCount}
          icon={AlertTriangle}
          tone={report.pendingCount ? "warning" : "success"}
        />
      </div>
      <Card>
        <CardHeader>
          <CardTitle className="text-base">Espelho de {report.name}</CardTitle>
        </CardHeader>
        <CardContent className="overflow-x-auto">
          <table className="w-full min-w-[820px] text-sm">
            <thead>
              <tr className="border-b text-left text-muted-foreground">
                <th className="py-3 pr-3">Data</th>
                <th className="py-3 pr-3">Entrada 1</th>
                <th className="py-3 pr-3">Saída 1</th>
                <th className="py-3 pr-3">Entrada 2</th>
                <th className="py-3 pr-3">Saída 2</th>
                <th className="py-3 pr-3">Demais horários</th>
                <th className="py-3 pr-3">Total</th>
                <th className="py-3">Situação</th>
              </tr>
            </thead>
            <tbody>
              {report.days.map((day) => {
                const extra = day.intervals
                  .slice(2)
                  .map(
                    (interval) =>
                      `${interval.checkin ? formatReportTime(interval.checkin.timestamp) : "—"}–${interval.checkout ? formatReportTime(interval.checkout.timestamp) : "—"}`,
                  )
                  .join(" | ");
                return (
                  <tr key={day.date} className="border-b last:border-0">
                    <td className="py-3 pr-3 font-medium">
                      {day.date.split("-").reverse().join("/")}
                    </td>
                    <td className="py-3 pr-3">
                      {day.intervals[0]?.checkin
                        ? formatReportTime(day.intervals[0].checkin.timestamp)
                        : "—"}
                    </td>
                    <td className="py-3 pr-3">
                      {day.intervals[0]?.checkout
                        ? formatReportTime(day.intervals[0].checkout.timestamp)
                        : "—"}
                    </td>
                    <td className="py-3 pr-3">
                      {day.intervals[1]?.checkin
                        ? formatReportTime(day.intervals[1].checkin.timestamp)
                        : "—"}
                    </td>
                    <td className="py-3 pr-3">
                      {day.intervals[1]?.checkout
                        ? formatReportTime(day.intervals[1].checkout.timestamp)
                        : "—"}
                    </td>
                    <td className="py-3 pr-3">{extra || "—"}</td>
                    <td className="py-3 pr-3 font-medium">{formatDuration(day.totalMs)}</td>
                    <td className="py-3">
                      {day.status === "complete" ? "Completo" : day.issues.join("; ")}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
          {!loading && !report.days.length && (
            <p className="py-12 text-center text-sm text-muted-foreground">
              Nenhum registro encontrado no período selecionado.
            </p>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
