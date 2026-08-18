import { createFileRoute } from "@tanstack/react-router";
import { useCallback, useEffect, useState } from "react";
import { Eye, KeyRound, Loader2, Plus } from "lucide-react";
import { useForm } from "react-hook-form";
import { toast } from "sonner";

import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { useAuth } from "@/contexts/auth-context";
import { supabase } from "@/lib/supabaseClient";

export const Route = createFileRoute("/_app/team")({
  head: () => ({ meta: [{ title: "Equipe — PontoCorp" }] }),
  component: TeamPage,
});

interface Colaborador {
  id: string;
  nome: string;
  cargo: string | null;
  email: string;
  equipe: string | null;
  ativo: boolean;
  data_admissao: string | null;
  avatar: string | null;
  is_admin: boolean;
}

interface NewForm {
  nome: string;
  email: string;
  senha_inicial: string;
  cargo: string;
  equipe: string;
  is_admin: boolean;
}

function TeamPage() {
  const { user } = useAuth();
  const [users, setUsers] = useState<Colaborador[]>([]);
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [open, setOpen] = useState(false);
  const [viewing, setViewing] = useState<Colaborador | null>(null);
  const { register, handleSubmit, reset } = useForm<NewForm>();

  const fetchEquipe = useCallback(async () => {
    setLoading(true);
    const { data, error } = await supabase
      .from("colaboradores")
      .select("id,nome,cargo,email,equipe,ativo,data_admissao,avatar,is_admin")
      .order("nome");
    if (error) toast.error("Não foi possível carregar a equipe.");
    else setUsers((data ?? []) as Colaborador[]);
    setLoading(false);
  }, []);

  useEffect(() => {
    void fetchEquipe();
  }, [fetchEquipe]);

  const onSubmit = async (data: NewForm) => {
    setSubmitting(true);
    const { error } = await supabase.functions.invoke("create-employee", {
      body: {
        nome: data.nome.trim(),
        email: data.email.trim().toLowerCase(),
        password: data.senha_inicial,
        cargo: data.cargo.trim(),
        equipe: data.equipe.trim(),
        is_admin: Boolean(data.is_admin),
      },
    });
    if (error) toast.error("Não foi possível cadastrar o funcionário.");
    else {
      toast.success("Funcionário cadastrado com sucesso!");
      reset();
      setOpen(false);
      await fetchEquipe();
    }
    setSubmitting(false);
  };

  if (user?.role !== "admin") {
    return (
      <Card className="max-w-xl mx-auto">
        <CardContent className="p-8 text-center text-muted-foreground">
          Apenas administradores podem gerenciar a equipe.
        </CardContent>
      </Card>
    );
  }

  return (
    <div className="space-y-6 max-w-[1400px] mx-auto">
      <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-2xl sm:text-3xl font-bold tracking-tight">Equipe</h1>
          <p className="text-muted-foreground text-sm mt-1">
            Gerencie funcionários e acessos administrativos.
          </p>
        </div>
        <Button className="gap-2" onClick={() => setOpen(true)}>
          <Plus className="h-4 w-4" />
          Novo funcionário
        </Button>
      </div>
      <Card>
        <CardContent className="p-0">
          {loading ? (
            <div className="flex justify-center py-12">
              <Loader2 className="h-6 w-6 animate-spin" />
            </div>
          ) : (
            <div className="overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Funcionário</TableHead>
                    <TableHead>Cargo</TableHead>
                    <TableHead>Acesso</TableHead>
                    <TableHead className="text-right">Ações</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {users.map((item) => (
                    <TableRow key={item.id}>
                      <TableCell>
                        <div className="flex items-center gap-3">
                          <Avatar className="h-9 w-9">
                            <AvatarImage src={item.avatar || ""} />
                            <AvatarFallback>{item.nome.slice(0, 2)}</AvatarFallback>
                          </Avatar>
                          <div>
                            <div className="font-medium">{item.nome}</div>
                            <div className="text-xs text-muted-foreground">{item.email}</div>
                          </div>
                        </div>
                      </TableCell>
                      <TableCell>
                        {item.cargo || "—"}
                        <div className="text-xs text-muted-foreground">
                          {item.equipe || "Sem equipe"}
                        </div>
                      </TableCell>
                      <TableCell>
                        <Badge variant={item.ativo ? "default" : "secondary"}>
                          {item.ativo ? (item.is_admin ? "Administrador" : "Ativo") : "Inativo"}
                        </Badge>
                      </TableCell>
                      <TableCell className="text-right">
                        <Button
                          variant="ghost"
                          size="icon"
                          onClick={() => setViewing(item)}
                          aria-label={`Ver ${item.nome}`}
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
        </CardContent>
      </Card>

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Novo funcionário</DialogTitle>
          </DialogHeader>
          <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
            <div className="space-y-1.5">
              <Label>Nome completo</Label>
              <Input
                {...register("nome", {
                  required: true,
                  minLength: 2,
                  maxLength: 120,
                })}
              />
            </div>
            <div className="space-y-1.5">
              <Label>E-mail de acesso</Label>
              <Input type="email" autoComplete="off" {...register("email", { required: true })} />
            </div>
            <div className="space-y-1.5">
              <Label>Senha inicial</Label>
              <div className="relative">
                <KeyRound className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                <Input
                  type="password"
                  autoComplete="new-password"
                  className="pl-9"
                  {...register("senha_inicial", {
                    required: true,
                    minLength: 8,
                  })}
                />
              </div>
            </div>
            <div className="space-y-1.5">
              <Label>Cargo</Label>
              <Input {...register("cargo", { maxLength: 120 })} />
            </div>
            <div className="space-y-1.5">
              <Label>Equipe</Label>
              <Input {...register("equipe", { maxLength: 120 })} />
            </div>
            <div className="flex items-center gap-2">
              <input type="checkbox" id="is_admin" {...register("is_admin")} />
              <Label htmlFor="is_admin">Administrador</Label>
            </div>
            <DialogFooter>
              <Button type="button" variant="outline" onClick={() => setOpen(false)}>
                Cancelar
              </Button>
              <Button type="submit" disabled={submitting}>
                {submitting ? <Loader2 className="h-4 w-4 animate-spin" /> : "Cadastrar"}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>

      <Dialog open={!!viewing} onOpenChange={(value) => !value && setViewing(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Detalhes do funcionário</DialogTitle>
          </DialogHeader>
          {viewing && (
            <div className="space-y-4">
              <div className="flex items-center gap-4">
                <Avatar className="h-16 w-16">
                  <AvatarImage src={viewing.avatar || ""} />
                  <AvatarFallback>{viewing.nome.slice(0, 2)}</AvatarFallback>
                </Avatar>
                <div>
                  <div className="font-semibold text-lg">{viewing.nome}</div>
                  <div className="text-sm text-muted-foreground">
                    {viewing.cargo || "Cargo não informado"} · {viewing.equipe || "Sem equipe"}
                  </div>
                  <div className="text-sm text-muted-foreground">{viewing.email}</div>
                </div>
              </div>
              <Badge variant={viewing.ativo ? "default" : "secondary"}>
                {viewing.ativo ? (viewing.is_admin ? "Administrador" : "Ativo") : "Inativo"}
              </Badge>
            </div>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}
