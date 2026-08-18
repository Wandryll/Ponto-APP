import { createContext, useContext, useEffect, useState, type ReactNode } from "react";
import type { User } from "@supabase/supabase-js";
import { supabase } from "@/lib/supabaseClient";

export type AppUser = User & {
  role: "admin" | "employee";
  name: string;
  avatar?: string;
  position?: string;
  team?: string;
  admissionDate?: string;
};

interface AuthContextValue {
  user: AppUser | null;
  loading: boolean;
  login: (email: string, password: string) => Promise<AppUser>;
  logout: () => Promise<void>;
  updateUser: (patch: Partial<AppUser>) => void;
}

const AuthContext = createContext<AuthContextValue | undefined>(undefined);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<AppUser | null>(null);
  const [loading, setLoading] = useState(true);

  const buildAppUser = async (authUser: User): Promise<AppUser> => {
    try {
      const { data, error } = await supabase
        .from("colaboradores")
        .select("nome,cargo,equipe,ativo,data_admissao,avatar,is_admin")
        .eq("id", authUser.id)
        .maybeSingle();

      if (error) {
        throw error;
      }
      if (!data?.ativo) throw new Error("Conta desativada ou perfil inexistente.");

      const nomeSeguro = data?.nome || authUser.email?.split("@")[0] || "Usuário";

      return {
        ...authUser,
        role: data?.is_admin ? "admin" : "employee",
        name: nomeSeguro,
        avatar: data.avatar || "",
        position: data?.cargo || "",
        team: data.equipe || "",
        admissionDate: data.data_admissao || "",
      };
    } catch (err) {
      console.error("Erro ao carregar perfil:", err);
      throw new Error("Perfil indisponível ou sem permissão.");
    }
  };

  useEffect(() => {
    const initSession = async () => {
      const {
        data: { session },
      } = await supabase.auth.getSession();
      try {
        if (session?.user) {
          const appUser = await buildAppUser(session.user);
          setUser(appUser);
        }
      } catch {
        setUser(null);
      }
      setLoading(false);
    };

    initSession();

    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange((_event, session) => {
      if (!session?.user) {
        setUser(null);
        setLoading(false);
      } else {
        void buildAppUser(session.user)
          .then(setUser)
          .catch(() => setUser(null))
          .finally(() => setLoading(false));
      }
    });

    return () => subscription.unsubscribe();
  }, []);

  const login = async (email: string, password: string) => {
    const { data, error } = await supabase.auth.signInWithPassword({
      email,
      password,
    });

    if (error) throw error;
    if (!data.user) throw new Error("Erro no login");

    try {
      const appUser = await buildAppUser(data.user);
      setUser(appUser);
      return appUser;
    } catch (error) {
      await supabase.auth.signOut();
      throw error;
    }
  };

  const logout = async () => {
    const { error } = await supabase.auth.signOut();
    if (error) throw error;
    setUser(null);
  };

  const updateUser = (patch: Partial<AppUser>) => {
    setUser((prev) => (prev ? { ...prev, ...patch } : null));
  };

  return (
    <AuthContext.Provider value={{ user, loading, login, logout, updateUser }}>
      {!loading && children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error("useAuth must be used within AuthProvider");
  return ctx;
}
