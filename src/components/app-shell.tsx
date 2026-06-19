import { Link, useNavigate, useRouterState } from "@tanstack/react-router";
import {
  LayoutDashboard, Building2, Store, Users, ShieldCheck, Settings, FileText,
  LogOut, Tag, Package, FolderTree, Bookmark, Leaf, AlertCircle, Activity,
  LayoutTemplate, Ruler, FolderKanban, Printer, PrinterCheck, History, DollarSign, Percent,
  BarChart3,
} from "lucide-react";
import type { ReactNode } from "react";
import { useAuth } from "@/lib/auth-context";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { CompanySwitcher } from "@/components/company-switcher";

type NavItem = { to: string; label: string; icon: any; exact?: boolean; group: string };
const nav: NavItem[] = [
  { to: "/app", label: "Dashboard", icon: LayoutDashboard, exact: true, group: "Geral" },
  { to: "/app/print-labels", label: "Emissão de Etiquetas", icon: PrinterCheck, group: "Emissão" },
  { to: "/app/print-history", label: "Histórico de Emissões", icon: History, group: "Emissão" },
  { to: "/app/products", label: "Produtos", icon: Package, group: "Cadastros" },
  { to: "/app/categories", label: "Categorias", icon: FolderTree, group: "Cadastros" },
  { to: "/app/brands", label: "Marcas", icon: Bookmark, group: "Cadastros" },
  { to: "/app/ingredients", label: "Ingredientes", icon: Leaf, group: "Cadastros" },
  { to: "/app/allergens", label: "Alergênicos", icon: AlertCircle, group: "Cadastros" },
  { to: "/app/nutrition", label: "Inf. Nutricionais", icon: Activity, group: "Cadastros" },
  { to: "/app/prices", label: "Preços", icon: DollarSign, group: "Cadastros" },
  { to: "/app/promotions", label: "Promoções", icon: Percent, group: "Cadastros" },
  { to: "/app/pending", label: "Pendências Regulatórias", icon: AlertCircle, group: "Cadastros" },
  { to: "/app/layouts", label: "Central de Layouts", icon: LayoutTemplate, group: "Layouts" },
  { to: "/app/layout-categories", label: "Categorias de Layout", icon: FolderKanban, group: "Layouts" },
  { to: "/app/layout-formats", label: "Formatos", icon: Ruler, group: "Layouts" },
  { to: "/app/printers", label: "Impressoras", icon: Printer, group: "Layouts" },
  { to: "/app/companies", label: "Empresas", icon: Building2, group: "Administração" },
  { to: "/app/branches", label: "Filiais", icon: Store, group: "Administração" },
  { to: "/app/users", label: "Usuários", icon: Users, group: "Administração" },
  { to: "/app/roles", label: "Perfis", icon: ShieldCheck, group: "Administração" },
  { to: "/app/audit", label: "Auditoria", icon: FileText, group: "Administração" },
  { to: "/app/settings", label: "Configurações", icon: Settings, group: "Administração" },
];

const groups = ["Geral", "Emissão", "Cadastros", "Layouts", "Administração"] as const;

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
        <nav className="flex-1 p-3 space-y-4 overflow-y-auto">
          {groups.map((g) => (
            <div key={g} className="space-y-1">
              <div className="px-3 pt-1 text-[11px] uppercase tracking-wider text-muted-foreground font-semibold">{g}</div>
              {nav.filter((i) => i.group === g).map((item) => {
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
            </div>
          ))}
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
        <header className="h-14 flex items-center justify-between gap-2 border-b bg-background px-4 md:px-6">
          <div className="md:hidden flex items-center gap-2 font-semibold">
            <Tag className="size-5 text-primary" /> Etiquetas
          </div>
          <div className="flex-1 flex justify-end md:justify-start">
            <CompanySwitcher />
          </div>
          <Button variant="ghost" size="sm" className="md:hidden" onClick={handleSignOut}>
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
