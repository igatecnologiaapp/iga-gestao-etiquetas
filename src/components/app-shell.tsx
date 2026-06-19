import { Link, useNavigate, useRouterState } from "@tanstack/react-router";
import {
  LayoutDashboard,
  Building2,
  Store,
  Users,
  ShieldCheck,
  Settings,
  FileText,
  LogOut,
  Tag,
} from "lucide-react";
import type { ReactNode } from "react";
import { useAuth } from "@/lib/auth-context";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

type NavItem = { to: string; label: string; icon: any; exact?: boolean };
const nav: NavItem[] = [
  { to: "/app", label: "Dashboard", icon: LayoutDashboard, exact: true },
  { to: "/app/companies", label: "Empresas", icon: Building2 },
  { to: "/app/branches", label: "Filiais", icon: Store },
  { to: "/app/users", label: "Usuários", icon: Users },
  { to: "/app/roles", label: "Perfis", icon: ShieldCheck },
  { to: "/app/audit", label: "Auditoria", icon: FileText },
  { to: "/app/settings", label: "Configurações", icon: Settings },
];

export function AppShell({ children }: { children: ReactNode }) {
  const { user, signOut } = useAuth();
  const navigate = useNavigate();
  const path = useRouterState({ select: (s) => s.location.pathname });

  async function handleSignOut() {
    await signOut();
    navigate({ to: "/auth", replace: true });
  }

  return (
    <div className="min-h-screen flex bg-muted/30">
      <aside className="hidden md:flex w-64 flex-col border-r border-sidebar-border bg-sidebar text-sidebar-foreground">
        <div className="h-16 flex items-center gap-2 px-5 border-b border-sidebar-border">
          <div className="size-9 rounded-md bg-primary text-primary-foreground grid place-items-center">
            <Tag className="size-5" />
          </div>
          <div className="leading-tight">
            <div className="font-semibold">Etiquetas</div>
            <div className="text-xs text-muted-foreground">Painel admin</div>
          </div>
        </div>
        <nav className="flex-1 p-3 space-y-1">
          {nav.map((item) => {
            const active = item.exact ? path === item.to : path.startsWith(item.to);
            return (
              <Link
                key={item.to}
                to={item.to}
                className={cn(
                  "flex items-center gap-3 rounded-md px-3 py-2 text-sm font-medium transition-colors",
                  active
                    ? "bg-sidebar-accent text-sidebar-accent-foreground"
                    : "text-sidebar-foreground/80 hover:bg-sidebar-accent hover:text-sidebar-accent-foreground",
                )}
              >
                <item.icon className="size-4" />
                {item.label}
              </Link>
            );
          })}
        </nav>
        <div className="border-t border-sidebar-border p-3">
          <div className="px-2 pb-2 text-xs text-muted-foreground truncate">
            {user?.email}
          </div>
          <Button variant="outline" size="sm" className="w-full justify-start gap-2" onClick={handleSignOut}>
            <LogOut className="size-4" /> Sair
          </Button>
        </div>
      </aside>

      <div className="flex-1 flex flex-col min-w-0">
        <header className="md:hidden h-14 flex items-center justify-between gap-2 border-b bg-background px-4">
          <div className="flex items-center gap-2 font-semibold">
            <Tag className="size-5 text-primary" /> Etiquetas
          </div>
          <Button variant="ghost" size="sm" onClick={handleSignOut}>
            <LogOut className="size-4" />
          </Button>
        </header>
        <main className="flex-1 p-4 md:p-8 max-w-screen-2xl w-full mx-auto">
          {children}
        </main>
      </div>
    </div>
  );
}
