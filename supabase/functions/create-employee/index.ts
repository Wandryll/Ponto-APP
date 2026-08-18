import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": Deno.env.get("APP_ORIGIN") ?? "",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
  Vary: "Origin",
};

Deno.serve(async (request) => {
  if (request.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });
  if (request.method !== "POST") return json({ error: "Método inválido" }, 405);

  try {
    const auth = request.headers.get("Authorization");
    if (!auth) return json({ error: "Não autenticado" }, 401);

    const url = Deno.env.get("SUPABASE_URL")!;
    const anonKey = Deno.env.get("SUPABASE_ANON_KEY")!;
    const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const callerClient = createClient(url, anonKey, {
      global: { headers: { Authorization: auth } },
    });
    const adminClient = createClient(url, serviceKey, {
      auth: { autoRefreshToken: false, persistSession: false },
    });
    const {
      data: { user },
    } = await callerClient.auth.getUser();
    if (!user) return json({ error: "Não autenticado" }, 401);

    const { data: caller } = await adminClient
      .from("colaboradores")
      .select("is_admin,ativo")
      .eq("id", user.id)
      .single();
    if (!caller?.is_admin || !caller.ativo) return json({ error: "Acesso negado" }, 403);

    const body = await request.json();
    const nome = String(body.nome ?? "").trim();
    const email = String(body.email ?? "")
      .trim()
      .toLowerCase();
    const password = String(body.password ?? "");
    const cargo = String(body.cargo ?? "").trim();
    const equipe = String(body.equipe ?? "").trim();
    if (
      nome.length < 2 ||
      nome.length > 120 ||
      email.length > 254 ||
      !/^\S+@\S+\.\S+$/.test(email) ||
      password.length < 8 ||
      password.length > 72 ||
      cargo.length > 120 ||
      equipe.length > 120 ||
      typeof body.is_admin !== "boolean"
    ) {
      return json({ error: "Dados inválidos" }, 400);
    }

    const { data, error } = await adminClient.auth.admin.createUser({
      email,
      password,
      email_confirm: true,
      user_metadata: { nome },
    });
    if (error || !data.user) return json({ error: "Não foi possível criar o usuário" }, 400);

    const { error: profileError } = await adminClient.from("colaboradores").upsert({
      id: data.user.id,
      nome,
      email,
      cargo: cargo.slice(0, 120),
      equipe: equipe.slice(0, 120),
      is_admin: Boolean(body.is_admin),
      ativo: true,
    });
    if (profileError) {
      await adminClient.auth.admin.deleteUser(data.user.id);
      return json({ error: "Não foi possível criar o perfil" }, 500);
    }
    return json({ id: data.user.id }, 201);
  } catch {
    return json({ error: "Requisição inválida" }, 400);
  }
});

function json(body: unknown, status: number) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
}
