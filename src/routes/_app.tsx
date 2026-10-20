import { createFileRoute, Navigate, Outlet, useRouterState } from "@tanstack/react-router";
import { AppLayout } from "@/components/layout/app-layout";
import { useAuth } from "@/contexts/auth-context";

export const Route = createFileRoute("/_app")({
  component: AppShell,
});

function AppShell() {
  const { user, loading } = useAuth();
  const pathname = useRouterState({ select: (state) => state.location.pathname });
  if (loading) {
    return (
      <div className="min-h-screen grid place-items-center bg-background">
        <div className="h-8 w-8 rounded-full border-2 border-primary border-t-transparent animate-spin" />
      </div>
    );
  }
  if (!user) return <Navigate to="/login" />;
  const employeeRouteAllowed = pathname === "/checkpoint" || pathname === "/profile";
  if (user.role !== "admin" && !employeeRouteAllowed) {
    return <Navigate to="/checkpoint" />;
  }
  return (
    <AppLayout>
      <Outlet />
    </AppLayout>
  );
}
