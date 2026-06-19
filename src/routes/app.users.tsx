import { createFileRoute } from "@tanstack/react-router";
import { useMemo, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { toast } from "sonner";
import { UserPlus, KeyRound, Power, PowerOff, Copy } from "lucide-react";
import {
  Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle, DialogTrigger,
} from "@/components/ui/dialog";
import { useUserCompanies, type AppRole } from "@/hooks/use-user-companies";
import {
  adminListUsers, adminCreateUser, adminResetPassword, adminSetStatus, adminChangeRole,
} from "@/lib/admin-users.functions";

const ROLES: AppRole[] = ["administrador", "supervisor", "operador", "consulta"];
const ROLE_LABEL: Record<AppRole, string> = {
  administrador: "Administrador",
  supervisor: "Supervisor",
  operador: "Operador",
  consulta: "Consulta",
};

export const Route = createFileRoute("/app/users")({
  head: () => ({ meta: [{ title: "Usuários — Etiquetas" }] }),
  component: UsersPage,
});

function UsersPage() {
  const qc = useQueryClient();
  const { data: companies } = useUserCompanies();
  const manageable = useMemo(() => (companies ?? []).filter((c) => c.role === "administrador"), [companies]);
  const [companyId, setCompanyId] = useState<string>("");
  if (!companyId && manageable.length) setCompanyId(manageable[0].company_id);

  const listFn = useServerFn(adminListUsers);
  const createFn = useServerFn(adminCreateUser);
  const resetFn = useServerFn(adminResetPassword);
  const statusFn = useServerFn(adminSetStatus);
  const roleFn = useServerFn(adminChangeRole);

  const { data: members, isLoading } = useQuery({
    queryKey: ["admin-users", companyId],
    enabled: !!companyId,
    queryFn: () => listFn({ data: { companyId } }),
  });

  const [addOpen, setAddOpen] = useState(false);
  const [addEmail, setAddEmail] = useState("");
  const [addName, setAddName] = useState("");
  const [addRole, setAddRole] = useState<AppRole>("operador");
  const [recoveryLink, setRecoveryLink] = useState<string | null>(null);

  const createMut = useMutation({
    mutationFn: () => createFn({ data: { companyId, email: addEmail, fullName: addName, role: addRole } }),
    onSuccess: (res: any) => {
      toast.success("Usuário criado");
      setAddOpen(false); setAddEmail(""); setAddName(""); setAddRole("operador");
      if (res.recoveryLink) setRecoveryLink(res.recoveryLink);
      qc.invalidateQueries({ queryKey: ["admin-users"] });
    },
    onError: (e: any) => toast.error("Erro ao criar", { description: e.message }),
  });

  const resetMut = useMutation({
    mutationFn: (userId: string) => resetFn({ data: { companyId, userId } }),
    onSuccess: (res: any) => {
      if (res.recoveryLink) setRecoveryLink(res.recoveryLink);
      toast.success("Link de redefinição gerado");
    },
    onError: (e: any) => toast.error("Erro", { description: e.message }),
  });

  const statusMut = useMutation({
    mutationFn: ({ userId, status }: { userId: string; status: "ativo" | "inativo" }) =>
      statusFn({ data: { companyId, userId, status } }),
    onSuccess: () => {
      toast.success("Status atualizado");
      qc.invalidateQueries({ queryKey: ["admin-users"] });
    },
    onError: (e: any) => toast.error("Erro", { description: e.message }),
  });

  const roleMut = useMutation({
    mutationFn: ({ userId, newRole }: { userId: string; newRole: AppRole }) =>
      roleFn({ data: { companyId, userId, newRole } }),
    onSuccess: () => {
      toast.success("Perfil alterado");
      qc.invalidateQueries({ queryKey: ["admin-users"] });
    },
    onError: (e: any) => toast.error("Erro", { description: e.message }),
  });

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold">Usuários</h1>
        <p className="text-muted-foreground">Crie, edite, ative/inative e gerencie perfis de acesso.</p>
      </div>

      {manageable.length === 0 ? (
        <Card><CardHeader>
          <CardTitle>Sem privilégios de administrador</CardTitle>
          <CardDescription>Apenas administradores podem gerenciar usuários.</CardDescription>
        </CardHeader></Card>
      ) : (
        <>
          <div className="flex flex-wrap items-end gap-3">
            <div className="space-y-1.5 min-w-64">
              <Label>Empresa</Label>
              <Select value={companyId} onValueChange={setCompanyId}>
                <SelectTrigger><SelectValue placeholder="Selecione" /></SelectTrigger>
                <SelectContent>
                  {manageable.map((c) => (
                    <SelectItem key={c.company_id} value={c.company_id}>{c.company_name}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <Dialog open={addOpen} onOpenChange={setAddOpen}>
              <DialogTrigger asChild>
                <Button disabled={!companyId}><UserPlus className="size-4" /> Novo usuário</Button>
              </DialogTrigger>
              <DialogContent>
                <DialogHeader>
                  <DialogTitle>Criar novo usuário</DialogTitle>
                  <DialogDescription>
                    Um link seguro de definição de senha será exibido <strong>uma única vez</strong> ao concluir.
                    Repasse-o ao usuário por canal seguro. Nenhuma senha é armazenada no sistema.
                  </DialogDescription>
                </DialogHeader>
                <div className="space-y-3">
                  <div className="space-y-1.5">
                    <Label>Nome completo</Label>
                    <Input value={addName} onChange={(e) => setAddName(e.target.value)} placeholder="Maria Silva" />
                  </div>
                  <div className="space-y-1.5">
                    <Label>E-mail</Label>
                    <Input type="email" value={addEmail} onChange={(e) => setAddEmail(e.target.value)} placeholder="usuario@dominio.com" />
                  </div>
                  <div className="space-y-1.5">
                    <Label>Perfil de acesso</Label>
                    <Select value={addRole} onValueChange={(v) => setAddRole(v as AppRole)}>
                      <SelectTrigger><SelectValue /></SelectTrigger>
                      <SelectContent>
                        {ROLES.map((r) => <SelectItem key={r} value={r}>{ROLE_LABEL[r]}</SelectItem>)}
                      </SelectContent>
                    </Select>
                  </div>
                </div>
                <DialogFooter>
                  <Button
                    onClick={() => createMut.mutate()}
                    disabled={!addEmail || !addName || createMut.isPending}
                  >
                    {createMut.isPending ? "Criando…" : "Criar usuário"}
                  </Button>
                </DialogFooter>
              </DialogContent>
            </Dialog>
          </div>

          {recoveryLink && (
            <Card className="border-amber-500/50">
              <CardHeader>
                <CardTitle className="text-base">Link de definição de senha</CardTitle>
                <CardDescription>
                  Exibido apenas agora. Copie e envie ao usuário por canal seguro.
                </CardDescription>
              </CardHeader>
              <CardContent>
                <div className="flex gap-2">
                  <input readOnly value={recoveryLink}
                    className="flex-1 rounded border px-2 py-1 text-xs font-mono bg-muted"
                    onFocus={(e) => e.currentTarget.select()} />
                  <Button size="sm" variant="outline" onClick={() => {
                    navigator.clipboard.writeText(recoveryLink); toast.success("Copiado");
                  }}><Copy className="size-4" /></Button>
                  <Button size="sm" variant="ghost" onClick={() => setRecoveryLink(null)}>Fechar</Button>
                </div>
              </CardContent>
            </Card>
          )}

          <Card>
            <CardHeader>
              <CardTitle>Usuários da empresa</CardTitle>
              <CardDescription>Perfil, status, criação e último acesso.</CardDescription>
            </CardHeader>
            <CardContent>
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Usuário</TableHead>
                    <TableHead>Perfil</TableHead>
                    <TableHead>Status</TableHead>
                    <TableHead>Criado</TableHead>
                    <TableHead>Último acesso</TableHead>
                    <TableHead className="text-right">Ações</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {isLoading && <TableRow><TableCell colSpan={6} className="text-muted-foreground">Carregando…</TableCell></TableRow>}
                  {!isLoading && members?.length === 0 && (
                    <TableRow><TableCell colSpan={6} className="text-muted-foreground">Nenhum usuário.</TableCell></TableRow>
                  )}
                  {members?.map((m) => (
                    <TableRow key={m.link_id}>
                      <TableCell>
                        <div className="font-medium">{m.full_name || m.email || m.user_id}</div>
                        <div className="text-xs text-muted-foreground">{m.email}</div>
                      </TableCell>
                      <TableCell>
                        <Select
                          value={m.role}
                          onValueChange={(v) => {
                            if (!confirm(`Alterar perfil para ${ROLE_LABEL[v as AppRole]}?`)) return;
                            roleMut.mutate({ userId: m.user_id, newRole: v as AppRole });
                          }}
                        >
                          <SelectTrigger className="h-8 w-36"><SelectValue /></SelectTrigger>
                          <SelectContent>
                            {ROLES.map((r) => <SelectItem key={r} value={r}>{ROLE_LABEL[r]}</SelectItem>)}
                          </SelectContent>
                        </Select>
                      </TableCell>
                      <TableCell>
                        <Badge variant={m.status === "ativo" ? "default" : "outline"} className="capitalize">
                          {m.status}
                        </Badge>
                      </TableCell>
                      <TableCell className="text-xs text-muted-foreground">
                        {m.created_at ? new Date(m.created_at).toLocaleDateString("pt-BR") : "—"}
                      </TableCell>
                      <TableCell className="text-xs text-muted-foreground">
                        {m.last_sign_in_at ? new Date(m.last_sign_in_at).toLocaleString("pt-BR") : "Nunca"}
                      </TableCell>
                      <TableCell className="text-right">
                        <Button variant="ghost" size="sm" title="Enviar redefinição de senha"
                          onClick={() => resetMut.mutate(m.user_id)} disabled={resetMut.isPending}>
                          <KeyRound className="size-4" />
                        </Button>
                        {m.status === "ativo" ? (
                          <Button variant="ghost" size="sm" title="Inativar"
                            onClick={() => {
                              if (!confirm("Inativar este usuário?")) return;
                              statusMut.mutate({ userId: m.user_id, status: "inativo" });
                            }}>
                            <PowerOff className="size-4 text-destructive" />
                          </Button>
                        ) : (
                          <Button variant="ghost" size="sm" title="Reativar"
                            onClick={() => statusMut.mutate({ userId: m.user_id, status: "ativo" })}>
                            <Power className="size-4" />
                          </Button>
                        )}
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </CardContent>
          </Card>
        </>
      )}
    </div>
  );
}
