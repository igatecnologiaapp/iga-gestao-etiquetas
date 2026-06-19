import { createFileRoute } from "@tanstack/react-router";
import { useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import {
  Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle, DialogTrigger,
} from "@/components/ui/dialog";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { toast } from "sonner";
import { Plus } from "lucide-react";
import { useUserCompanies } from "@/hooks/use-user-companies";

export const Route = createFileRoute("/_authenticated/branches")({
  head: () => ({ meta: [{ title: "Filiais — Etiquetas" }] }),
  component: BranchesPage,
});

function BranchesPage() {
  const qc = useQueryClient();
  const { data: companies } = useUserCompanies();
  const [companyFilter, setCompanyFilter] = useState<string>("all");
  const [open, setOpen] = useState(false);
  const [form, setForm] = useState({
    company_id: "", name: "", code: "", address: "", city: "", state: "",
  });

  const { data: branches, isLoading } = useQuery({
    queryKey: ["branches", companyFilter],
    queryFn: async () => {
      let q = supabase.from("branches").select("*, companies(name)").order("created_at", { ascending: false });
      if (companyFilter !== "all") q = q.eq("company_id", companyFilter);
      const { data, error } = await q;
      if (error) throw error;
      return data;
    },
  });

  const createMut = useMutation({
    mutationFn: async () => {
      const { data: userRes } = await supabase.auth.getUser();
      const { error } = await supabase.from("branches").insert({
        company_id: form.company_id,
        name: form.name,
        code: form.code || null,
        address: form.address || null,
        city: form.city || null,
        state: form.state || null,
        created_by: userRes.user!.id,
      });
      if (error) throw error;
    },
    onSuccess: () => {
      toast.success("Filial criada");
      setOpen(false);
      setForm({ company_id: "", name: "", code: "", address: "", city: "", state: "" });
      qc.invalidateQueries({ queryKey: ["branches"] });
    },
    onError: (e: any) => toast.error("Erro ao criar filial", { description: e.message }),
  });

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold">Filiais</h1>
          <p className="text-muted-foreground">Gerencie unidades operacionais por empresa.</p>
        </div>
        <div className="flex items-center gap-2">
          <Select value={companyFilter} onValueChange={setCompanyFilter}>
            <SelectTrigger className="w-56"><SelectValue placeholder="Filtrar por empresa" /></SelectTrigger>
            <SelectContent>
              <SelectItem value="all">Todas as empresas</SelectItem>
              {companies?.map((c) => (
                <SelectItem key={c.company_id} value={c.company_id}>{c.company_name}</SelectItem>
              ))}
            </SelectContent>
          </Select>
          <Dialog open={open} onOpenChange={setOpen}>
            <DialogTrigger asChild>
              <Button><Plus className="size-4" /> Nova filial</Button>
            </DialogTrigger>
            <DialogContent>
              <DialogHeader><DialogTitle>Nova filial</DialogTitle></DialogHeader>
              <form
                className="space-y-3"
                onSubmit={(e) => { e.preventDefault(); createMut.mutate(); }}
              >
                <div className="space-y-1.5">
                  <Label>Empresa *</Label>
                  <Select value={form.company_id} onValueChange={(v) => setForm((f) => ({ ...f, company_id: v }))}>
                    <SelectTrigger><SelectValue placeholder="Selecione" /></SelectTrigger>
                    <SelectContent>
                      {companies?.filter((c) => c.role === "administrador" || c.role === "supervisor").map((c) => (
                        <SelectItem key={c.company_id} value={c.company_id}>{c.company_name}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <div className="grid grid-cols-2 gap-3">
                  <Field label="Nome *"><Input required value={form.name} onChange={(e) => setForm((f) => ({ ...f, name: e.target.value }))} /></Field>
                  <Field label="Código"><Input value={form.code} onChange={(e) => setForm((f) => ({ ...f, code: e.target.value }))} /></Field>
                </div>
                <Field label="Endereço"><Input value={form.address} onChange={(e) => setForm((f) => ({ ...f, address: e.target.value }))} /></Field>
                <div className="grid grid-cols-2 gap-3">
                  <Field label="Cidade"><Input value={form.city} onChange={(e) => setForm((f) => ({ ...f, city: e.target.value }))} /></Field>
                  <Field label="UF"><Input maxLength={2} value={form.state} onChange={(e) => setForm((f) => ({ ...f, state: e.target.value.toUpperCase() }))} /></Field>
                </div>
                <DialogFooter>
                  <Button type="submit" disabled={createMut.isPending || !form.company_id}>
                    {createMut.isPending ? "Salvando…" : "Criar filial"}
                  </Button>
                </DialogFooter>
              </form>
            </DialogContent>
          </Dialog>
        </div>
      </div>

      <Card>
        <CardHeader><CardTitle>Lista de filiais</CardTitle><CardDescription>RLS limita a visualização às empresas vinculadas.</CardDescription></CardHeader>
        <CardContent>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Empresa</TableHead>
                <TableHead>Filial</TableHead>
                <TableHead>Código</TableHead>
                <TableHead>Cidade/UF</TableHead>
                <TableHead>Status</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {isLoading && <TableRow><TableCell colSpan={5} className="text-muted-foreground">Carregando…</TableCell></TableRow>}
              {!isLoading && branches?.length === 0 && (
                <TableRow><TableCell colSpan={5} className="text-muted-foreground">Nenhuma filial encontrada.</TableCell></TableRow>
              )}
              {branches?.map((b: any) => (
                <TableRow key={b.id}>
                  <TableCell>{b.companies?.name}</TableCell>
                  <TableCell className="font-medium">{b.name}</TableCell>
                  <TableCell className="font-mono text-sm">{b.code ?? "—"}</TableCell>
                  <TableCell>{[b.city, b.state].filter(Boolean).join("/") || "—"}</TableCell>
                  <TableCell><Badge variant="secondary" className="capitalize">{b.status}</Badge></TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </CardContent>
      </Card>
    </div>
  );
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return <div className="space-y-1.5"><Label>{label}</Label>{children}</div>;
}
