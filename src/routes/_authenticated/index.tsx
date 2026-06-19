import { createFileRoute } from "@tanstack/react-router";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { useUserCompanies } from "@/hooks/use-user-companies";
import { Building2, Store, Users, ShieldCheck, AlertCircle } from "lucide-react";
import { useAuth } from "@/lib/auth-context";

export const Route = createFileRoute("/_authenticated/")({
  head: () => ({ meta: [{ title: "Dashboard — Etiquetas" }] }),
  component: Dashboard,
});

function Dashboard() {
  const { user } = useAuth();
  const { data: memberships, isLoading } = useUserCompanies();

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold tracking-tight">Painel</h1>
        <p className="text-muted-foreground">Bem-vindo, {user?.email}.</p>
      </div>

      {!isLoading && (!memberships || memberships.length === 0) && (
        <Card className="border-warning/40 bg-warning/5">
          <CardHeader className="flex-row items-start gap-3">
            <AlertCircle className="size-5 text-warning mt-0.5" />
            <div>
              <CardTitle className="text-base">Conta sem vínculo a empresa</CardTitle>
              <CardDescription>
                Sua conta de autenticação existe, mas ainda não foi vinculada a nenhuma empresa.
                Solicite a um Administrador que vincule você a uma empresa e atribua seu perfil de acesso.
              </CardDescription>
            </div>
          </CardHeader>
        </Card>
      )}

      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
        <KpiCard icon={Building2} label="Empresas vinculadas" value={memberships?.length ?? 0} />
        <KpiCard icon={ShieldCheck} label="Perfis ativos" value={new Set(memberships?.map((m) => m.role)).size || 0} />
        <KpiCard icon={Store} label="Filiais" value="—" hint="Fase 2" />
        <KpiCard icon={Users} label="Usuários" value="—" hint="Fase 2" />
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Suas empresas e perfis</CardTitle>
          <CardDescription>Empresas às quais você tem acesso e papel atribuído.</CardDescription>
        </CardHeader>
        <CardContent className="space-y-2">
          {isLoading && <p className="text-sm text-muted-foreground">Carregando…</p>}
          {memberships?.map((m) => (
            <div key={`${m.company_id}-${m.role}`} className="flex items-center justify-between rounded-md border p-3">
              <div>
                <div className="font-medium">{m.company_name}</div>
                <div className="text-xs text-muted-foreground font-mono">{m.company_id}</div>
              </div>
              <Badge variant="secondary" className="capitalize">{m.role}</Badge>
            </div>
          ))}
        </CardContent>
      </Card>
    </div>
  );
}

function KpiCard({ icon: Icon, label, value, hint }: { icon: any; label: string; value: number | string; hint?: string }) {
  return (
    <Card>
      <CardContent className="p-5 flex items-center gap-4">
        <div className="size-10 rounded-md bg-primary/10 text-primary grid place-items-center">
          <Icon className="size-5" />
        </div>
        <div>
          <div className="text-sm text-muted-foreground">{label}</div>
          <div className="text-2xl font-semibold leading-tight">{value}</div>
          {hint && <div className="text-xs text-muted-foreground">{hint}</div>}
        </div>
      </CardContent>
    </Card>
  );
}
