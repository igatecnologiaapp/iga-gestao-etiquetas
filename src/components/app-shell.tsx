import { Link, useNavigate, useRouterState } from "@tanstack/react-router";
import {
  LayoutDashboard, Building2, Store, Users, ShieldCheck, Settings, FileText,
  LogOut, Tag, Package, FolderTree, Bookmark, Leaf, AlertCircle, Activity,
  LayoutTemplate, Ruler, FolderKanban, Printer, PrinterCheck, History, DollarSign, Percent,
  BarChart3, Plug, MessageSquare, PanelLeftClose, PanelLeftOpen, Menu, ChevronDown,
  Sun, Moon,
} from "lucide-react";
import { useEffect, useState, type ReactNode } from "react";
import { useAuth } from "@/lib/auth-context";
import { useTheme } from "@/lib/theme";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { CompanySwitcher } from "@/components/company-switcher";

type NavItem = { to: string; label: string; icon: any; exact?: boolean; group: string };
const nav: NavItem[] = [
  { to: "/app", label: "Dashboard", icon: LayoutDashboard, exact: true, group: "Geral" },
  { to: "/app/reports", label: "Relatórios", icon: BarChart3, group: "Geral" },
  { to: "/app/print-labels", label: "Emissão de Etiquetas", icon: PrinterCheck, group: "Emissão" },
  { to: "/app/print-batch", label: "Impressão em Lote", icon: PrinterCheck, group: "Emissão" },
  { to: "/app/print-queue", label: "Fila de Impressão", icon: Printer, group: "Emissão" },
  { to: "/app/print-history", label: "Histórico de Emissões", icon: History, group: "Emissão" },
  { to: "/app/print-dashboard", label: "Dashboard", icon: BarChart3, group: "Emissão" },
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
  { to: "/app/admin-handover", label: "Transferir Admin Principal", icon: ShieldCheck, group: "Administração" },
  { to: "/app/roles", label: "Perfis", icon: ShieldCheck, group: "Administração" },
  { to: "/app/audit", label: "Auditoria", icon: FileText, group: "Administração" },
  { to: "/app/integrations", label: "Integrações", icon: Plug, group: "Integrações" },
  { to: "/app/message-templates", label: "Templates de Mensagens", icon: MessageSquare, group: "Integrações" },
  { to: "/app/settings", label: "Configurações", icon: Settings, group: "Administração" },
];

const groups = ["Geral", "Emissão", "Cadastros", "Layouts", "Administração", "Integrações"] as const;

