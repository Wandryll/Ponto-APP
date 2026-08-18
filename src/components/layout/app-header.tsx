import { useEffect, useState } from "react";
import { Menu } from "lucide-react";
import { useAuth } from "@/contexts/auth-context";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Button } from "@/components/ui/button";
import { Sheet, SheetContent, SheetTrigger } from "@/components/ui/sheet";
import { AppSidebar } from "./app-sidebar";

function useNow() {
  const [now, setNow] = useState(() => new Date());
  useEffect(() => {
    const t = setInterval(() => setNow(new Date()), 1000);
    return () => clearInterval(t);
  }, []);
  return now;
}

export function AppHeader() {
  const { user } = useAuth();
  const now = useNow();
  const [open, setOpen] = useState(false);

  const dateStr = now.toLocaleDateString("pt-BR", {
    weekday: "long",
    day: "2-digit",
    month: "long",
  });
  const timeStr = now.toLocaleTimeString("pt-BR", {
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
  });

  return (
    <header className="sticky top-0 z-20 flex h-16 items-center justify-between gap-4 border-b border-border bg-card/80 backdrop-blur px-4 sm:px-6">
      <div className="flex items-center gap-3 min-w-0">
        <Sheet open={open} onOpenChange={setOpen}>
          <SheetTrigger asChild>
            <Button variant="ghost" size="icon" className="md:hidden">
              <Menu className="h-5 w-5" />
            </Button>
          </SheetTrigger>
          <SheetContent side="left" className="p-0 w-64">
            <AppSidebar onNavigate={() => setOpen(false)} />
          </SheetContent>
        </Sheet>
        <div className="hidden sm:flex flex-col leading-tight min-w-0">
          <span className="text-xs text-muted-foreground capitalize truncate">{dateStr}</span>
          <span className="text-sm font-semibold text-foreground tabular-nums">{timeStr}</span>
        </div>
      </div>

      {user && (
        <div className="flex items-center gap-3 min-w-0">
          <div className="hidden sm:flex flex-col items-end leading-tight min-w-0">
            <span className="text-sm font-semibold text-foreground truncate max-w-[180px]">
              {user.name}
            </span>
            <span className="text-xs text-muted-foreground truncate max-w-[180px]">
              {user.position}
            </span>
          </div>
          <Avatar className="h-9 w-9 ring-2 ring-primary/20">
            <AvatarImage src={user.avatar} alt={user.name} />
            <AvatarFallback>{user.name.slice(0, 2).toUpperCase()}</AvatarFallback>
          </Avatar>
        </div>
      )}
    </header>
  );
}
