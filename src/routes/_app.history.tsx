import { createFileRoute } from "@tanstack/react-router";
import { useCallback, useMemo, useState, useEffect } from "react";
import { Search, Filter, Eye, Loader2 } from "lucide-react";

import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";

import { LocationMap } from "@/components/maps/location-map";
import { useAuth } from "@/contexts/auth-context";
import { supabase } from "@/lib/supabaseClient";

export const Route = createFileRoute("/_app/history")({
  head: () => ({ meta: [{ title: "Histórico — Ponto DCT" }] }),
  component: HistoryPage,
});

const PAGE_SIZE = 8;

interface RegistroReal {
  id: string;
  colaborador_id: string;
  tipo: string;
  data_hora: string;
  latitude: number;
  longitude: number;
  foto_path: string;
  colaboradores: {
    nome: string;
    avatar: string;
  };
}

interface RegistroSupabase {
  id: string;
  colaborador_id: string;
  tipo: string;
  data_hora: string;
  latitude: number;
  longitude: number;
  foto_path: string | null;
  colaboradores: Array<{
    nome: string;
    avatar: string | null;
  }> | null;
}

const normalizeRegistros = (rows: RegistroSupabase[] | null): RegistroReal[] =>
  (rows ?? []).map((row) => ({
    ...row,
    foto_path: row.foto_path ?? "",
    colaboradores: row.colaboradores?.[0]
      ? {
          nome: row.colaboradores[0].nome,
          avatar: row.colaboradores[0].avatar ?? "",
        }
      : {
          nome: "",
          avatar: "",
        },
  }));

function PrivatePhoto({ path, className }: { path: string; className: string }) {
  const [url, setUrl] = useState("");

  useEffect(() => {
    let objectUrl = "";
    let cancelled = false;
    if (!path) return;
    void supabase.storage
      .from("fotos_ponto")
      .download(path)
      .then(({ data, error }) => {
        if (!cancelled && !error && data) {
          objectUrl = URL.createObjectURL(data);
          setUrl(objectUrl);
        }
      });
    return () => {
      cancelled = true;
      if (objectUrl) URL.revokeObjectURL(objectUrl);
    };
  }, [path]);

  return url ? <img src={url} alt="Foto do registro" className={className} /> : null;
}

