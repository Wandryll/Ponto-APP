import { createContext, useCallback, useContext, useEffect, useState, type ReactNode } from "react";
import { supabase } from "@/lib/supabaseClient";
import { useAuth } from "@/contexts/auth-context";
import type { CheckpointRecord } from "@/types";

interface RecordsContextValue {
  records: CheckpointRecord[];
  loading: boolean;
  refresh: () => Promise<void>;
  addRecord: (r: CheckpointRecord) => void;
}

const RecordsContext = createContext<RecordsContextValue | undefined>(undefined);

interface RecordRow {
  id: string;
  colaborador_id: string;
  tipo: string;
  data_hora: string;
  latitude: number;
  longitude: number;
  foto_path: string | null;
  colaboradores:
    { nome: string; avatar: string | null } | Array<{ nome: string; avatar: string | null }> | null;
}

export function RecordsProvider({ children }: { children: ReactNode }) {
  const { user } = useAuth();
  const [records, setRecords] = useState<CheckpointRecord[]>([]);
  const [loading, setLoading] = useState(false);

  const refresh = useCallback(async () => {
    if (!user) {
      setRecords([]);
      return;
    }
    setLoading(true);
    try {
      const rows: RecordRow[] = [];
      const pageSize = 1000;
      for (let from = 0; ; from += pageSize) {
        const { data, error } = await supabase
          .from("registros_acesso")
          .select(
            "id,colaborador_id,tipo,data_hora,latitude,longitude,foto_path,colaboradores(nome,avatar)",
          )
          .order("data_hora", { ascending: false })
          .range(from, from + pageSize - 1);
        if (error) throw error;
        const page = (data ?? []) as RecordRow[];
        rows.push(...page);
        if (page.length < pageSize) break;
      }
      setRecords(
        rows.map((row) => {
          const profile = Array.isArray(row.colaboradores)
            ? row.colaboradores[0]
            : row.colaboradores;
          return {
            id: row.id,
            userId: row.colaborador_id,
            userName: profile?.nome ?? "Usuário",
            userAvatar: profile?.avatar ?? "",
            type: row.tipo === "CHECKOUT" ? "checkout" : "checkin",
            timestamp: row.data_hora,
            latitude: row.latitude,
            longitude: row.longitude,
            address: `Lat. ${row.latitude.toFixed(5)}, Long. ${row.longitude.toFixed(5)}`,
            photo: row.foto_path ?? "",
            status: "on_time",
          } satisfies CheckpointRecord;
        }),
      );
    } catch (error) {
      console.error("Falha ao carregar registros:", error);
      setRecords([]);
    } finally {
      setLoading(false);
    }
  }, [user]);

  useEffect(() => {
    void refresh();
  }, [refresh]);

  const addRecord = (r: CheckpointRecord) => setRecords((prev) => [r, ...prev]);
  return (
    <RecordsContext.Provider value={{ records, loading, refresh, addRecord }}>
      {children}
    </RecordsContext.Provider>
  );
}

export function useRecords() {
  const ctx = useContext(RecordsContext);
  if (!ctx) throw new Error("useRecords must be used within RecordsProvider");
  return ctx;
}
