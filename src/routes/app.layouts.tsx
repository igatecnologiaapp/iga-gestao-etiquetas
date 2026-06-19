import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useActiveCompany } from "@/hooks/use-active-company";
import { PageHeader } from "@/components/page-header";
import { StatusBadge } from "@/components/status-badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Card } from "@/components/ui/card";
import {
  Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle, DialogTrigger,
} from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Plus, Copy, Archive, Pencil, Search } from "lucide-react";
import { toast } from "sonner";

export const Route = createFileRoute("/app/layouts")({
  component: LayoutsPage,
});

function LayoutsPage() {
  const qc = useQueryClient();
  const navigate = useNavigate();
  const { companyId, canWrite } = useActiveCompany();
  const [search, setSearch] = useState("");
  const [open, setOpen] = useState(false);
  const [form, setForm] = useState({
    name: "", description: "", category_id: "", format_id: "",
  });

  const layouts = useQuery({
    queryKey: ["label_layouts", companyId, search],
    enabled: !!companyId,
    queryFn: async () => {
      let q = (supabase.from("label_layouts" as any) as any)
        .select("*, label_categories(name), label_formats(name,width,height,unit)")
        .eq("company_id", companyId!)
        .order("created_at", { ascending: false });
      if (search.trim()) q = q.ilike("name", `%${search.trim()}%`);
      const { data, error } = await q;
      if (error) throw error;
      return data as any[];
    },
  });

  const categories = useQuery({
    queryKey: ["label_categories", companyId],
    enabled: !!companyId,
    queryFn: async () => {
      const { data, error } = await (supabase.from("label_categories" as any) as any)
        .select("id,name").eq("company_id", companyId!).eq("status", "ativo").order("name");
      if (error) throw error;
      return data as any[];
    },
  });

  const formats = useQuery({
    queryKey: ["label_formats", companyId],
    enabled: !!companyId,
    queryFn: async () => {
      const { data, error } = await (supabase.from("label_formats" as any) as any)
        .select("id,name,width,height,unit").eq("company_id", companyId!).eq("status", "ativo").order("name");
      if (error) throw error;
      return data as any[];
    },
  });

  const create = useMutation({
    mutationFn: async () => {
      if (!form.name.trim() || !form.format_id) throw new Error("Nome e formato são obrigatórios");
      const { data, error } = await (supabase.from("label_layouts" as any) as any).insert({
        company_id: companyId,
        name: form.name.trim(),
        description: form.description || null,
        category_id: form.category_id || null,
        format_id: form.format_id,
        status: "ativo",
        current_version: 1,
      }).select("id").single();
      if (error) throw error;
      // create initial version
      const { error: vErr } = await (supabase.from("label_layout_versions" as any) as any).insert({
        company_id: companyId,
        layout_id: data.id,
        version: 1,
        change_reason: "Versão inicial",
      });
      if (vErr) throw vErr;
      return data.id;
    },
    onSuccess: (id) => {
      toast.success("Layout criado");
      setOpen(false);
      setForm({ name: "", description: "", category_id: "", format_id: "" });
      qc.invalidateQueries({ queryKey: ["label_layouts"] });
      navigate({ to: "/app/layouts/$id", params: { id: id as string } });
    },
    onError: (e: any) => toast.error(e.message),
  });

  const duplicate = useMutation({
    mutationFn: async (row: any) => {
      const { data: newLayout, error } = await (supabase.from("label_layouts" as any) as any).insert({
        company_id: companyId,
        name: `${row.name} (cópia)`,
        description: row.description,
        category_id: row.category_id,
        format_id: row.format_id,
        status: "ativo",
        current_version: 1,
      }).select("id").single();
      if (error) throw error;
      const { data: ver, error: vErr } = await (supabase.from("label_layout_versions" as any) as any).insert({
        company_id: companyId,
        layout_id: newLayout.id,
        version: 1,
        change_reason: `Duplicado de ${row.name}`,
      }).select("id").single();
      if (vErr) throw vErr;
      // copy elements from current version of source
      const { data: srcVer } = await (supabase.from("label_layout_versions" as any) as any)
        .select("id").eq("layout_id", row.id).eq("version", row.current_version).single();
      if (srcVer?.id) {
        const { data: els } = await (supabase.from("label_layout_elements" as any) as any)
          .select("*").eq("version_id", srcVer.id);
        if (els?.length) {
          const clones = els.map(({ id, created_at, updated_at, version_id, ...rest }: any) => ({
            ...rest, version_id: ver.id,
          }));
          await (supabase.from("label_layout_elements" as any) as any).insert(clones);
        }
      }
    },
    onSuccess: () => { toast.success("Layout duplicado"); qc.invalidateQueries({ queryKey: ["label_layouts"] }); },
    onError: (e: any) => toast.error(e.message),
  });

  const changeStatus = useMutation({
    mutationFn: async ({ id, status }: { id: string; status: string }) => {
      const { error } = await (supabase.from("label_layouts" as any) as any)
        .update({ status }).eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => { toast.success("Status atualizado"); qc.invalidateQueries({ queryKey: ["label_layouts"] }); },
    onError: (e: any) => toast.error(e.message),
  });

  return (
    <>
      <PageHeader
        title="Central de Layouts"
        description="Gerencie layouts de etiquetas, versões e associações."
        actions={canWrite && (
          <Dialog open={open} onOpenChange={setOpen}>
            <DialogTrigger asChild><Button><Plus className="size-4" /> Novo layout</Button></DialogTrigger>
            <DialogContent>
              <DialogHeader><DialogTitle>Novo layout</DialogTitle></DialogHeader>
              <div className="space-y-3">
                <div><Label>Nome</Label><Input value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} /></div>
                <div><Label>Descrição</Label><Textarea value={form.description} onChange={(e) => setForm({ ...form, description: e.target.value })} /></div>
                <div>
                  <Label>Categoria</Label>
                  <Select value={form.category_id} onValueChange={(v) => setForm({ ...form, category_id: v })}>
                    <SelectTrigger><SelectValue placeholder="Selecione" /></SelectTrigger>
                    <SelectContent>
                      {categories.data?.map((c) => <SelectItem key={c.id} value={c.id}>{c.name}</SelectItem>)}
                    </SelectContent>
                  </Select>
                </div>
                <div>
                  <Label>Formato</Label>
                  <Select value={form.format_id} onValueChange={(v) => setForm({ ...form, format_id: v })}>
                    <SelectTrigger><SelectValue placeholder="Selecione" /></SelectTrigger>
                    <SelectContent>
                      {formats.data?.map((f) => (
                        <SelectItem key={f.id} value={f.id}>{f.name} — {f.width}×{f.height} {f.unit}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              </div>
              <DialogFooter>
                <Button variant="outline" onClick={() => setOpen(false)}>Cancelar</Button>
                <Button onClick={() => create.mutate()} disabled={create.isPending}>Criar</Button>
              </DialogFooter>
            </DialogContent>
          </Dialog>
        )}
      />

      <Card className="p-4">
        <div className="flex items-center gap-2 mb-4">
          <div className="relative flex-1 max-w-sm">
            <Search className="size-4 absolute left-2 top-2.5 text-muted-foreground" />
            <Input className="pl-8" placeholder="Buscar..." value={search} onChange={(e) => setSearch(e.target.value)} />
          </div>
        </div>
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Nome</TableHead>
              <TableHead>Categoria</TableHead>
              <TableHead>Formato</TableHead>
              <TableHead>Versão</TableHead>
              <TableHead>Status</TableHead>
              <TableHead className="w-[200px]">Ações</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {layouts.data?.map((r) => (
              <TableRow key={r.id}>
                <TableCell className="font-medium">
                  <Link to="/app/layouts/$id" params={{ id: r.id }} className="hover:underline">{r.name}</Link>
                </TableCell>
                <TableCell>{r.label_categories?.name ?? "—"}</TableCell>
                <TableCell>{r.label_formats?.name ?? "—"}</TableCell>
                <TableCell>v{r.current_version}</TableCell>
                <TableCell><StatusBadge status={r.status} /></TableCell>
                <TableCell className="flex gap-1">
                  <Button size="sm" variant="ghost" asChild>
                    <Link to="/app/layouts/$id" params={{ id: r.id }}><Pencil className="size-4" /></Link>
                  </Button>
                  {canWrite && (
                    <>
                      <Button size="sm" variant="ghost" onClick={() => duplicate.mutate(r)} title="Duplicar">
                        <Copy className="size-4" />
                      </Button>
                      <Button size="sm" variant="ghost" onClick={() => changeStatus.mutate({ id: r.id, status: r.status === "arquivado" ? "ativo" : "arquivado" })} title="Arquivar / Reativar">
                        <Archive className="size-4" />
                      </Button>
                    </>
                  )}
                </TableCell>
              </TableRow>
            ))}
            {!layouts.data?.length && (
              <TableRow><TableCell colSpan={6} className="text-center text-muted-foreground py-8">Nenhum layout cadastrado.</TableCell></TableRow>
            )}
          </TableBody>
        </Table>
      </Card>
    </>
  );
}
