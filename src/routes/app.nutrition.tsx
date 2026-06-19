import { createFileRoute } from "@tanstack/react-router";
import { useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useActiveCompany } from "@/hooks/use-active-company";
import { PageHeader } from "@/components/page-header";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card } from "@/components/ui/card";
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { StatusBadge } from "@/components/status-badge";
import { NutritionTable } from "@/components/nutrition-table";
import { Plus, Pencil, Eye, Copy, Search } from "lucide-react";
import { toast } from "sonner";

export const Route = createFileRoute("/app/nutrition")({
  head: () => ({ meta: [{ title: "Informações Nutricionais — Etiquetas" }] }),
  component: NutritionPage,
});

const FIELDS: Array<[string, string, string]> = [
  ["serving_size_g", "Porção (g/ml)", "number"],
  ["serving_household", "Medida caseira", "text"],
  ["servings_per_pack", "Porções/embalagem", "number"],
  ["energy_kcal", "Valor energético (kcal)", "number"],
  ["carbs_g", "Carboidratos (g)", "number"],
  ["total_sugars_g", "Açúcares totais (g)", "number"],
  ["added_sugars_g", "Açúcares adicionados (g)", "number"],
  ["protein_g", "Proteínas (g)", "number"],
  ["total_fat_g", "Gorduras totais (g)", "number"],
  ["saturated_fat_g", "Gorduras saturadas (g)", "number"],
  ["trans_fat_g", "Gorduras trans (g)", "number"],
  ["fiber_g", "Fibra alimentar (g)", "number"],
  ["sodium_mg", "Sódio (mg)", "number"],
  ["responsible", "Responsável", "text"],
  ["notes", "Observações", "text"],
];

const STATUSES = ["vigente", "em_revisao", "substituida", "inativa"] as const;
const PAGE_SIZE = 10;

function emptyForm() {
  const o: any = { name: "", status: "vigente" };
  FIELDS.forEach(([k]) => (o[k] = ""));
  return o;
}

