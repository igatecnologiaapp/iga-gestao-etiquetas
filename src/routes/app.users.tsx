import { createFileRoute } from "@tanstack/react-router";
import { useMemo, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Label } from "@/components/ui/label";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { toast } from "sonner";
import { Trash2, UserPlus } from "lucide-react";
import {
  Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle, DialogTrigger,
} from "@/components/ui/dialog";
import { useUserCompanies, type AppRole } from "@/hooks/use-user-companies";

const ROLES: AppRole[] = ["administrador", "supervisor", "operador", "consulta"];

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

  const { data: members, isLoading } = useQuery({
    queryKey: ["company-members", companyId],
    enabled: !!companyId,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("user_company_roles")
        .select("id, role, user_id, created_at, user_profiles(full_name, email, status)")
        .eq("company_id", companyId)
        .order("created_at", { ascending: true });
      if (error) throw error;
      return data;
    },
  });

  const { data: profiles } = useQuery({
    queryKey: ["all-profiles"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("user_profiles").select("id, email, full_name").order("email");
      if (error) throw error;
      return data;
    },
  });

  const [addOpen, setAddOpen] = useState(false);
  const [addUserId, setAddUserId] = useState<string>("");
  const [addRole, setAddRole] = useState<AppRole>("operador");

  const addMut = useMutation({
    mutationFn: async () => {
      const { data: userRes } = await supabase.auth.getUser();
      const { error } = await supabase.from("user_company_roles").insert({
        user_id: addUserId, company_id: companyId, role: addRole, created_by: userRes.user!.id,
      });
      if (error) throw error;
    },
    onSuccess: () => {
      toast.success("Vínculo criado");
      setAddOpen(false); setAddUserId(""); setAddRole("operador");
      qc.invalidateQueries({ queryKey: ["company-members"] });
    },
    onError: (e: any) => toast.error("Erro ao vincular", { description: e.message }),
  });

  const removeMut = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from("user_company_roles").delete().eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      toast.success("Vínculo removido");
      qc.invalidateQueries({ queryKey: ["company-members"] });
    },
    onError: (e: any) => toast.error("Erro ao remover", { description: e.message }),
  });

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold">Usuários</h1>
        <p className="text-muted-foreground">Gerencie vínculos de usuários e perfis por empresa.</p>
      </div>

      {manageable.length === 0 ? (
        <Card><CardHeader>
          <CardTitle>Sem privilégios de administrador</CardTitle>
          <CardDescription>Apenas Administradores podem gerenciar usuários.</CardDescription>
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
                <Button disabled={!companyId}><UserPlus className="size-4" /> Vincular usuário</Button>
              </DialogTrigger>
              <DialogContent>
                <DialogHeader>
                  <DialogTitle>Vincular usuário à empresa</DialogTitle>
                  <DialogDescription>
                    O usuário deve já existir. Crie a conta na área Cloud do projeto (Users) e selecione aqui.
                  </DialogDescription>
                </DialogHeader>
                <div className="space-y-3">
                  <div className="space-y-1.5">
                    <Label>Usuário</Label>
                    <Select value={addUserId} onValueChange={setAddUserId}>
                      <SelectTrigger><SelectValue placeholder="Selecione" /></SelectTrigger>
                      <SelectContent>
                        {profiles?.map((p: any) => (
                          <SelectItem key={p.id} value={p.id}>{p.email || p.id}</SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                  <div className="space-y-1.5">
                    <Label>Perfil</Label>
                    <Select value={addRole} onValueChange={(v) => setAddRole(v as AppRole)}>
                      <SelectTrigger><SelectValue /></SelectTrigger>
                      <SelectContent>
                        {ROLES.map((r) => <SelectItem key={r} value={r} className="capitalize">{r}</SelectItem>)}
                      </SelectContent>
                    </Select>
                  </div>
                </div>
                <DialogFooter>
                  <Button onClick={() => addMut.mutate()} disabled={!addUserId || addMut.isPending}>
                    {addMut.isPending ? "Salvando…" : "Vincular"}
                  </Button>
                </DialogFooter>
              </DialogContent>
            </Dialog>
          </div>

          <Card>
            <CardHeader>
              <CardTitle>Vínculos da empresa</CardTitle>
              <CardDescription>Usuários com perfil atribuído nesta empresa.</CardDescription>
            </CardHeader>
            <CardContent>
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Usuário</TableHead>
                    <TableHead>Perfil</TableHead>
                    <TableHead>Status</TableHead>
                    <TableHead className="text-right">Ações</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {isLoading && <TableRow><TableCell colSpan={4} className="text-muted-foreground">Carregando…</TableCell></TableRow>}
                  {!isLoading && members?.length === 0 && (
                    <TableRow><TableCell colSpan={4} className="text-muted-foreground">Nenhum vínculo.</TableCell></TableRow>
                  )}
                  {members?.map((m: any) => (
                    <TableRow key={m.id}>
                      <TableCell>
                        <div className="font-medium">{m.user_profiles?.full_name || m.user_profiles?.email || m.user_id}</div>
                        <div className="text-xs text-muted-foreground">{m.user_profiles?.email}</div>
                      </TableCell>
                      <TableCell><Badge variant="secondary" className="capitalize">{m.role}</Badge></TableCell>
                      <TableCell><Badge variant="outline" className="capitalize">{m.user_profiles?.status ?? "—"}</Badge></TableCell>
                      <TableCell className="text-right">
                        <Button variant="ghost" size="sm"
                          onClick={() => { if (confirm("Remover vínculo?")) removeMut.mutate(m.id); }}>
                          <Trash2 className="size-4 text-destructive" />
                        </Button>
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
