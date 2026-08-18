import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { useForm } from "react-hook-form";
import { toast } from "sonner";
import { Camera } from "lucide-react";

import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { useAuth } from "@/contexts/auth-context";
import { supabase } from "@/lib/supabaseClient";

export const Route = createFileRoute("/_app/profile")({
  head: () => ({ meta: [{ title: "Perfil — PontoCorp" }] }),
  component: ProfilePage,
});

interface ProfileForm {
  name: string;
  password: string;
  confirm: string;
}

function ProfilePage() {
  const { user, updateUser } = useAuth();
  const [avatar, setAvatar] = useState(user?.avatar ?? "");
  const [avatarFile, setAvatarFile] = useState<File | null>(null);
  const { register, handleSubmit } = useForm<ProfileForm>({
    defaultValues: { name: user?.name ?? "", password: "", confirm: "" },
  });

  useEffect(() => {
    if (!avatarFile) return;
    const previewUrl = URL.createObjectURL(avatarFile);
    setAvatar(previewUrl);
    return () => URL.revokeObjectURL(previewUrl);
  }, [avatarFile]);

  if (!user) return null;

  const onSubmit = async (data: ProfileForm) => {
    if (data.password && data.password !== data.confirm) {
      toast.error("As senhas não coincidem.");
      return;
    }
    const safeName = data.name.trim();
    if (safeName.length < 2 || safeName.length > 120) {
      toast.error("Informe um nome válido.");
      return;
    }
    if (data.password && data.password.length < 8) {
      toast.error("A nova senha deve ter ao menos 8 caracteres.");
      return;
    }

    let avatarUrl = user.avatar ?? "";
    if (avatarFile) {
      const avatarPath = `${user.id}/avatar.jpg`;
      const { error: uploadError } = await supabase.storage
        .from("avatares")
        .upload(avatarPath, avatarFile, { contentType: "image/jpeg", upsert: true });
      if (uploadError) {
        toast.error("Não foi possível atualizar a foto.");
        return;
      }
      avatarUrl = `${supabase.storage.from("avatares").getPublicUrl(avatarPath).data.publicUrl}?v=${Date.now()}`;
    }

    const { error: profileError } = await supabase
      .from("colaboradores")
      .update({ nome: safeName, avatar: avatarUrl })
      .eq("id", user.id);
    if (profileError) {
      toast.error("Não foi possível atualizar o perfil.");
      return;
    }
    setAvatar(avatarUrl);
    setAvatarFile(null);
    updateUser({ name: safeName, avatar: avatarUrl });
    if (data.password) {
      const { error: passwordError } = await supabase.auth.updateUser({ password: data.password });
      if (passwordError) {
        toast.warning("O perfil foi salvo, mas não foi possível alterar a senha.");
        return;
      }
    }
    toast.success("Perfil atualizado.");
  };

  const handleAvatarPick = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    if (file.type !== "image/jpeg" || file.size > 2 * 1024 * 1024) {
      toast.error("Escolha uma imagem JPEG de até 2 MB.");
      return;
    }
    setAvatarFile(file);
  };

  return (
    <div className="space-y-6 max-w-3xl mx-auto">
      <div>
        <h1 className="text-2xl sm:text-3xl font-bold tracking-tight">Meu perfil</h1>
        <p className="text-muted-foreground text-sm mt-1">
          Atualize suas informações pessoais e de acesso.
        </p>
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">Informações</CardTitle>
        </CardHeader>
        <CardContent>
          <form onSubmit={handleSubmit(onSubmit)} className="space-y-6">
            <div className="flex items-center gap-5">
              <div className="relative">
                <Avatar className="h-20 w-20 ring-2 ring-primary/20">
                  <AvatarImage src={avatar} />
                  <AvatarFallback>{user.name.slice(0, 2)}</AvatarFallback>
                </Avatar>
                <label className="absolute -bottom-1 -right-1 grid h-8 w-8 place-items-center rounded-full bg-primary text-primary-foreground cursor-pointer shadow-card hover:bg-primary/90 transition-colors">
                  <Camera className="h-4 w-4" />
                  <input
                    type="file"
                    accept="image/jpeg"
                    className="hidden"
                    onChange={handleAvatarPick}
                  />
                </label>
              </div>
              <div>
                <div className="font-semibold">{user.name}</div>
                <div className="text-sm text-muted-foreground">
                  {user.position} · {user.team}
                </div>
              </div>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div className="space-y-1.5">
                <Label>Nome</Label>
                <Input {...register("name", { required: true })} />
              </div>
              <div className="space-y-1.5">
                <Label>E-mail</Label>
                <Input value={user.email} disabled />
              </div>
              <div className="space-y-1.5">
                <Label>Cargo</Label>
                <Input value={user.position} disabled />
              </div>
              <div className="space-y-1.5">
                <Label>Admissão</Label>
                <Input
                  value={
                    user.admissionDate
                      ? new Date(user.admissionDate).toLocaleDateString("pt-BR")
                      : ""
                  }
                  disabled
                />
              </div>
            </div>

            <div className="border-t border-border pt-6 space-y-4">
              <div>
                <h3 className="font-semibold text-sm">Alterar senha</h3>
                <p className="text-xs text-muted-foreground">
                  Deixe em branco para manter a atual.
                </p>
              </div>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div className="space-y-1.5">
                  <Label>Nova senha</Label>
                  <Input type="password" {...register("password")} />
                </div>
                <div className="space-y-1.5">
                  <Label>Confirmar senha</Label>
                  <Input type="password" {...register("confirm")} />
                </div>
              </div>
            </div>

            <div className="flex justify-end">
              <Button type="submit">Salvar alterações</Button>
            </div>
          </form>
        </CardContent>
      </Card>
    </div>
  );
}