function NutritionPage() {
  const qc = useQueryClient();
  const { companyId, canWrite } = useActiveCompany();
  const [search, setSearch] = useState("");
  const [status, setStatus] = useState("all");
  const [page, setPage] = useState(1);
  const [open, setOpen] = useState(false);
  const [editing, setEditing] = useState<any | null>(null);
  const [form, setForm] = useState<any>(emptyForm());
  const [view, setView] = useState<any | null>(null);

  const { data, isLoading } = useQuery({
    queryKey: ["nutrition", companyId, search, status, page],
    enabled: !!companyId,
    queryFn: async () => {
      let q = supabase.from("nutrition_facts").select("*", { count: "exact" })
        .eq("company_id", companyId!)
        .order("created_at", { ascending: false })
        .range((page - 1) * PAGE_SIZE, page * PAGE_SIZE - 1);
      if (search.trim()) q = q.ilike("name", `%${search.trim()}%`);
      if (status !== "all") q = q.eq("status", status as any);
      const { data, error, count } = await q;
      if (error) throw error;
      return { rows: data, count: count ?? 0 };
    },
  });

  function openCreate(copyFrom?: any) {
    setEditing(null);
    if (copyFrom) {
      const f: any = { ...copyFrom };
      f.name = `${copyFrom.name} (cópia)`;
      f.status = "vigente";
      delete f.id; delete f.created_at; delete f.updated_at; delete f.company_id; delete f.created_by;
      Object.keys(f).forEach((k) => { if (f[k] === null) f[k] = ""; });
      setForm(f);
    } else {
      setForm(emptyForm());
    }
    setOpen(true);
  }
  function openEdit(row: any) {
    setEditing(row);
    const f: any = { name: row.name, status: row.status };
    FIELDS.forEach(([k]) => (f[k] = row[k] ?? ""));
    setForm(f);
    setOpen(true);
  }

  const save = useMutation({
    mutationFn: async () => {
      const payload: any = { company_id: companyId, name: form.name, status: form.status };
      FIELDS.forEach(([k, , type]) => {
        const v = form[k];
        payload[k] = v === "" || v == null ? null : type === "number" ? Number(v) : v;
      });
      if (editing) {
        // Versionamento: ao editar versão vigente para "em revisão", apenas atualiza
        const { error } = await supabase.from("nutrition_facts").update(payload).eq("id", editing.id);
        if (error) throw error;
      } else {
        const { data: u } = await supabase.auth.getUser();
        payload.created_by = u.user?.id;
        payload.data_updated_at = new Date().toISOString();
        const { error } = await supabase.from("nutrition_facts").insert(payload);
        if (error) throw error;
      }
    },
    onSuccess: () => { toast.success("Salvo"); setOpen(false); qc.invalidateQueries({ queryKey: ["nutrition"] }); },
    onError: (e: any) => toast.error("Erro", { description: e.message }),
  });

  const totalPages = Math.max(1, Math.ceil((data?.count ?? 0) / PAGE_SIZE));

  return (
    <>
      <PageHeader title="Informações Nutricionais"
        description="Cadastro versionado de tabelas nutricionais. Para criar uma nova versão, use Duplicar." />
      <Card className="p-4">
        <div className="flex flex-wrap items-center justify-between gap-3 mb-4">
          <div className="flex items-center gap-2">
            <div className="relative max-w-xs">
              <Search className="absolute left-2 top-1/2 -translate-y-1/2 size-4 text-muted-foreground" />
              <Input placeholder="Buscar…" value={search} onChange={(e) => { setSearch(e.target.value); setPage(1); }} className="pl-8" />
            </div>
            <Select value={status} onValueChange={(v) => { setStatus(v); setPage(1); }}>
              <SelectTrigger className="w-[180px]"><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Todos status</SelectItem>
                {STATUSES.map((s) => <SelectItem key={s} value={s}>{s}</SelectItem>)}
              </SelectContent>
            </Select>
          </div>
          {canWrite && <Button onClick={() => openCreate()}><Plus className="size-4 mr-1" /> Nova tabela</Button>}
        </div>

        <div className="rounded-md border overflow-x-auto">
          <Table>
            <TableHeader><TableRow>
              <TableHead>Nome</TableHead><TableHead>Versão</TableHead><TableHead>Status</TableHead>
              <TableHead>Porção</TableHead><TableHead>kcal</TableHead><TableHead className="text-right">Ações</TableHead>
            </TableRow></TableHeader>
            <TableBody>
              {isLoading && <TableRow><TableCell colSpan={6} className="text-center py-8 text-muted-foreground">Carregando…</TableCell></TableRow>}
              {!isLoading && (data?.rows.length ?? 0) === 0 && (
                <TableRow><TableCell colSpan={6} className="text-center py-8 text-muted-foreground">Nenhuma tabela cadastrada.</TableCell></TableRow>
              )}
              {data?.rows.map((row: any) => (
                <TableRow key={row.id}>
                  <TableCell className="font-medium">{row.name}</TableCell>
                  <TableCell>v{row.version}</TableCell>
                  <TableCell><StatusBadge status={row.status} /></TableCell>
                  <TableCell className="text-muted-foreground">{row.serving_size_g ?? "—"} g</TableCell>
                  <TableCell>{row.energy_kcal ?? "—"}</TableCell>
                  <TableCell className="text-right space-x-1">
                    <Button size="sm" variant="ghost" onClick={() => setView(row)}><Eye className="size-4" /></Button>
                    {canWrite && (<>
                      <Button size="sm" variant="ghost" onClick={() => openEdit(row)}><Pencil className="size-4" /></Button>
                      <Button size="sm" variant="ghost" onClick={() => openCreate(row)} title="Duplicar para nova versão"><Copy className="size-4" /></Button>
                    </>)}
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </div>

        <div className="flex items-center justify-between mt-3 text-sm text-muted-foreground">
          <div>{data?.count ?? 0} registro(s)</div>
          <div className="flex items-center gap-2">
            <Button size="sm" variant="outline" disabled={page <= 1} onClick={() => setPage(page - 1)}>Anterior</Button>
            <span>Página {page} de {totalPages}</span>
            <Button size="sm" variant="outline" disabled={page >= totalPages} onClick={() => setPage(page + 1)}>Próxima</Button>
          </div>
        </div>
      </Card>

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
          <DialogHeader><DialogTitle>{editing ? "Editar informação nutricional" : "Nova informação nutricional"}</DialogTitle></DialogHeader>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
            <div className="md:col-span-2 space-y-1.5"><Label>Nome / identificação *</Label>
              <Input value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} /></div>
            <div className="space-y-1.5"><Label>Status</Label>
              <Select value={form.status} onValueChange={(v) => setForm({ ...form, status: v })}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>{STATUSES.map((s) => <SelectItem key={s} value={s}>{s}</SelectItem>)}</SelectContent>
              </Select>
            </div>
            <div />
            {FIELDS.map(([k, label, type]) => (
              <div key={k} className="space-y-1.5">
                <Label>{label}</Label>
                <Input type={type} value={form[k] ?? ""} onChange={(e) => setForm({ ...form, [k]: e.target.value })} />
              </div>
            ))}
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setOpen(false)}>Cancelar</Button>
            <Button onClick={() => save.mutate()} disabled={save.isPending || !form.name.trim()}>Salvar</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={!!view} onOpenChange={(o) => !o && setView(null)}>
        <DialogContent className="max-w-lg">
          <DialogHeader><DialogTitle>{view?.name} (v{view?.version}) <StatusBadge status={view?.status ?? ""} /></DialogTitle></DialogHeader>
          {view && <NutritionTable data={view} />}
        </DialogContent>
      </Dialog>
    </>
  );
}
