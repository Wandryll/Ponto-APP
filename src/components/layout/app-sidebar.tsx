import { Link, useRouterState } from "@tanstack/react-router";
import { LayoutDashboard, Clock, History, BarChart3, Users, Settings, LogOut } from "lucide-react";
import { useAuth } from "@/contexts/auth-context";
import { cn } from "@/lib/utils";

const allItems = [
  {
    to: "/dashboard",
    label: "Dashboard",
    icon: LayoutDashboard,
    roles: ["admin", "employee"],
  },
  {
    to: "/checkpoint",
    label: "Check-in / Check-out",
    icon: Clock,
    roles: ["admin", "employee"],
  },
  {
    to: "/history",
    label: "Histórico",
    icon: History,
    roles: ["admin", "employee"],
  },
  { to: "/reports", label: "Relatórios", icon: BarChart3, roles: ["admin"] },
  { to: "/team", label: "Equipe", icon: Users, roles: ["admin"] },
  {
    to: "/profile",
    label: "Perfil",
    icon: Settings,
    roles: ["admin", "employee"],
  },
];

export function AppSidebar({ onNavigate }: { onNavigate?: () => void }) {
  const { user, logout } = useAuth();
  const pathname = useRouterState({ select: (s) => s.location.pathname });

  const items = allItems.filter((i) => user && i.roles.includes(user.role));

  return (
    <aside className="flex h-full w-64 flex-col bg-sidebar text-sidebar-foreground">
      <div className="flex items-center gap-2 px-6 py-5 border-b border-sidebar-border">
        <img
          src="/logo_itm.png"
          alt="Logo ITM"
          className="h-8 w-auto object-contain bg-white rounded p-1 shrink-0"
        />
        <div className="leading-tight">
          <div className="font-bold text-sm">ITM</div>
          <div className="text-[11px] text-sidebar-foreground/60">Gestão de Equipe</div>
        </div>
      </div>

      <nav className="flex-1 overflow-y-auto px-3 py-4 space-y-1">
        {items.map((item) => {
          const active = pathname === item.to || pathname.startsWith(item.to + "/");
          const Icon = item.icon;
          return (
            <Link
              key={item.to}
              to={item.to}
              onClick={onNavigate}
              className={cn(
                "flex items-center gap-3 rounded-lg px-3 py-2.5 text-sm font-medium transition-colors",
                active
                  ? "bg-sidebar-primary text-sidebar-primary-foreground shadow-soft"
                  : "text-sidebar-foreground/80 hover:bg-sidebar-accent hover:text-sidebar-accent-foreground",
              )}
            >
              <Icon className="h-4 w-4 shrink-0" />
              <span className="truncate">{item.label}</span>
            </Link>
          );
        })}
      </nav>

      <div className="border-t border-sidebar-border p-3">
        <button
          onClick={logout}
          className="flex w-full items-center gap-3 rounded-lg px-3 py-2.5 text-sm font-medium text-sidebar-foreground/80 hover:bg-sidebar-accent hover:text-sidebar-accent-foreground transition-colors"
        >
          <LogOut className="h-4 w-4" />
          Sair
        </button>
      </div>
    </aside>
  );
}
