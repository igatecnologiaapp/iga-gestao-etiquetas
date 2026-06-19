import { createFileRoute } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";

const ROLE_DESCRIPTIONS: Record<string, string> = {
  administrador: "Acesso total à empresa: configurações, usuários, dados operacionais e auditoria.",
  supervisor: "Gerencia cadastros, aprova revisões e acompanha relatórios.",
  operador: "Executa operações do dia a dia conforme permissões atribuídas.",
  consulta: "Apenas visualização das informações permitidas.",
};

export const Route = createFileRoute("/_authenticated/roles")({
  head: () => ({ meta: [{ title: "Perfis — Etiquetas" }] }),
  component: RolesPage,
});

function RolesPage() {
  const { data, isLoading } = useQuery({
    queryKey: ["role-permissions"],
    queryFn: async () => {
      const [{ data: perms }, { data: rolePerms }] = await Promise.all([
        supabase.from("permissions").select("*").order("module"),
        supabase.from("role_permissions").select("*"),
      ]);
      return { perms: perms ?? [], rolePerms: rolePerms ?? [] };
    },
  });

  const roles: Array<"administrador" | "supervisor" | "operador" | "consulta"> = [
    "administrador", "supervisor", "operador", "consulta",
  ];

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold">Perfis & Permissões</h1>
        <p className="text-muted-foreground">Matriz de permissões por perfil. (Somente leitura nesta fase.)</p>
      </div>

      <div className="grid gap-4 md:grid-cols-2">
        {roles.map((r) => (
          <Card key={r}>
            <CardHeader>
              <CardTitle className="capitalize flex items-center gap-2">
                {r} <Badge variant="secondary">app_role</Badge>
              </CardTitle>
              <CardDescription>{ROLE_DESCRIPTIONS[r]}</CardDescription>
            </CardHeader>
            <CardContent>
              {isLoading && <p className="text-sm text-muted-foreground">Carregando…</p>}
              <div className="flex flex-wrap gap-1.5">
                {data?.rolePerms.filter((rp: any) => rp.role === r).map((rp: any) => {
                  const p = data.perms.find((p: any) => p.key === rp.permission_key);
                  return (
                    <Badge key={rp.permission_key} variant="outline" title={p?.description}>
                      {rp.permission_key}
                    </Badge>
                  );
                })}
              </div>
            </CardContent>
          </Card>
        ))}
      </div>
    </div>
  );
}
