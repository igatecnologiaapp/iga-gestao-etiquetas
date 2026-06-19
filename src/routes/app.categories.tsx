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
import { Plus, Pencil, Search } from "lucide-react";
import { toast } from "sonner";

export const Route = createFileRoute("/app/categories")({
  head: () => ({ meta: [{ title: "Categorias — Etiquetas" }] }),
  component: CategoriesPage,
});

function CategoriesPage() {
  const qc = useQueryClient();
  const { companyId, canWrite } = useActiveCompany();
  const [search, setSearch] = useState("");
  const [open, setOpen] = useState(false);
  const [editing, setEditing] = useState<any | null>(null);
  const [form, setForm] = useState({ name: "", slug: "", parent_id: "none", description: "" });

  const { data, isLoading } = useQuery({
    queryKey: ["categories", companyId, search],
    enabled: !!companyId,
    queryFn: async () => {
      let q = supabase.from("categories").select("*").eq("company_id", companyId!).order("name");
      if (search.trim()) q = q.ilike("name", `%${search.trim()}%`);
      const { data, error } = await q;
      if (error) throw error;
      return data;
    },
  });

  const parents = (data ?? []).filter((c) => !c.parent_id);
  const parentName = (id: string | null) => parents.find((p) => p.id === id)?.name ?? "—";

  function openCreate() { setEditing(null); setForm({ name: "", slug: "", parent_id: "none", description: "" }); setOpen(true); }
  function openEdit(row: any) {
    setEditing(row);
    setForm({ name: row.name, slug: row.slug ?? "", parent_id: row.parent_id ?? "none", description: row.description ?? "" });
    setOpen(true);
  }

  const save = useMutation({
    mutationFn: async () => {
      const payload: any = {
        company_id: companyId,
        name: form.name,
        slug: form.slug || null,
        parent_id: form.parent_id === "none" ? null : form.parent_id,
        description: form.description || null,
      };
      if (editing) {
        const { error } = await supabase.from("categories").update(payload).eq("id", editing.id);
        if (error) throw error;
      } else {
        const { data: u } = await supabase.auth.getUser();
        payload.created_by = u.user?.id;
        const { error } = await supabase.from("categories").insert(payload);
        if (error) throw error;
      }
    },
    onSuccess: () => { toast.success("Salvo"); setOpen(false); qc.invalidateQueries({ queryKey: ["categories"] }); },
    onError: (e: any) => toast.error("Erro", { description: e.message }),
  });

  const toggle = useMutation({
    mutationFn: async (row: any) => {
      const next = row.status === "ativo" ? "inativo" : "ativo";
      const { error } = await supabase.from("categories").update({ status: next }).eq("id", row.id);
      if (error) throw error;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ["categories"] }),
  });

  return (
    <>
      <PageHeader title="Categorias" description="Categorias e subcategorias dos produtos." />
      <Card className="p-4">
        <div className="flex items-center justify-between gap-3 mb-4">
          <div className="relative max-w-xs">
            <Search className="absolute left-2 top-1/2 -translate-y-1/2 size-4 text-muted-foreground" />
            <Input placeholder="Buscar…" value={search} onChange={(e) => setSearch(e.target.value)} className="pl-8" />
          </div>
          {canWrite && (
            <Dialog open={open} onOpenChange={setOpen}>
              <DialogTrigger asChild><Button onClick={openCreate}><Plus className="size-4 mr-1" /> Nova categoria</Button></DialogTrigger>
              <DialogContent>
                <DialogHeader><DialogTitle>{editing ? "Editar categoria" : "Nova categoria"}</DialogTitle></DialogHeader>
                <div className="space-y-3">
                  <div className="space-y-1.5"><Label>Nome *</Label>
                    <Input value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} /></div>
                  <div className="space-y-1.5"><Label>Slug</Label>
                    <Input value={form.slug} onChange={(e) => setForm({ ...form, slug: e.target.value })} /></div>
                  <div className="space-y-1.5"><Label>Categoria pai (deixe vazio para categoria raiz)</Label>
                    <Select value={form.parent_id} onValueChange={(v) => setForm({ ...form, parent_id: v })}>
                      <SelectTrigger><SelectValue placeholder="Selecione…" /></SelectTrigger>
                      <SelectContent>
                        <SelectItem value="none">— Nenhuma (raiz) —</SelectItem>
                        {parents.filter((p) => p.id !== editing?.id).map((p) => (
                          <SelectItem key={p.id} value={p.id}>{p.name}</SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                  <div className="space-y-1.5"><Label>Descrição</Label>
                    <Input value={form.description} onChange={(e) => setForm({ ...form, description: e.target.value })} /></div>
                </div>
                <DialogFooter>
                  <Button variant="outline" onClick={() => setOpen(false)}>Cancelar</Button>
                  <Button onClick={() => save.mutate()} disabled={save.isPending || !form.name.trim()}>Salvar</Button>
                </DialogFooter>
              </DialogContent>
            </Dialog>
          )}
        </div>
        <div className="rounded-md border overflow-x-auto">
          <Table>
            <TableHeader><TableRow>
              <TableHead>Nome</TableHead><TableHead>Pai</TableHead><TableHead>Slug</TableHead><TableHead>Status</TableHead><TableHead className="text-right">Ações</TableHead>
            </TableRow></TableHeader>
            <TableBody>
              {isLoading && <TableRow><TableCell colSpan={5} className="text-center py-8 text-muted-foreground">Carregando…</TableCell></TableRow>}
              {!isLoading && (data?.length ?? 0) === 0 && <TableRow><TableCell colSpan={5} className="text-center py-8 text-muted-foreground">Nenhuma categoria.</TableCell></TableRow>}
              {data?.map((row) => (
                <TableRow key={row.id}>
                  <TableCell className="font-medium">{row.name}</TableCell>
                  <TableCell className="text-muted-foreground">{row.parent_id ? parentName(row.parent_id) : "—"}</TableCell>
                  <TableCell className="text-muted-foreground">{row.slug ?? "—"}</TableCell>
                  <TableCell><StatusBadge status={row.status} /></TableCell>
                  <TableCell className="text-right space-x-1">
                    {canWrite && (<>
                      <Button size="sm" variant="ghost" onClick={() => openEdit(row)}><Pencil className="size-4" /></Button>
                      <Button size="sm" variant="outline" onClick={() => toggle.mutate(row)}>
                        {row.status === "ativo" ? "Inativar" : "Ativar"}
                      </Button>
                    </>)}
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </div>
      </Card>
    </>
  );
}
