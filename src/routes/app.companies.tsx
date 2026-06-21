import { createFileRoute } from "@tanstack/react-router";
import { useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import {
  Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle, DialogTrigger,
} from "@/components/ui/dialog";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent,
  AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { toast } from "sonner";
import { Plus, Pencil, Power, PowerOff } from "lucide-react";

export const Route = createFileRoute("/app/companies")({
  head: () => ({ meta: [{ title: "Empresas — Etiquetas" }] }),
  component: CompaniesPage,
});

type CompanyForm = { name: string; legal_name: string; tax_id: string; email: string; phone: string };
const EMPTY_FORM: CompanyForm = { name: "", legal_name: "", tax_id: "", email: "", phone: "" };

function CompaniesPage() {
  const qc = useQueryClient();
  const [open, setOpen] = useState(false);
  const [editOpen, setEditOpen] = useState(false);
  const [editing, setEditing] = useState<any | null>(null);
  const [form, setForm] = useState<CompanyForm>(EMPTY_FORM);
  const [editForm, setEditForm] = useState<CompanyForm>(EMPTY_FORM);
  const [statusTarget, setStatusTarget] = useState<any | null>(null);

  const { data, isLoading } = useQuery({
    queryKey: ["companies"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("companies").select("*").order("created_at", { ascending: false });
      if (error) throw error;
      return data;
    },
  });

  const { data: adminCompanyIds } = useQuery({
    queryKey: ["my-admin-company-ids"],
    queryFn: async () => {
      const { data: u } = await supabase.auth.getUser();
      if (!u.user) return [] as string[];
      const { data, error } = await supabase
        .from("user_company_roles")
        .select("company_id")
        .eq("user_id", u.user.id)
        .eq("role", "administrador");
      if (error) throw error;
      return (data ?? []).map((r: any) => r.company_id as string);
    },
  });
  const isAdmin = (adminCompanyIds?.length ?? 0) > 0;
  const canEditCompany = (id: string) => !!adminCompanyIds?.includes(id);

  const updateMut = useMutation({
    mutationFn: async () => {
      if (!editing) throw new Error("Sem registro");
      const payload = {
        name: editForm.name.trim(),
        legal_name: editForm.legal_name.trim() || null,
        tax_id: editForm.tax_id.trim() || null,
        email: editForm.email.trim() || null,
        phone: editForm.phone.trim() || null,
      };
      if (!payload.name) throw new Error("Nome fantasia é obrigatório");
      const { error } = await supabase.from("companies").update(payload).eq("id", editing.id);
      if (error) throw error;
    },
    onSuccess: () => {
      toast.success("Empresa atualizada");
      setEditOpen(false);
      setEditing(null);
      qc.invalidateQueries({ queryKey: ["companies"] });
      qc.invalidateQueries({ queryKey: ["user-companies"] });
    },
    onError: (e: any) => toast.error("Erro ao atualizar empresa", { description: e.message }),
  });

  const toggleStatusMut = useMutation({
    mutationFn: async (row: any) => {
      const next = row.status === "ativo" ? "inativo" : "ativo";
      const { error } = await supabase.from("companies").update({ status: next }).eq("id", row.id);
      if (error) throw error;
      return next;
    },
    onSuccess: (next) => {
      toast.success(next === "ativo" ? "Empresa ativada" : "Empresa inativada");
      setStatusTarget(null);
      qc.invalidateQueries({ queryKey: ["companies"] });
      qc.invalidateQueries({ queryKey: ["user-companies"] });
    },
    onError: (e: any) => toast.error("Erro ao alterar status", { description: e.message }),
  });

  function openEdit(c: any) {
    setEditing(c);
    setEditForm({
      name: c.name ?? "",
      legal_name: c.legal_name ?? "",
      tax_id: c.tax_id ?? "",
      email: c.email ?? "",
      phone: c.phone ?? "",
    });
    setEditOpen(true);
  }

  const createMut = useMutation({
    mutationFn: async () => {
      const { data, error } = await supabase.rpc("create_company_with_admin", {
        _name: form.name,
        _legal_name: form.legal_name || undefined,
        _tax_id: form.tax_id || undefined,
        _email: form.email || undefined,
        _phone: form.phone || undefined,
      });
      if (error) {
        const msg = error.message?.includes("forbidden")
          ? "Você não tem permissão para criar empresas (requer perfil administrador)."
          : error.message?.includes("not_authenticated")
            ? "Sessão expirada. Entre novamente."
            : error.message;
        throw new Error(msg);
      }
      return data;
    },
    onSuccess: () => {
      toast.success("Empresa criada");
      setOpen(false);
      setForm({ name: "", legal_name: "", tax_id: "", email: "", phone: "" });
      qc.invalidateQueries({ queryKey: ["companies"] });
      qc.invalidateQueries({ queryKey: ["user-companies"] });
    },
    onError: (e: any) => toast.error("Erro ao criar empresa", { description: e.message }),
  });

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between gap-4 flex-wrap">
        <div>
          <h1 className="text-2xl font-bold">Empresas</h1>
          <p className="text-muted-foreground">Empresas (matriz) às quais você tem acesso.</p>
        </div>
        {isAdmin && (
          <Dialog open={open} onOpenChange={setOpen}>
            <DialogTrigger asChild>
              <Button><Plus className="size-4" /> Nova empresa</Button>
            </DialogTrigger>
            <DialogContent>
              <DialogHeader>
                <DialogTitle>Nova empresa</DialogTitle>
                <DialogDescription>
                  Apenas Administradores podem cadastrar empresas. Depois de criada, atribua o perfil dos demais usuários em Usuários.
                </DialogDescription>
              </DialogHeader>
            <form onSubmit={(e) => { e.preventDefault(); createMut.mutate(); }} className="space-y-3">
              <Field label="Nome fantasia *">
                <Input required value={form.name} onChange={(e) => setForm((f) => ({ ...f, name: e.target.value }))} />
              </Field>
              <Field label="Razão social">
                <Input value={form.legal_name} onChange={(e) => setForm((f) => ({ ...f, legal_name: e.target.value }))} />
              </Field>
              <Field label="CNPJ">
                <Input value={form.tax_id} onChange={(e) => setForm((f) => ({ ...f, tax_id: e.target.value }))} />
              </Field>
              <div className="grid grid-cols-2 gap-3">
                <Field label="E-mail">
                  <Input type="email" value={form.email} onChange={(e) => setForm((f) => ({ ...f, email: e.target.value }))} />
                </Field>
                <Field label="Telefone">
                  <Input value={form.phone} onChange={(e) => setForm((f) => ({ ...f, phone: e.target.value }))} />
                </Field>
              </div>
              <DialogFooter>
                <Button type="submit" disabled={createMut.isPending}>
                  {createMut.isPending ? "Salvando…" : "Criar empresa"}
                </Button>
              </DialogFooter>
            </form>
            </DialogContent>
          </Dialog>
        )}
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Lista de empresas</CardTitle>
          <CardDescription>RLS aplica filtro automático por vínculo do usuário.</CardDescription>
        </CardHeader>
        <CardContent>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Nome</TableHead>
                <TableHead>CNPJ</TableHead>
                <TableHead>Status</TableHead>
                <TableHead>Criada em</TableHead>
                <TableHead className="text-right">Ações</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {isLoading && (
                <TableRow><TableCell colSpan={5} className="text-muted-foreground">Carregando…</TableCell></TableRow>
              )}
              {!isLoading && data?.length === 0 && (
                <TableRow><TableCell colSpan={5} className="text-muted-foreground">Nenhuma empresa visível.</TableCell></TableRow>
              )}
              {data?.map((c: any) => (
                <TableRow key={c.id}>
                  <TableCell>
                    <div className="font-medium">{c.name}</div>
                    {c.legal_name && <div className="text-xs text-muted-foreground">{c.legal_name}</div>}
                  </TableCell>
                  <TableCell className="font-mono text-sm">{c.tax_id ?? "—"}</TableCell>
                  <TableCell><Badge variant="secondary" className="capitalize">{c.status}</Badge></TableCell>
                  <TableCell className="text-sm text-muted-foreground">
                    {new Date(c.created_at).toLocaleDateString("pt-BR")}
                  </TableCell>
                  <TableCell className="text-right">
                    {canEditCompany(c.id) ? (
                      <Button size="sm" variant="ghost" onClick={() => openEdit(c)} aria-label="Editar empresa">
                        <Pencil className="size-4" />
                      </Button>
                    ) : (
                      <span className="text-xs text-muted-foreground">—</span>
                    )}
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </CardContent>
      </Card>

      <Dialog open={editOpen} onOpenChange={(o) => { setEditOpen(o); if (!o) setEditing(null); }}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Editar empresa</DialogTitle>
            <DialogDescription>
              Atualiza os dados cadastrais da empresa. Vínculos de usuários e perfis não são alterados aqui.
            </DialogDescription>
          </DialogHeader>
          <form onSubmit={(e) => { e.preventDefault(); updateMut.mutate(); }} className="space-y-3">
            <Field label="Nome fantasia *">
              <Input required value={editForm.name} onChange={(e) => setEditForm((f) => ({ ...f, name: e.target.value }))} />
            </Field>
            <Field label="Razão social">
              <Input value={editForm.legal_name} onChange={(e) => setEditForm((f) => ({ ...f, legal_name: e.target.value }))} />
            </Field>
            <Field label="CNPJ">
              <Input value={editForm.tax_id} onChange={(e) => setEditForm((f) => ({ ...f, tax_id: e.target.value }))} />
            </Field>
            <div className="grid grid-cols-2 gap-3">
              <Field label="E-mail">
                <Input type="email" value={editForm.email} onChange={(e) => setEditForm((f) => ({ ...f, email: e.target.value }))} />
              </Field>
              <Field label="Telefone">
                <Input value={editForm.phone} onChange={(e) => setEditForm((f) => ({ ...f, phone: e.target.value }))} />
              </Field>
            </div>
            <DialogFooter>
              <Button type="button" variant="outline" onClick={() => setEditOpen(false)}>Cancelar</Button>
              <Button type="submit" disabled={updateMut.isPending}>
                {updateMut.isPending ? "Salvando…" : "Salvar alterações"}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>
    </div>
  );
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return <div className="space-y-1.5"><Label>{label}</Label>{children}</div>;
}
