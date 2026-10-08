import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useForm } from "react-hook-form";
import { useEffect, useState } from "react";
import { Loader2, Mail, Lock } from "lucide-react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useAuth } from "@/contexts/auth-context";
import { BrandLogos } from "@/components/layout/brand-logos";

interface LoginForm {
  email: string;
  password: string;
}

export const Route = createFileRoute("/login")({
  head: () => ({ meta: [{ title: "Entrar — Ponto DCT" }] }),
  component: LoginPage,
});

function LoginPage() {
  const { login, user } = useAuth();
  const navigate = useNavigate();
  const [submitting, setSubmitting] = useState(false);

  const {
    register,
    handleSubmit,
    formState: { errors },
  } = useForm<LoginForm>({ defaultValues: { email: "", password: "" } });

  useEffect(() => {
    if (user) navigate({ to: "/dashboard" });
  }, [user, navigate]);

  const onSubmit = async (data: LoginForm) => {
    setSubmitting(true);
    try {
      await login(data.email.trim().toLowerCase(), data.password);
      toast.success("Login realizado com sucesso!");
      navigate({ to: "/dashboard" });
    } catch {
      toast.error("Não foi possível entrar.");
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="min-h-screen w-full flex">
      <div className="relative hidden flex-1 flex-col justify-between overflow-hidden bg-sidebar p-12 text-sidebar-foreground lg:flex">
        <div className="absolute -right-32 -top-32 h-96 w-96 rounded-full bg-sidebar-primary/15 blur-3xl" />
        <div className="absolute -bottom-32 -left-20 h-80 w-80 rounded-full bg-sidebar-primary/10 blur-3xl" />
        <div className="absolute inset-0 bg-[linear-gradient(135deg,transparent_0%,transparent_55%,rgb(237_183_46/0.045)_100%)]" />
        <div className="relative space-y-4">
          <BrandLogos />
          <div className="flex items-center gap-3">
            <span className="h-px w-8 bg-sidebar-primary" />
            <span className="text-xs font-semibold uppercase tracking-[0.2em] text-sidebar-primary">
              Ponto DCT
            </span>
          </div>
        </div>
        <div className="relative space-y-4 max-w-md">
          <h1 className="text-4xl font-bold leading-tight tracking-tight">
            Controle de ponto simples, seguro e conectado.
          </h1>
          <p className="text-sidebar-foreground/70">
            Registros com geolocalização, foto e relatórios completos. Tudo em uma única plataforma.
          </p>
        </div>
        <div className="relative text-xs text-sidebar-foreground/50">
          © {new Date().getFullYear()} DCT · Prefeitura de Manacapuru
        </div>
      </div>

      <div className="relative flex flex-1 items-center justify-center overflow-hidden bg-background p-6 sm:p-12">
        <div className="pointer-events-none absolute -right-20 -top-20 h-72 w-72 rounded-full bg-primary/5 blur-3xl" />
        <div className="w-full max-w-md space-y-8">
          <div className="lg:hidden">
            <BrandLogos compact />
            <div className="mt-3 text-sm font-bold tracking-wide">Ponto DCT</div>
          </div>

          <div className="space-y-2">
            <div className="mb-4 h-1 w-12 rounded-full bg-primary" />
            <h2 className="text-2xl font-bold tracking-tight sm:text-3xl">Acesse sua conta</h2>
            <p className="text-sm text-muted-foreground">
              Entre com seu e-mail institucional para continuar.
            </p>
          </div>

          <form onSubmit={handleSubmit(onSubmit)} className="space-y-5">
            <div className="space-y-2">
              <Label htmlFor="email">E-mail</Label>
              <div className="relative">
                <Mail className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                <Input
                  id="email"
                  type="email"
                  placeholder="seu.email@dominio.gov.br"
                  className="pl-9"
                  {...register("email", {
                    required: "Informe o e-mail",
                    pattern: {
                      value: /\S+@\S+\.\S+/,
                      message: "E-mail inválido",
                    },
                  })}
                />
              </div>
              {errors.email && <p className="text-xs text-destructive">{errors.email.message}</p>}
            </div>

            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <Label htmlFor="password">Senha</Label>
                <button
                  type="button"
                  onClick={() => toast.info("Solicite a redefinição de senha ao administrador.")}
                  className="text-xs font-medium text-primary hover:underline"
                >
                  Esqueci minha senha
                </button>
              </div>
              <div className="relative">
                <Lock className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                <Input
                  id="password"
                  type="password"
                  placeholder="••••••••"
                  className="pl-9"
                  {...register("password", {
                    required: "Informe a senha",
                    minLength: { value: 8, message: "Mínimo de 8 caracteres" },
                  })}
                />
              </div>
              {errors.password && (
                <p className="text-xs text-destructive">{errors.password.message}</p>
              )}
            </div>

            <Button
              type="submit"
              className="h-11 w-full text-base shadow-md shadow-primary/10"
              disabled={submitting}
            >
              {submitting && <Loader2 className="h-4 w-4 animate-spin" />}
              Entrar
            </Button>
          </form>
        </div>
      </div>
    </div>
  );
}
