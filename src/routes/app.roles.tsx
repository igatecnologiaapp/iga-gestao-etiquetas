import { createFileRoute } from "@tanstack/react-router";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useEffect, useMemo, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/lib/auth-context";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Checkbox } from "@/components/ui/checkbox";
import { Button } from "@/components/ui/button";
import { toast } from "sonner";
import { Loader2, ShieldAlert } from "lucide-react";

const ROLE_DESCRIPTIONS: Record<string, string> = {
  administrador: "Acesso total: configurações, usuários, dados operacionais e auditoria.",
  supervisor: "Gerencia cadastros, aprova revisões e acompanha relatórios.",
  operador: "Executa operações conforme permissões atribuídas.",
  consulta: "Apenas visualização das informações permitidas.",
};

type Role = "administrador" | "supervisor" | "operador" | "consulta";
const ROLES: Role[] = ["administrador", "supervisor", "operador", "consulta"];

// Permissões essenciais que o perfil administrador NUNCA pode perder,
// sob risco de bloquear a gestão do sistema.
const ADMIN_LOCKED_KEYS = new Set(["users.manage", "users.read"]);

export const Route = createFileRoute("/app/roles")({
  head: () => ({ meta: [{ title: "Perfis — Etiquetas" }] }),
  component: RolesPage,
});

