import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useMemo, useState } from "react";
import { Users, LogIn, LogOut, UserCheck, UserX } from "lucide-react";
import {
  Bar,
  BarChart,
  CartesianGrid,
  Line,
  LineChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
  Legend,
} from "recharts";

import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { StatCard } from "@/components/ui/stat-card";
import { useRecords } from "@/contexts/records-context";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { supabase } from "@/lib/supabaseClient";
import { calculateWorkedMilliseconds } from "@/lib/attendance";

export const Route = createFileRoute("/_app/dashboard")({
  head: () => ({ meta: [{ title: "Dashboard — ITM" }] }),
  component: DashboardPage,
});

function DashboardPage() {
  const { records } = useRecords();
  const [activeEmployees, setActiveEmployees] = useState(0);
  useEffect(() => {
    void supabase
      .from("colaboradores")
      .select("id", { count: "exact", head: true })
      .eq("ativo", true)
      .then(({ count }) => setActiveEmployees(count ?? 0));
  }, []);
  const today = new Date().toDateString();
  const todayRecords = records.filter((r) => new Date(r.timestamp).toDateString() === today);
  const checkins = todayRecords.filter((r) => r.type === "checkin");
  const checkouts = todayRecords.filter((r) => r.type === "checkout");
  const presentIds = new Set(checkins.map((r) => r.userId));
  const present = presentIds.size;
  const absent = Math.max(0, activeEmployees - present);
  const weeklyAttendance = useMemo(() => {
    const formatter = new Intl.DateTimeFormat("pt-BR", { weekday: "short" });
    return Array.from({ length: 7 }, (_, offset) => {
      const date = new Date();
      date.setHours(0, 0, 0, 0);
      date.setDate(date.getDate() - (6 - offset));
      const next = new Date(date);
      next.setDate(next.getDate() + 1);
      const presentes = new Set(
        records
          .filter(
            (r) =>
              r.type === "checkin" && new Date(r.timestamp) >= date && new Date(r.timestamp) < next,
          )
          .map((r) => r.userId),
      ).size;
      return {
        day: formatter.format(date).replace(".", ""),
        presentes,
        semRegistro: Math.max(0, activeEmployees - presentes),
      };
    });
  }, [records, activeEmployees]);
  const dailyHours = useMemo(
    () =>
      weeklyAttendance.map((item, index) => {
        const date = new Date();
        date.setHours(0, 0, 0, 0);
        date.setDate(date.getDate() - (6 - index));
        const next = new Date(date);
        next.setDate(next.getDate() + 1);
        const byUser = new Map<string, Date[]>();
        records
          .filter((r) => new Date(r.timestamp) >= date && new Date(r.timestamp) < next)
          .forEach((r) => {
            const values = byUser.get(r.userId) ?? [];
            values.push(new Date(r.timestamp));
            byUser.set(r.userId, values);
          });
        let milliseconds = 0;
        byUser.forEach((_values, userId) => {
          milliseconds += calculateWorkedMilliseconds(
            records.filter(
              (record) =>
                record.userId === userId &&
                new Date(record.timestamp) >= date &&
                new Date(record.timestamp) < next,
            ),
          );
        });
        return { day: item.day, horas: Number((milliseconds / 3_600_000).toFixed(1)) };
      }),
    [records, weeklyAttendance],
  );

  return (
    <div className="space-y-6 max-w-[1400px] mx-auto">
      <div>
        <h1 className="text-2xl sm:text-3xl font-bold tracking-tight">Visão geral</h1>
        <p className="text-muted-foreground text-sm mt-1">
          Acompanhe a presença da equipe e a produtividade em tempo real.
        </p>
      </div>

      <div className="grid grid-cols-2 lg:grid-cols-5 gap-4">
        <StatCard
          title="Funcionários ativos"
          value={activeEmployees}
          icon={Users}
          tone="primary"
          trend="Equipe completa"
        />
        <StatCard
          title="Check-ins hoje"
          value={checkins.length}
          icon={LogIn}
          tone="success"
          trend={`${activeEmployees ? Math.round((checkins.length / activeEmployees) * 100) : 0}% da equipe`}
        />
        <StatCard title="Check-outs hoje" value={checkouts.length} icon={LogOut} tone="default" />
        <StatCard title="Presentes" value={present} icon={UserCheck} tone="success" />
        <StatCard title="Sem check-in" value={absent} icon={UserX} tone="destructive" />
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        <Card>
          <CardHeader>
            <CardTitle>Frequência semanal</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="h-72">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={weeklyAttendance}>
                  <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="var(--border)" />
                  <XAxis dataKey="day" stroke="var(--muted-foreground)" fontSize={12} />
                  <YAxis stroke="var(--muted-foreground)" fontSize={12} />
                  <Tooltip
                    contentStyle={{
                      background: "var(--card)",
                      border: "1px solid var(--border)",
                      borderRadius: 8,
                    }}
                  />
                  <Legend />
                  <Bar dataKey="presentes" fill="var(--primary)" radius={[6, 6, 0, 0]} />
                  <Bar
                    dataKey="semRegistro"
                    name="Sem registro"
                    fill="var(--destructive)"
                    radius={[6, 6, 0, 0]}
                  />
                </BarChart>
              </ResponsiveContainer>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Horas trabalhadas por dia</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="h-72">
              <ResponsiveContainer width="100%" height="100%">
                <LineChart data={dailyHours}>
                  <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="var(--border)" />
                  <XAxis dataKey="day" stroke="var(--muted-foreground)" fontSize={12} />
                  <YAxis stroke="var(--muted-foreground)" fontSize={12} />
                  <Tooltip
                    contentStyle={{
                      background: "var(--card)",
                      border: "1px solid var(--border)",
                      borderRadius: 8,
                    }}
                  />
                  <Line
                    type="monotone"
                    dataKey="horas"
                    stroke="var(--primary)"
                    strokeWidth={3}
                    dot={{ r: 5, fill: "var(--primary)" }}
                    activeDot={{ r: 7 }}
                  />
                </LineChart>
              </ResponsiveContainer>
            </div>
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Atividade recente</CardTitle>
        </CardHeader>
        <CardContent className="divide-y divide-border">
          {records.slice(0, 6).map((r) => (
            <div key={r.id} className="flex items-center gap-4 py-3 first:pt-0 last:pb-0">
              <Avatar className="h-10 w-10 shrink-0">
                <AvatarImage src={r.userAvatar} />
                <AvatarFallback>{r.userName.slice(0, 2)}</AvatarFallback>
              </Avatar>
              <div className="flex-1 min-w-0">
                <p className="text-sm font-medium truncate">{r.userName}</p>
                <p className="text-xs text-muted-foreground truncate">{r.address}</p>
              </div>
              <Badge variant={r.type === "checkin" ? "default" : "secondary"}>
                {r.type === "checkin" ? "Check-in" : "Check-out"}
              </Badge>
              <span className="text-xs text-muted-foreground tabular-nums hidden sm:inline">
                {new Date(r.timestamp).toLocaleString("pt-BR", {
                  day: "2-digit",
                  month: "2-digit",
                  hour: "2-digit",
                  minute: "2-digit",
                })}
              </span>
            </div>
          ))}
        </CardContent>
      </Card>
    </div>
  );
}