function HistoryPage() {
  const { user } = useAuth();

  const [registros, setRegistros] = useState<RegistroReal[]>([]);
  const [equipeLista, setEquipeLista] = useState<{ id: string; nome: string }[]>([]);
  const [loading, setLoading] = useState(true);

  const [start, setStart] = useState("");
  const [end, setEnd] = useState("");
  const [employee, setEmployee] = useState("all");
  const [type, setType] = useState("all");
  const [sortDesc, setSortDesc] = useState(true);
  const [page, setPage] = useState(1);
  const [selected, setSelected] = useState<RegistroReal | null>(null);

  const fetchData = useCallback(async () => {
    if (!user) return;
    setLoading(true);

    try {
      const registrosData: RegistroSupabase[] = [];
      const pageSize = 1000;
      for (let from = 0; ; from += pageSize) {
        const { data, error } = await supabase
          .from("registros_acesso")
          .select(
            `
          id, colaborador_id, tipo, data_hora, latitude, longitude, foto_path,
          colaboradores ( nome, avatar )
        `,
          )
          .order("data_hora", { ascending: false })
          .range(from, from + pageSize - 1)
          .returns<RegistroSupabase[]>();
        if (error) throw error;
        const rows = data ?? [];
        registrosData.push(...rows);
        if (rows.length < pageSize) break;
      }
      setRegistros(normalizeRegistros(registrosData));

      if (user.role === "admin") {
        const { data: equipeData } = await supabase
          .from("colaboradores")
          .select("id, nome")
          .order("nome");

        if (equipeData) setEquipeLista(equipeData);
      }
    } catch (error) {
      console.error("Erro ao carregar histórico:", error);
    } finally {
      setLoading(false);
    }
  }, [user]);

  useEffect(() => {
    void fetchData();
  }, [fetchData]);

  const filtered = useMemo(() => {
    let data = registros;

    if (user?.role === "employee") {
      data = data.filter((r) => r.colaborador_id === user.id);
    }

    if (employee !== "all") {
      data = data.filter((r) => r.colaborador_id === employee);
    }

    if (type !== "all") {
      const tipoBanco = type.toUpperCase();
      data = data.filter((r) => r.tipo === tipoBanco);
    }

    if (start) data = data.filter((r) => new Date(r.data_hora) >= new Date(start));
    if (end) data = data.filter((r) => new Date(r.data_hora) <= new Date(end + "T23:59:59"));

    data = [...data].sort((a, b) => {
      const at = new Date(a.data_hora).getTime();
      const bt = new Date(b.data_hora).getTime();
      return sortDesc ? bt - at : at - bt;
    });

    return data;
  }, [registros, user, employee, type, start, end, sortDesc]);

  const totalPages = Math.max(1, Math.ceil(filtered.length / PAGE_SIZE));
  const pageData = filtered.slice((page - 1) * PAGE_SIZE, page * PAGE_SIZE);

  useEffect(() => {
    setPage(1);
  }, [employee, type, start, end]);

  useEffect(() => {
    if (page > totalPages) setPage(totalPages);
  }, [page, totalPages]);

  return (
    <div className="space-y-6 max-w-[1400px] mx-auto">
      <div>
        <h1 className="text-2xl sm:text-3xl font-bold tracking-tight">Histórico de registros</h1>
        <p className="text-muted-foreground text-sm mt-1">
          Visualize, filtre e ordene todos os registros de ponto.
        </p>
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-base">
            <Filter className="h-4 w-4 text-primary" /> Filtros
          </CardTitle>
        </CardHeader>
        <CardContent className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
          <div className="space-y-1.5">
            <Label className="text-xs">Data inicial</Label>
            <Input type="date" value={start} onChange={(e) => setStart(e.target.value)} />
          </div>
          <div className="space-y-1.5">
            <Label className="text-xs">Data final</Label>
            <Input type="date" value={end} onChange={(e) => setEnd(e.target.value)} />
          </div>
          {user?.role === "admin" && (
            <div className="space-y-1.5">
              <Label className="text-xs">Funcionário</Label>
              <Select value={employee} onValueChange={setEmployee}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">Todos</SelectItem>
                  {equipeLista.map((u) => (
                    <SelectItem key={u.id} value={u.id}>
                      {u.nome}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          )}
          <div className="space-y-1.5">
            <Label className="text-xs">Tipo</Label>
            <Select value={type} onValueChange={setType}>
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Todos</SelectItem>
                <SelectItem value="checkin">Check-in</SelectItem>
                <SelectItem value="checkout">Check-out</SelectItem>
              </SelectContent>
            </Select>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardContent className="p-0">
          {loading ? (
            <div className="p-12 text-center flex justify-center">
              <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
            </div>
          ) : filtered.length === 0 ? (
            <div className="p-12 text-center">
              <Search className="h-10 w-10 text-muted-foreground mx-auto mb-3" />
              <p className="text-sm text-muted-foreground">Nenhum registro encontrado.</p>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Funcionário</TableHead>
                    <TableHead
                      className="cursor-pointer select-none"
                      onClick={() => setSortDesc((s) => !s)}
                    >
                      Data / Hora {sortDesc ? "↓" : "↑"}
                    </TableHead>
                    <TableHead>Tipo</TableHead>
                    <TableHead className="hidden md:table-cell">Localização</TableHead>
                    <TableHead className="hidden lg:table-cell">Foto</TableHead>
                    <TableHead className="text-right">Ações</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {pageData.map((r) => (
                    <TableRow key={r.id} className="cursor-pointer" onClick={() => setSelected(r)}>
                      <TableCell>
                        <div className="flex items-center gap-3">
                          <Avatar className="h-8 w-8">
                            <AvatarImage src={r.colaboradores.avatar} />
                            <AvatarFallback>{r.colaboradores?.nome?.slice(0, 2)}</AvatarFallback>
                          </Avatar>
                          <span className="font-medium text-sm truncate">
                            {r.colaboradores?.nome}
                          </span>
                        </div>
                      </TableCell>
                      <TableCell className="text-sm tabular-nums">
                        {new Date(r.data_hora).toLocaleString("pt-BR", {
                          day: "2-digit",
                          month: "2-digit",
                          year: "numeric",
                          hour: "2-digit",
                          minute: "2-digit",
                        })}
                      </TableCell>
                      <TableCell>
                        <Badge variant={r.tipo === "CHECKIN" ? "default" : "secondary"}>
                          {r.tipo === "CHECKIN" ? "Check-in" : "Check-out"}
                        </Badge>
                      </TableCell>
                      <TableCell className="hidden md:table-cell max-w-[260px]">
                        <span className="text-xs text-muted-foreground truncate block">
                          Lat: {r.latitude.toFixed(4)}, Lng: {r.longitude.toFixed(4)}
                        </span>
                      </TableCell>
                      <TableCell className="hidden lg:table-cell">
                        <PrivatePhoto
                          path={r.foto_path}
                          className="h-10 w-10 rounded-md object-cover border border-border bg-muted"
                        />
                      </TableCell>
                      <TableCell className="text-right">
                        <Button
                          variant="ghost"
                          size="icon"
                          onClick={(e) => {
                            e.stopPropagation();
                            setSelected(r);
                          }}
                        >
                          <Eye className="h-4 w-4" />
                        </Button>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          )}

          {filtered.length > 0 && !loading && (
            <div className="flex items-center justify-between border-t border-border px-4 py-3">
              <p className="text-xs text-muted-foreground">
                Exibindo {(page - 1) * PAGE_SIZE + 1}–{Math.min(page * PAGE_SIZE, filtered.length)}{" "}
                de {filtered.length}
              </p>
              <div className="flex gap-2">
                <Button
                  variant="outline"
                  size="sm"
                  disabled={page === 1}
                  onClick={() => setPage((p) => p - 1)}
                >
                  Anterior
                </Button>
                <Button
                  variant="outline"
                  size="sm"
                  disabled={page === totalPages}
                  onClick={() => setPage((p) => p + 1)}
                >
                  Próxima
                </Button>
              </div>
            </div>
          )}
        </CardContent>
      </Card>

      <Dialog open={!!selected} onOpenChange={(o) => !o && setSelected(null)}>
        <DialogContent className="max-w-2xl">
          <DialogHeader>
            <DialogTitle>Detalhes do registro</DialogTitle>
          </DialogHeader>
          {selected && (
            <div className="space-y-4">
              <div className="flex items-center gap-3">
                <Avatar className="h-12 w-12">
                  <AvatarImage src={selected.colaboradores.avatar} />
                  <AvatarFallback>{selected.colaboradores?.nome?.slice(0, 2)}</AvatarFallback>
                </Avatar>
                <div>
                  <div className="font-semibold">{selected.colaboradores?.nome}</div>
                  <div className="text-xs text-muted-foreground">
                    {new Date(selected.data_hora).toLocaleString("pt-BR")}
                  </div>
                </div>
                <Badge
                  className="ml-auto"
                  variant={selected.tipo === "CHECKIN" ? "default" : "secondary"}
                >
                  {selected.tipo === "CHECKIN" ? "Check-in" : "Check-out"}
                </Badge>
              </div>
              <PrivatePhoto
                path={selected.foto_path}
                className="w-full h-64 object-cover rounded-xl border border-border bg-muted"
              />
              <LocationMap
                lat={selected.latitude}
                lng={selected.longitude}
                label="Local do registro"
                height={220}
              />
            </div>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}