function RolesPage() {
  const { user } = useAuth();
  const qc = useQueryClient();

  const { data: isPlatformAdmin, isLoading: loadingAdmin } = useQuery({
    queryKey: ["is-platform-admin", user?.id],
    enabled: !!user?.id,
    queryFn: async () => {
      const { data } = await supabase
        .from("platform_admins")
        .select("user_id")
        .eq("user_id", user!.id)
        .maybeSingle();
      return !!data;
    },
  });

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

  // Estado local da matriz: Map<role, Set<permission_key>>
  const [matrix, setMatrix] = useState<Record<Role, Set<string>>>({
    administrador: new Set(), supervisor: new Set(), operador: new Set(), consulta: new Set(),
  });
  const [dirty, setDirty] = useState(false);

  useEffect(() => {
    if (!data) return;
    const next: Record<Role, Set<string>> = {
      administrador: new Set(), supervisor: new Set(), operador: new Set(), consulta: new Set(),
    };
    for (const rp of data.rolePerms as Array<{ role: Role; permission_key: string }>) {
      next[rp.role]?.add(rp.permission_key);
    }
    setMatrix(next);
    setDirty(false);
  }, [data]);

  const permsByModule = useMemo(() => {
    const map = new Map<string, Array<{ key: string; description: string | null }>>();
    for (const p of (data?.perms ?? []) as Array<{ key: string; module: string; description: string | null }>) {
      if (!map.has(p.module)) map.set(p.module, []);
      map.get(p.module)!.push({ key: p.key, description: p.description });
    }
    return Array.from(map.entries()).sort(([a], [b]) => a.localeCompare(b));
  }, [data]);

  const canEdit = !!isPlatformAdmin;

  function toggle(role: Role, key: string, checked: boolean) {
    if (!canEdit) return;
    if (role === "administrador" && ADMIN_LOCKED_KEYS.has(key) && !checked) {
      toast.error("Esta permissão é essencial para o perfil Administrador e não pode ser removida.");
      return;
    }
    setMatrix((prev) => {
      const set = new Set(prev[role]);
      if (checked) set.add(key); else set.delete(key);
      return { ...prev, [role]: set };
    });
    setDirty(true);
  }

  const saveMut = useMutation({
    mutationFn: async () => {
      // Validação extra: administrador deve manter as essenciais
      for (const k of ADMIN_LOCKED_KEYS) {
        if (!matrix.administrador.has(k)) {
          throw new Error(`Permissão essencial ausente em Administrador: ${k}`);
        }
      }
      const original = new Map<string, Set<string>>();
      for (const r of ROLES) original.set(r, new Set<string>());
      for (const rp of (data?.rolePerms ?? []) as Array<{ role: Role; permission_key: string }>) {
        original.get(rp.role)!.add(rp.permission_key);
      }
      const toInsert: Array<{ role: Role; permission_key: string }> = [];
      const toDelete: Array<{ role: Role; permission_key: string }> = [];
      for (const r of ROLES) {
        const cur = matrix[r];
        const orig = original.get(r)!;
        for (const k of cur) if (!orig.has(k)) toInsert.push({ role: r, permission_key: k });
        for (const k of orig) if (!cur.has(k)) toDelete.push({ role: r, permission_key: k });
      }
      for (const d of toDelete) {
        const { error } = await supabase
          .from("role_permissions")
          .delete()
          .eq("role", d.role)
          .eq("permission_key", d.permission_key);
        if (error) throw error;
      }
      if (toInsert.length) {
        const { error } = await supabase.from("role_permissions").insert(toInsert);
        if (error) throw error;
      }
      return { inserted: toInsert.length, deleted: toDelete.length };
    },
    onSuccess: (res) => {
      toast.success(`Permissões salvas (${res.inserted} adicionadas, ${res.deleted} removidas).`);
      qc.invalidateQueries({ queryKey: ["role-permissions"] });
    },
    onError: (e: any) => toast.error(e?.message ?? "Falha ao salvar permissões."),
  });

  if (loadingAdmin) {
    return <div className="flex items-center gap-2 text-muted-foreground"><Loader2 className="h-4 w-4 animate-spin" /> Carregando…</div>;
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold">Perfis & Permissões</h1>
          <p className="text-muted-foreground">
            {canEdit
              ? "Edite a matriz de permissões por perfil. Alterações afetam todos os usuários do perfil."
              : "Matriz de permissões por perfil (somente leitura — requer Administrador da plataforma)."}
          </p>
        </div>
        {canEdit && (
          <div className="flex gap-2">
            <Button
              variant="outline"
              disabled={!dirty || saveMut.isPending}
              onClick={() => {
                if (!data) return;
                const next: Record<Role, Set<string>> = {
                  administrador: new Set(), supervisor: new Set(), operador: new Set(), consulta: new Set(),
                };
                for (const rp of data.rolePerms as Array<{ role: Role; permission_key: string }>) {
                  next[rp.role]?.add(rp.permission_key);
                }
                setMatrix(next);
                setDirty(false);
              }}
            >
              Desfazer
            </Button>
            <Button onClick={() => saveMut.mutate()} disabled={!dirty || saveMut.isPending}>
              {saveMut.isPending && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
              Salvar alterações
            </Button>
          </div>
        )}
      </div>

      {!canEdit && (
        <Card>
          <CardContent className="flex items-start gap-3 py-4 text-sm">
            <ShieldAlert className="h-5 w-5 text-muted-foreground mt-0.5" />
            <span>Apenas Administradores da plataforma podem alterar a matriz de permissões.</span>
          </CardContent>
        </Card>
      )}

      <div className="grid gap-4 md:grid-cols-2">
        {ROLES.map((r) => (
          <Card key={r}>
            <CardHeader>
              <CardTitle className="capitalize flex items-center gap-2">
                {r} <Badge variant="secondary">app_role</Badge>
              </CardTitle>
              <CardDescription>{ROLE_DESCRIPTIONS[r]}</CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              {isLoading && <p className="text-sm text-muted-foreground">Carregando…</p>}
              {permsByModule.map(([mod, perms]) => (
                <div key={mod}>
                  <div className="text-xs font-semibold uppercase text-muted-foreground mb-2">{mod}</div>
                  <div className="space-y-1.5">
                    {perms.map((p) => {
                      const checked = matrix[r].has(p.key);
                      const locked = r === "administrador" && ADMIN_LOCKED_KEYS.has(p.key);
                      const id = `${r}-${p.key}`;
                      return (
                        <label
                          key={p.key}
                          htmlFor={id}
                          className="flex items-start gap-2 text-sm cursor-pointer"
                          title={p.description ?? undefined}
                        >
                          <Checkbox
                            id={id}
                            checked={checked}
                            disabled={!canEdit || locked}
                            onCheckedChange={(v) => toggle(r, p.key, v === true)}
                          />
                          <span className="leading-tight">
                            <span className="font-mono text-xs">{p.key}</span>
                            {locked && <Badge variant="outline" className="ml-2 text-[10px]">essencial</Badge>}
                            {p.description && (
                              <span className="block text-xs text-muted-foreground">{p.description}</span>
                            )}
                          </span>
                        </label>
                      );
                    })}
                  </div>
                </div>
              ))}
            </CardContent>
          </Card>
        ))}
      </div>
    </div>
  );
}
