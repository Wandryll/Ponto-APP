import { createFileRoute, Navigate } from "@tanstack/react-router";
import { useEffect, useMemo, useState } from "react";
import { BarChart3, FileDown, FileSpreadsheet } from "lucide-react";
import { toast } from "sonner";
import { Bar, BarChart, CartesianGrid, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";

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
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { useAuth } from "@/contexts/auth-context";
import { supabase } from "@/lib/supabaseClient";
import { calculateWorkedMilliseconds } from "@/lib/attendance";
import type { CheckpointRecord } from "@/types";
import {
  downloadAttendanceCsv,
  printAttendanceReport,
  type AttendanceExportRow,
} from "@/lib/report-export";

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

const dateKey = (value: Date | string) => {
  const date = value instanceof Date ? value : new Date(value);
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}-${String(date.getDate()).padStart(2, "0")}`;
};

function ReportsPage() {
  const { user } = useAuth();
  const [records, setRecords] = useState<CheckpointRecord[]>([]);
  const [loading, setLoading] = useState(true);
  const [employees, setEmployees] = useState<Employee[]>([]);
  const [employee, setEmployee] = useState("all");
  const [team, setTeam] = useState("all");
  const [start, setStart] = useState("");
  const [end, setEnd] = useState("");

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
    if (user?.role !== "admin") {
      setLoading(false);
      return;
    }

    const fetchAllRecords = async () => {
      setLoading(true);
      try {
        const rows: AdminReportRow[] = [];
        const pageSize = 1000;
        for (let offset = 0; ; offset += pageSize) {
          const { data, error } = await supabase.rpc("relatorio_registros_admin", {
            limite: pageSize,
            deslocamento: offset,
          });
          if (error) throw error;
          const page = (data ?? []) as AdminReportRow[];
          rows.push(...page);
          if (page.length < pageSize) break;
        }

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
            address: `Lat. ${Number(row.latitude).toFixed(5)}, Long. ${Number(row.longitude).toFixed(5)}`,
            photo: "",
            status: "on_time",
          })),
        );
      } catch (error) {
        console.error("Falha ao carregar registros administrativos:", error);
        setRecords([]);
        toast.error("Não foi possível carregar os registros de toda a equipe.");
      } finally {
        setLoading(false);
      }
    };

    void fetchAllRecords();
  }, [user?.role]);

  const teams = useMemo(
    () => Array.from(new Set(employees.map((item) => item.equipe).filter(Boolean))) as string[],
    [employees],
  );
  const eligibleIds = useMemo(
    () =>
      new Set(
        employees
          .filter((item) => employee === "all" || item.id === employee)
          .filter((item) => team === "all" || item.equipe === team)
          .map((item) => item.id),
      ),
    [employees, employee, team],
  );
  const filtered = useMemo(
    () =>
      records.filter((record) => {
        const key = dateKey(record.timestamp);
        return eligibleIds.has(record.userId) && (!start || key >= start) && (!end || key <= end);
      }),
    [records, eligibleIds, start, end],
  );

  const metrics = useMemo(() => {
    const grouped = new Map<string, typeof filtered>();
    filtered.forEach((record) => {
      const key = `${record.userId}:${dateKey(record.timestamp)}`;
      grouped.set(key, [...(grouped.get(key) ?? []), record]);
    });

    let totalMs = 0;
    let late = 0;
    const hoursByDay = new Map<string, number>();
    grouped.forEach((items) => {
      const sorted = [...items].sort(
        (a, b) => new Date(a.timestamp).getTime() - new Date(b.timestamp).getTime(),
      );
      const firstCheckin = sorted.find((item) => item.type === "checkin");
      if (firstCheckin) {
        const time = new Date(firstCheckin.timestamp);
        if (time.getHours() > 9 || (time.getHours() === 9 && time.getMinutes() > 0)) late += 1;
      }
      const duration = calculateWorkedMilliseconds(sorted);
      totalMs += duration;
      const key = dateKey(sorted[0].timestamp);
      hoursByDay.set(key, (hoursByDay.get(key) ?? 0) + duration / 3_600_000);
    });

    const totalHours = totalMs / 3_600_000;
    const workdays = grouped.size;
    const daysWorked = new Set(filtered.map((record) => dateKey(record.timestamp))).size;
    const chart = Array.from(hoursByDay.entries())
      .sort(([a], [b]) => a.localeCompare(b))
      .map(([day, horas]) => ({
        day: day.slice(5).split("-").reverse().join("/"),
        horas: Number(horas.toFixed(2)),
      }));
    return {
      daysWorked,
      late,
      totalHours,
      average: workdays ? totalHours / workdays : 0,
      overtime: Math.max(0, totalHours - workdays * 8),
      chart,
    };
  }, [filtered]);

  const exportRows = useMemo<AttendanceExportRow[]>(() => {
    const employeeById = new Map(employees.map((item) => [item.id, item]));
    return [...filtered]
      .sort((a, b) => new Date(a.timestamp).getTime() - new Date(b.timestamp).getTime())
      .map((record) => ({
        employee: employeeById.get(record.userId)?.nome ?? record.userName,
        team: employeeById.get(record.userId)?.equipe ?? "Sem equipe",
        type: record.type,
        timestamp: record.timestamp,
        latitude: record.latitude,
        longitude: record.longitude,
      }));
  }, [employees, filtered]);

  const exportFilename = `registros-ponto-${start || "inicio"}-${end || dateKey(new Date())}`;
  const selectedEmployee = employees.find((item) => item.id === employee)?.nome ?? "Todos";
  const selectedTeam = team === "all" ? "Todas" : team;
  const period = `${start || "Início"} até ${end || dateKey(new Date())}`;

  const ensureExportData = () => {
    if (loading) {
      toast.info("Aguarde o carregamento dos registros.");
      return false;
    }
    if (!exportRows.length) {
      toast.info("Não há registros para os filtros selecionados.");
      return false;
    }
    if (start && end && start > end) {
      toast.error("A data inicial deve ser anterior à data final.");
      return false;
    }
    return true;
  };

  const handleExcelExport = () => {
    if (!ensureExportData()) return;
    downloadAttendanceCsv(exportRows, `${exportFilename}.csv`);
    toast.success("Planilha exportada com sucesso.");
  };

  const handlePdfExport = () => {
    if (!ensureExportData()) return;
    const opened = printAttendanceReport(exportRows, {
      period,
      employee: selectedEmployee,
      team: selectedTeam,
      generatedBy: user?.name ?? "Administrador",
      daysWorked: employee === "all" ? null : metrics.daysWorked,
      late: metrics.late,
      totalHours: metrics.totalHours,
      averageHours: metrics.average,
      overtimeHours: metrics.overtime,
    });
    if (!opened) toast.error("Permita pop-ups para gerar o relatório em PDF.");
  };

  if (user?.role !== "admin") return <Navigate to="/dashboard" />;

  return (
    <div className="space-y-6 max-w-[1400px] mx-auto">
      <div className="flex flex-col sm:flex-row sm:items-end sm:justify-between gap-4">
        <div>
          <h1 className="text-2xl sm:text-3xl font-bold tracking-tight">Relatórios</h1>
          <p className="text-muted-foreground text-sm mt-1">
            Análise baseada nos registros salvos no Supabase.
          </p>
        </div>
        <div className="flex gap-2">
          <Button variant="outline" className="gap-2" onClick={handlePdfExport}>
            <FileDown className="h-4 w-4" /> PDF
          </Button>
          <Button variant="outline" className="gap-2" onClick={handleExcelExport}>
            <FileSpreadsheet className="h-4 w-4" /> Excel
          </Button>
        </div>
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">Filtros</CardTitle>
        </CardHeader>
        <CardContent className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
          <div className="space-y-1.5">
            <Label className="text-xs">Funcionário</Label>
            <Select value={employee} onValueChange={setEmployee}>
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Todos</SelectItem>
                {employees.map((item) => (
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
            <Input type="date" value={start} onChange={(event) => setStart(event.target.value)} />
          </div>
          <div className="space-y-1.5">
            <Label className="text-xs">Data final</Label>
            <Input type="date" value={end} onChange={(event) => setEnd(event.target.value)} />
          </div>
        </CardContent>
      </Card>

      <Tabs defaultValue="attendance">
        <TabsList>
          <TabsTrigger value="attendance">Presença</TabsTrigger>
          <TabsTrigger value="hours">Horas trabalhadas</TabsTrigger>
        </TabsList>
        <TabsContent value="attendance" className="space-y-4 mt-4">
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
            <StatCard
              title="Dias trabalhados"
              value={loading || employee === "all" ? "—" : metrics.daysWorked}
              icon={BarChart3}
              tone="success"
              trend={employee === "all" ? "Selecione um funcionário" : undefined}
            />
            <StatCard
              title="Faltas"
              value={0}
              icon={BarChart3}
              tone="destructive"
              trend="Requer escala de trabalho"
            />
            <StatCard
              title="Atrasos"
              value={loading ? "—" : metrics.late}
              icon={BarChart3}
              tone="warning"
              trend="Após 09:00"
            />
          </div>
        </TabsContent>
        <TabsContent value="hours" className="space-y-4 mt-4">
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
            <StatCard
              title="Horas totais"
              value={`${metrics.totalHours.toFixed(1)}h`}
              icon={BarChart3}
              tone="primary"
            />
            <StatCard
              title="Média por dia"
              value={`${metrics.average.toFixed(1)}h`}
              icon={BarChart3}
              tone="success"
            />
            <StatCard
              title="Horas extras"
              value={`${metrics.overtime.toFixed(1)}h`}
              icon={BarChart3}
              tone="warning"
            />
          </div>
          <Card>
            <CardHeader>
              <CardTitle>Horas por dia</CardTitle>
            </CardHeader>
            <CardContent>
              {metrics.chart.length ? (
                <div className="h-72">
                  <ResponsiveContainer width="100%" height="100%">
                    <BarChart data={metrics.chart}>
                      <CartesianGrid
                        strokeDasharray="3 3"
                        vertical={false}
                        stroke="var(--border)"
                      />
                      <XAxis dataKey="day" stroke="var(--muted-foreground)" fontSize={12} />
                      <YAxis stroke="var(--muted-foreground)" fontSize={12} />
                      <Tooltip
                        contentStyle={{
                          background: "var(--card)",
                          border: "1px solid var(--border)",
                          borderRadius: 8,
                        }}
                      />
                      <Bar dataKey="horas" fill="var(--primary)" radius={[6, 6, 0, 0]} />
                    </BarChart>
                  </ResponsiveContainer>
                </div>
              ) : (
                <div className="py-16 text-center text-sm text-muted-foreground">
                  Nenhum registro encontrado para os filtros selecionados.
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
}
