import { createFileRoute } from "@tanstack/react-router";
import { useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useActiveCompany } from "@/hooks/use-active-company";
import { PageHeader } from "@/components/page-header";
import { StatusBadge } from "@/components/status-badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card } from "@/components/ui/card";
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Plus, Pencil } from "lucide-react";
import { toast } from "sonner";

export const Route = createFileRoute("/app/layout-formats")({ component: FormatsPage });

const empty = {
  name: "", width: 100, height: 100, unit: "mm", orientation: "vertical",
  margin_top: 0, margin_bottom: 0, margin_left: 0, margin_right: 0,
  spacing_h: 0, spacing_v: 0, columns: 1, rows: 1, status: "ativo",
};

function FormatsPage() {
  const qc = useQueryClient();
  const { companyId, canWrite } = useActiveCompany();
  const [open, setOpen] = useState(false);
  const [form, setForm] = useState<any>(empty);

  const { data } = useQuery({
    queryKey: ["label_formats", companyId],
    enabled: !!companyId,
    queryFn: async () => {
      const { data, error } = await (supabase.from("label_formats" as any) as any)
        .select("*").eq("company_id", companyId!).order("name");
      if (error) throw error;
      return data as any[];
    },
  });

  const save = useMutation({
    mutationFn: async () => {
      const payload = { ...form, company_id: companyId };
      if (form.id) {
        const { error } = await (supabase.from("label_formats" as any) as any).update(payload).eq("id", form.id);
        if (error) throw error;
      } else {
        const { error } = await (supabase.from("label_formats" as any) as any).insert(payload);
        if (error) throw error;
      }
    },
    onSuccess: () => { toast.success("Salvo"); setOpen(false); setForm(empty); qc.invalidateQueries({ queryKey: ["label_formats"] }); },
    onError: (e: any) => toast.error(e.message),
  });

  return (
    <>
      <PageHeader
        title="Formatos de etiqueta"
        description="Dimensões, margens e disposição."
        actions={canWrite && (
          <Dialog open={open} onOpenChange={(o) => { setOpen(o); if (!o) setForm(empty); }}>
            <DialogTrigger asChild><Button><Plus className="size-4" /> Novo formato</Button></DialogTrigger>
            <DialogContent className="max-w-2xl">
              <DialogHeader><DialogTitle>{form.id ? "Editar" : "Novo"} formato</DialogTitle></DialogHeader>
              <div className="grid grid-cols-2 md:grid-cols-3 gap-3">
                <div className="col-span-2 md:col-span-3"><Label>Nome</Label><Input value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} /></div>
                <div><Label>Largura</Label><Input type="number" step="0.1" value={form.width} onChange={(e) => setForm({ ...form, width: Number(e.target.value) })} /></div>
                <div><Label>Altura</Label><Input type="number" step="0.1" value={form.height} onChange={(e) => setForm({ ...form, height: Number(e.target.value) })} /></div>
                <div><Label>Unidade</Label>
                  <Select value={form.unit} onValueChange={(v) => setForm({ ...form, unit: v })}>
                    <SelectTrigger><SelectValue /></SelectTrigger>
                    <SelectContent>{["mm", "cm", "in", "px"].map((u) => <SelectItem key={u} value={u}>{u}</SelectItem>)}</SelectContent>
                  </Select>
                </div>
                <div><Label>Orientação</Label>
                  <Select value={form.orientation} onValueChange={(v) => setForm({ ...form, orientation: v })}>
                    <SelectTrigger><SelectValue /></SelectTrigger>
                    <SelectContent><SelectItem value="vertical">Vertical</SelectItem><SelectItem value="horizontal">Horizontal</SelectItem></SelectContent>
                  </Select>
                </div>
                <div><Label>Colunas</Label><Input type="number" value={form.columns} onChange={(e) => setForm({ ...form, columns: Number(e.target.value) })} /></div>
                <div><Label>Linhas</Label><Input type="number" value={form.rows} onChange={(e) => setForm({ ...form, rows: Number(e.target.value) })} /></div>
                <div><Label>Margem topo</Label><Input type="number" step="0.1" value={form.margin_top} onChange={(e) => setForm({ ...form, margin_top: Number(e.target.value) })} /></div>
                <div><Label>Margem base</Label><Input type="number" step="0.1" value={form.margin_bottom} onChange={(e) => setForm({ ...form, margin_bottom: Number(e.target.value) })} /></div>
                <div><Label>Margem esq.</Label><Input type="number" step="0.1" value={form.margin_left} onChange={(e) => setForm({ ...form, margin_left: Number(e.target.value) })} /></div>
                <div><Label>Margem dir.</Label><Input type="number" step="0.1" value={form.margin_right} onChange={(e) => setForm({ ...form, margin_right: Number(e.target.value) })} /></div>
                <div><Label>Espaçamento H</Label><Input type="number" step="0.1" value={form.spacing_h} onChange={(e) => setForm({ ...form, spacing_h: Number(e.target.value) })} /></div>
                <div><Label>Espaçamento V</Label><Input type="number" step="0.1" value={form.spacing_v} onChange={(e) => setForm({ ...form, spacing_v: Number(e.target.value) })} /></div>
                <div><Label>Status</Label>
                  <Select value={form.status} onValueChange={(v) => setForm({ ...form, status: v })}>
                    <SelectTrigger><SelectValue /></SelectTrigger>
                    <SelectContent>{["ativo", "inativo", "arquivado"].map((s) => <SelectItem key={s} value={s}>{s}</SelectItem>)}</SelectContent>
                  </Select>
                </div>
              </div>
              <DialogFooter><Button variant="outline" onClick={() => setOpen(false)}>Cancelar</Button><Button onClick={() => save.mutate()}>Salvar</Button></DialogFooter>
            </DialogContent>
          </Dialog>
        )}
      />
      <Card className="p-4">
        <Table>
          <TableHeader>
            <TableRow><TableHead>Nome</TableHead><TableHead>Dimensões</TableHead><TableHead>Orientação</TableHead><TableHead>Cols × Linhas</TableHead><TableHead>Status</TableHead><TableHead></TableHead></TableRow>
          </TableHeader>
          <TableBody>
            {data?.map((r) => (
              <TableRow key={r.id}>
                <TableCell className="font-medium">{r.name}{r.is_native && <span className="ml-2 text-xs text-muted-foreground">(padrão)</span>}</TableCell>
                <TableCell>{r.width} × {r.height} {r.unit}</TableCell>
                <TableCell>{r.orientation}</TableCell>
                <TableCell>{r.columns} × {r.rows}</TableCell>
                <TableCell><StatusBadge status={r.status} /></TableCell>
                <TableCell>{canWrite && <Button size="sm" variant="ghost" onClick={() => { setForm(r); setOpen(true); }}><Pencil className="size-4" /></Button>}</TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </Card>
    </>
  );
}
