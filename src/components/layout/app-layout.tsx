import type { ReactNode } from "react";
import { AppHeader } from "./app-header";
import { AppSidebar } from "./app-sidebar";

export function AppLayout({ children }: { children: ReactNode }) {
  return (
    <div className="flex min-h-screen w-full bg-background">
      <div className="hidden md:block sticky top-0 h-screen">
        <AppSidebar />
      </div>
      <div className="flex-1 flex flex-col min-w-0">
        <AppHeader />
        <main className="relative flex-1 overflow-hidden p-4 sm:p-6 lg:p-8">
          <div className="pointer-events-none absolute inset-x-0 top-0 h-48 bg-gradient-to-b from-primary/[0.035] to-transparent" />
          <div className="relative">{children}</div>
        </main>
      </div>
    </div>
  );
}
