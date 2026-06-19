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
import { Textarea } from "@/components/ui/textarea";
import { Card } from "@/components/ui/card";
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Plus, Pencil } from "lucide-react";
import { toast } from "sonner";

export const Route = createFileRoute("/app/printers")({ component: Page });

const MANUFACTURERS = ["Zebra", "Argox", "Elgin", "Datamax", "TSC", "Brother", "Epson", "HP", "Canon", "Outros"];
const TYPES = [
  { v: "termica", l: "Térmica" }, { v: "laser", l: "Laser" }, { v: "inkjet", l: "Inkjet" },
  { v: "matricial", l: "Matricial" }, { v: "pdf", l: "PDF" }, { v: "grafica_externa", l: "Gráfica externa" },
  { v: "bobina_continua", l: "Bobina contínua" }, { v: "etiqueta_adesiva", l: "Etiqueta adesiva" },
];

const empty = {
  name: "", manufacturer: "Zebra", model: "", printer_type: "termica", location: "",
  max_width: 0, max_height: 0, dpi: 203, paper_type: "", ribbon_type: "",
  connection_type: "USB", is_default: false, notes: "", status: "ativo",
};

function Page() {
  const qc = useQueryClient();
  const { companyId, canWrite } = useActiveCompany();
  const [open, setOpen] = useState(false);
  const [form, setForm] = useState<any>(empty);

  const { data } = useQuery({
    queryKey: ["printers", companyId],
    enabled: !!companyId,
    queryFn: async () => {
      const { data, error } = await (supabase.from("printer_configs" as any) as any)
        .select("*").eq("company_id", companyId!).order("name");
      if (error) throw error;
      return data as any[];
    },
  });

  const save = useMutation({
    mutationFn: async () => {
      const payload = { ...form, company_id: companyId };
      if (form.id) {
        const { error } = await (supabase.from("printer_configs" as any) as any).update(payload).eq("id", form.id);
        if (error) throw error;
      } else {
        const { error } = await (supabase.from("printer_configs" as any) as any).insert(payload);
        if (error) throw error;
      }
    },
    onSuccess: () => { toast.success("Salvo"); setOpen(false); setForm(empty); qc.invalidateQueries({ queryKey: ["printers"] }); },
    onError: (e: any) => toast.error(e.message),
  });

  return (
    <>
      <PageHeader
        title="Impressoras"
        description="Cadastro de impressoras (integração real em fase futura)."
        actions={canWrite && (
          <Dialog open={open} onOpenChange={(o) => { setOpen(o); if (!o) setForm(empty); }}>
            <DialogTrigger asChild><Button><Plus className="size-4" /> Nova impressora</Button></DialogTrigger>
            <DialogContent className="max-w-2xl">
              <DialogHeader><DialogTitle>{form.id ? "Editar" : "Nova"} impressora</DialogTitle></DialogHeader>
              <div className="grid grid-cols-2 md:grid-cols-3 gap-3">
                <div className="col-span-2 md:col-span-3"><Label>Nome</Label><Input value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} /></div>
                <div><Label>Fabricante</Label>
                  <Select value={form.manufacturer} onValueChange={(v) => setForm({ ...form, manufacturer: v })}>
                    <SelectTrigger><SelectValue /></SelectTrigger>
                    <SelectContent>{MANUFACTURERS.map((m) => <SelectItem key={m} value={m}>{m}</SelectItem>)}</SelectContent>
                  </Select>
                </div>
                <div><Label>Modelo</Label><Input value={form.model ?? ""} onChange={(e) => setForm({ ...form, model: e.target.value })} /></div>
                <div><Label>Tipo</Label>
                  <Select value={form.printer_type} onValueChange={(v) => setForm({ ...form, printer_type: v })}>
                    <SelectTrigger><SelectValue /></SelectTrigger>
                    <SelectContent>{TYPES.map((t) => <SelectItem key={t.v} value={t.v}>{t.l}</SelectItem>)}</SelectContent>
                  </Select>
                </div>
                <div><Label>Local/Setor</Label><Input value={form.location ?? ""} onChange={(e) => setForm({ ...form, location: e.target.value })} /></div>
                <div><Label>Larg. máx (mm)</Label><Input type="number" value={form.max_width ?? 0} onChange={(e) => setForm({ ...form, max_width: Number(e.target.value) })} /></div>
                <div><Label>Alt. máx (mm)</Label><Input type="number" value={form.max_height ?? 0} onChange={(e) => setForm({ ...form, max_height: Number(e.target.value) })} /></div>
                <div><Label>DPI</Label><Input type="number" value={form.dpi ?? 0} onChange={(e) => setForm({ ...form, dpi: Number(e.target.value) })} /></div>
                <div><Label>Papel</Label><Input value={form.paper_type ?? ""} onChange={(e) => setForm({ ...form, paper_type: e.target.value })} /></div>
                <div><Label>Bobina</Label><Input value={form.ribbon_type ?? ""} onChange={(e) => setForm({ ...form, ribbon_type: e.target.value })} /></div>
                <div><Label>Conexão</Label><Input value={form.connection_type ?? ""} onChange={(e) => setForm({ ...form, connection_type: e.target.value })} /></div>
                <div><Label>Status</Label>
                  <Select value={form.status} onValueChange={(v) => setForm({ ...form, status: v })}>
                    <SelectTrigger><SelectValue /></SelectTrigger>
                    <SelectContent>{["ativo", "inativo", "arquivado"].map((s) => <SelectItem key={s} value={s}>{s}</SelectItem>)}</SelectContent>
                  </Select>
                </div>
                <div className="col-span-2 md:col-span-3"><Label>Observações</Label><Textarea value={form.notes ?? ""} onChange={(e) => setForm({ ...form, notes: e.target.value })} /></div>
                <label className="flex items-center gap-2 col-span-2 md:col-span-3">
                  <input type="checkbox" checked={!!form.is_default} onChange={(e) => setForm({ ...form, is_default: e.target.checked })} /> Impressora padrão
                </label>
              </div>
              <DialogFooter><Button variant="outline" onClick={() => setOpen(false)}>Cancelar</Button><Button onClick={() => save.mutate()}>Salvar</Button></DialogFooter>
            </DialogContent>
          </Dialog>
        )}
      />
      <Card className="p-4">
        <Table>
          <TableHeader><TableRow><TableHead>Nome</TableHead><TableHead>Fabricante</TableHead><TableHead>Modelo</TableHead><TableHead>Tipo</TableHead><TableHead>DPI</TableHead><TableHead>Status</TableHead><TableHead></TableHead></TableRow></TableHeader>
          <TableBody>
            {data?.map((r) => (
              <TableRow key={r.id}>
                <TableCell className="font-medium">{r.name}{r.is_default && <span className="ml-2 text-xs text-emerald-700">(padrão)</span>}</TableCell>
                <TableCell>{r.manufacturer ?? "—"}</TableCell>
                <TableCell>{r.model ?? "—"}</TableCell>
                <TableCell>{TYPES.find((t) => t.v === r.printer_type)?.l ?? r.printer_type ?? "—"}</TableCell>
                <TableCell>{r.dpi ?? "—"}</TableCell>
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