export function AppShell({ children }: { children: ReactNode }) {
  const { user, signOut } = useAuth();
  const navigate = useNavigate();
  const path = useRouterState({ select: (s) => s.location.pathname });

  const [collapsed, setCollapsed] = useState<boolean>(() => {
    if (typeof window === "undefined") return false;
    return window.localStorage.getItem("sidebar:collapsed") === "1";
  });
  const [mobileOpen, setMobileOpen] = useState(false);

  useEffect(() => {
    if (typeof window !== "undefined") {
      window.localStorage.setItem("sidebar:collapsed", collapsed ? "1" : "0");
    }
  }, [collapsed]);

  // close mobile drawer on route change
  useEffect(() => { setMobileOpen(false); }, [path]);

  // which group contains the current active route
  const activeGroup = (() => {
    const match = nav.find((i) => (i.exact ? path === i.to : path.startsWith(i.to)));
    return match?.group;
  })();

  const [openGroups, setOpenGroups] = useState<Record<string, boolean>>(() => {
    let saved: Record<string, boolean> = {};
    if (typeof window !== "undefined") {
      try {
        const raw = window.sessionStorage.getItem("sidebar:openGroups");
        if (raw) saved = JSON.parse(raw);
      } catch {}
    }
    const init: Record<string, boolean> = {};
    // Default: grupos iniciam recolhidos. O efeito abaixo abre apenas o grupo
    // que contém a rota ativa. Preferências salvas pelo próprio usuário são respeitadas.
    groups.forEach((g) => { init[g] = saved[g] ?? false; });
    return init;
  });

  // auto-open the group containing the active route
  useEffect(() => {
    if (activeGroup) {
      setOpenGroups((prev) => (prev[activeGroup] ? prev : { ...prev, [activeGroup]: true }));
    }
  }, [activeGroup]);

  useEffect(() => {
    if (typeof window !== "undefined") {
      try { window.sessionStorage.setItem("sidebar:openGroups", JSON.stringify(openGroups)); } catch {}
    }
  }, [openGroups]);

  const toggleGroup = (g: string) => setOpenGroups((p) => ({ ...p, [g]: !p[g] }));

  async function handleSignOut() {
    await signOut();
    navigate({ to: "/auth", replace: true });
  }

  const renderNav = (isCollapsed: boolean) => (
    <nav className="flex-1 p-3 space-y-2 overflow-y-auto">
      {groups.map((g) => {
        const items = nav.filter((i) => i.group === g);
        if (items.length === 0) return null;
        const isOpen = isCollapsed ? true : !!openGroups[g];
        return (
          <div key={g} className="space-y-1">
            {!isCollapsed ? (
              <button
                type="button"
                onClick={() => toggleGroup(g)}
                aria-expanded={isOpen}
                className="w-full flex items-center justify-between px-3 pt-1 pb-1 text-[11px] uppercase tracking-wider text-muted-foreground font-semibold hover:text-foreground transition-colors"
              >
                <span>{g}</span>
                <ChevronDown className={cn("size-3 transition-transform", isOpen ? "rotate-0" : "-rotate-90")} />
              </button>
            ) : (
              <div className="h-px bg-sidebar-border/60 mx-2 my-1" aria-hidden />
            )}
            {isOpen && items.map((item) => {
              const active = item.exact ? path === item.to : path.startsWith(item.to);
              return (
                <Link
                  key={item.to}
                  to={item.to}
                  title={isCollapsed ? item.label : undefined}
                  className={cn(
                    "flex items-center gap-3 rounded-md px-3 py-2 text-sm font-medium transition-colors",
                    isCollapsed && "justify-center px-2",
                    active
                      ? "bg-sidebar-accent text-sidebar-accent-foreground"
                      : "text-sidebar-foreground/80 hover:bg-sidebar-accent hover:text-sidebar-accent-foreground",
                  )}
                >
                  <item.icon className="size-4 shrink-0" />
                  {!isCollapsed && <span className="truncate">{item.label}</span>}
                </Link>
              );
            })}
          </div>
        );
      })}
    </nav>
  );

  return (
    <div className="min-h-screen flex bg-muted/30">
      {/* Desktop sidebar */}
      <aside
        className={cn(
          "hidden md:flex flex-col border-r border-sidebar-border bg-sidebar text-sidebar-foreground transition-[width] duration-200",
          collapsed ? "w-16" : "w-64",
        )}
      >
        <div className={cn("h-16 flex items-center gap-2 border-b border-sidebar-border", collapsed ? "px-2 justify-center" : "px-5")}>
          <div className="size-9 rounded-md bg-primary text-primary-foreground grid place-items-center shrink-0">
            <Tag className="size-5" />
          </div>
          {!collapsed && (
            <div className="leading-tight min-w-0">
              <div className="font-semibold truncate">Etiquetas</div>
              <div className="text-xs text-muted-foreground truncate">Painel admin</div>
            </div>
          )}
        </div>
        {renderNav(collapsed)}
        <div className="shrink-0 p-3">
          <Button
            variant="outline"
            size="sm"
            className={cn("w-full gap-2", collapsed ? "justify-center px-0" : "justify-start")}
            onClick={handleSignOut}
            title={collapsed ? "Sair" : undefined}
          >
            <LogOut className="size-4" /> {!collapsed && "Sair"}
          </Button>
        </div>
        <div className="shrink-0 border-t border-sidebar-border p-3 space-y-2">
          {!collapsed && (
            <div className="px-2 text-xs text-muted-foreground truncate">{user?.email}</div>
          )}
          <Button
            variant="ghost"
            size="sm"
            className={cn("w-full gap-2", collapsed ? "justify-center px-0" : "justify-start")}
            onClick={() => setCollapsed((v) => !v)}
            title={collapsed ? "Expandir menu" : "Recolher menu"}
            aria-label={collapsed ? "Expandir menu" : "Recolher menu"}
          >
            {collapsed ? <PanelLeftOpen className="size-4" /> : <><PanelLeftClose className="size-4" /> Recolher</>}
          </Button>
        </div>
      </aside>

      {/* Mobile drawer */}
      {mobileOpen && (
        <div className="md:hidden fixed inset-0 z-40">
          <div className="absolute inset-0 bg-black/40" onClick={() => setMobileOpen(false)} />
          <aside className="absolute inset-y-0 left-0 w-64 flex flex-col border-r border-sidebar-border bg-sidebar text-sidebar-foreground">
            <div className="h-16 flex items-center gap-2 px-5 border-b border-sidebar-border">
              <div className="size-9 rounded-md bg-primary text-primary-foreground grid place-items-center">
                <Tag className="size-5" />
              </div>
              <div className="leading-tight">
                <div className="font-semibold">Etiquetas</div>
                <div className="text-xs text-muted-foreground">Painel admin</div>
              </div>
            </div>
            {renderNav(false)}
            <div className="shrink-0 p-3">
              <Button variant="outline" size="sm" className="w-full justify-start gap-2" onClick={handleSignOut}>
                <LogOut className="size-4" /> Sair
              </Button>
            </div>
            <div className="shrink-0 border-t border-sidebar-border p-3">
              <div className="px-2 pb-2 text-xs text-muted-foreground truncate">{user?.email}</div>
            </div>
          </aside>
        </div>
      )}

      <div className="flex-1 flex flex-col min-w-0">
        <header className="h-14 flex items-center justify-between gap-2 border-b bg-background px-4 md:px-6">
          <Button
            variant="ghost"
            size="sm"
            className="md:hidden"
            onClick={() => setMobileOpen(true)}
            aria-label="Abrir menu"
          >
            <Menu className="size-5" />
          </Button>
          <div className="md:hidden flex items-center gap-2 font-semibold">
            <Tag className="size-5 text-primary" /> Etiquetas
          </div>
          <div className="flex-1 flex justify-end md:justify-start">
            <CompanySwitcher />
          </div>
          <Button variant="ghost" size="sm" className="md:hidden" onClick={handleSignOut} aria-label="Sair">
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
