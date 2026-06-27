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
import {
  Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle, DialogTrigger,
} from "@/components/ui/dialog";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from "@/components/ui/table";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Plus, Pencil, Settings2, Link2, Trash2, Wand2 } from "lucide-react";
import { toast } from "sonner";
import {
  validateTechnicalConfig,
  RAW_LANGUAGES,
  ROTATION_VALUES,
  PrinterCompatibilityService,
} from "@/lib/print";
import { PairingCodeCard } from "@/components/print/pairing-code-card";
import { PrintAgentDownloadCard } from "@/components/print/print-agent-download-card";
import { PrinterSetupWizard } from "@/components/print/printer-setup-wizard";
import { PrintAgentStatusCard } from "@/components/print/print-agent-status-card";
import { PrintAgentDiagnosticsCard } from "@/components/print/print-agent-diagnostics-card";

export const Route = createFileRoute("/app/printers")({ component: Page });

const MANUFACTURERS = ["Zebra", "Argox", "Elgin", "Datamax", "TSC", "Brother", "Epson", "HP", "Canon", "Outros"];
const TYPES = [
  { v: "termica", l: "Térmica" }, { v: "laser", l: "Laser" }, { v: "inkjet", l: "Inkjet" },
  { v: "matricial", l: "Matricial" }, { v: "pdf", l: "PDF" }, { v: "grafica_externa", l: "Gráfica externa" },
  { v: "bobina_continua", l: "Bobina contínua" }, { v: "etiqueta_adesiva", l: "Etiqueta adesiva" },
];

const empty: any = {
  name: "", manufacturer: "Zebra", model: "", printer_type: "termica", location: "",
  max_width: 0, max_height: 0, dpi: 203, paper_type: "", ribbon_type: "",
  connection_type: "USB", is_default: false, notes: "", status: "ativo",
  speed: 4, scale: 100, margin_top: 0, margin_right: 0, margin_bottom: 0, margin_left: 0,
  rotation: 0, auto_cut: false, label_advance: 0, offset_x: 0, offset_y: 0,
  raw_language: "driver",
};

function Page() {
  const qc = useQueryClient();
  const { companyId, canWrite } = useActiveCompany();
  const [open, setOpen] = useState(false);
  const [form, setForm] = useState<any>(empty);
  const [tab, setTab] = useState("basico");
  const [compatPrinter, setCompatPrinter] = useState<any | null>(null);
  const [wizardOpen, setWizardOpen] = useState(false);

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
      const errs = validateTechnicalConfig(form);
      if (errs.length) throw new Error(errs.join(" "));
      const payload = { ...form, company_id: companyId };
      if (form.id) {
        const { error } = await (supabase.from("printer_configs" as any) as any).update(payload).eq("id", form.id);
        if (error) throw error;
      } else {
        const { error } = await (supabase.from("printer_configs" as any) as any).insert(payload);
        if (error) throw error;
      }
    },
    onSuccess: () => {
      toast.success("Salvo");
      setOpen(false); setForm(empty); setTab("basico");
      qc.invalidateQueries({ queryKey: ["printers"] });
    },
    onError: (e: any) => toast.error(e.message),
  });

  const num = (v: any) => (v === "" || v == null ? 0 : Number(v));

  return (
    <>
      <PageHeader
        title="Impressoras"
        description="Cadastro, configurações técnicas e compatibilidade com layouts."
        actions={canWrite && (
          <div className="flex gap-2">
            <Button variant="outline" onClick={() => setWizardOpen(true)}>
              <Wand2 className="size-4" /> Assistente de Configuração
            </Button>
            <Dialog open={open} onOpenChange={(o) => { setOpen(o); if (!o) { setForm(empty); setTab("basico"); } }}>
              <DialogTrigger asChild><Button><Plus className="size-4" /> Nova impressora</Button></DialogTrigger>
            <DialogContent className="max-w-3xl max-h-[90vh] overflow-y-auto">
              <DialogHeader><DialogTitle>{form.id ? "Editar" : "Nova"} impressora</DialogTitle></DialogHeader>
              <Tabs value={tab} onValueChange={setTab}>
                <TabsList>
                  <TabsTrigger value="basico">Básico</TabsTrigger>
                  <TabsTrigger value="tecnico"><Settings2 className="size-4 mr-1" /> Técnico</TabsTrigger>
                </TabsList>

                <TabsContent value="basico" className="grid grid-cols-2 md:grid-cols-3 gap-3 pt-3">
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
                  <div><Label>Larg. máx (mm)</Label><Input type="number" value={form.max_width ?? 0} onChange={(e) => setForm({ ...form, max_width: num(e.target.value) })} /></div>
                  <div><Label>Alt. máx (mm)</Label><Input type="number" value={form.max_height ?? 0} onChange={(e) => setForm({ ...form, max_height: num(e.target.value) })} /></div>
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
                </TabsContent>

                <TabsContent value="tecnico" className="grid grid-cols-2 md:grid-cols-3 gap-3 pt-3">
                  <div><Label>DPI</Label><Input type="number" min={1} max={2400} value={form.dpi ?? 0} onChange={(e) => setForm({ ...form, dpi: num(e.target.value) })} /></div>
                  <div><Label>Velocidade (ips)</Label><Input type="number" min={0} max={600} value={form.speed ?? 0} onChange={(e) => setForm({ ...form, speed: num(e.target.value) })} /></div>
                  <div><Label>Escala (%)</Label><Input type="number" min={10} max={400} value={form.scale ?? 100} onChange={(e) => setForm({ ...form, scale: num(e.target.value) })} /></div>
                  <div><Label>Margem sup. (mm)</Label><Input type="number" min={0} max={200} value={form.margin_top ?? 0} onChange={(e) => setForm({ ...form, margin_top: num(e.target.value) })} /></div>
                  <div><Label>Margem dir. (mm)</Label><Input type="number" min={0} max={200} value={form.margin_right ?? 0} onChange={(e) => setForm({ ...form, margin_right: num(e.target.value) })} /></div>
                  <div><Label>Margem inf. (mm)</Label><Input type="number" min={0} max={200} value={form.margin_bottom ?? 0} onChange={(e) => setForm({ ...form, margin_bottom: num(e.target.value) })} /></div>
                  <div><Label>Margem esq. (mm)</Label><Input type="number" min={0} max={200} value={form.margin_left ?? 0} onChange={(e) => setForm({ ...form, margin_left: num(e.target.value) })} /></div>
                  <div><Label>Rotação (°)</Label>
                    <Select value={String(form.rotation ?? 0)} onValueChange={(v) => setForm({ ...form, rotation: Number(v) })}>
                      <SelectTrigger><SelectValue /></SelectTrigger>
                      <SelectContent>{ROTATION_VALUES.map((r) => <SelectItem key={r} value={String(r)}>{r}°</SelectItem>)}</SelectContent>
                    </Select>
                  </div>
                  <div><Label>Avanço etiqueta (mm)</Label><Input type="number" min={0} max={200} value={form.label_advance ?? 0} onChange={(e) => setForm({ ...form, label_advance: num(e.target.value) })} /></div>
                  <div><Label>Offset horizontal</Label><Input type="number" min={-200} max={200} value={form.offset_x ?? 0} onChange={(e) => setForm({ ...form, offset_x: num(e.target.value) })} /></div>
                  <div><Label>Offset vertical</Label><Input type="number" min={-200} max={200} value={form.offset_y ?? 0} onChange={(e) => setForm({ ...form, offset_y: num(e.target.value) })} /></div>
                  <div><Label>Linguagem bruta</Label>
                    <Select value={form.raw_language ?? "driver"} onValueChange={(v) => setForm({ ...form, raw_language: v })}>
                      <SelectTrigger><SelectValue /></SelectTrigger>
                      <SelectContent>{RAW_LANGUAGES.map((r) => <SelectItem key={r} value={r}>{r}</SelectItem>)}</SelectContent>
                    </Select>
                  </div>
                  <label className="flex items-center gap-2 col-span-2 md:col-span-3">
                    <input type="checkbox" checked={!!form.auto_cut} onChange={(e) => setForm({ ...form, auto_cut: e.target.checked })} /> Corte automático
                  </label>
                </TabsContent>
              </Tabs>

              <DialogFooter>
                <Button variant="outline" onClick={() => setOpen(false)}>Cancelar</Button>
                <Button onClick={() => save.mutate()} disabled={save.isPending}>Salvar</Button>
              </DialogFooter>
            </DialogContent>
          </Dialog>
          </div>
        )}
      />

      {companyId && (
        <div className="mb-4 grid gap-4">
          <PrintAgentStatusCard companyId={companyId} />
          <PrintAgentDiagnosticsCard companyId={companyId} />
        </div>
      )}

      {companyId && (
        <div id="pairing-section" className="mb-4 grid gap-4 md:grid-cols-2">
          {canWrite && <PairingCodeCard companyId={companyId} />}
          <PrintAgentDownloadCard canDownload={!!canWrite} companyId={companyId} />
        </div>
      )}


      <Card className="p-4">
        <Table>
          <TableHeader><TableRow>
            <TableHead>Nome</TableHead><TableHead>Fabricante</TableHead><TableHead>Modelo</TableHead>
            <TableHead>Tipo</TableHead><TableHead>DPI</TableHead><TableHead>Linguagem</TableHead>
            <TableHead>Status</TableHead><TableHead></TableHead>
          </TableRow></TableHeader>
          <TableBody>
            {data?.map((r) => (
              <TableRow key={r.id}>
                <TableCell className="font-medium">{r.name}{r.is_default && <span className="ml-2 text-xs text-emerald-700">(padrão)</span>}</TableCell>
                <TableCell>{r.manufacturer ?? "—"}</TableCell>
                <TableCell>{r.model ?? "—"}</TableCell>
                <TableCell>{TYPES.find((t) => t.v === r.printer_type)?.l ?? r.printer_type ?? "—"}</TableCell>
                <TableCell>{r.dpi ?? "—"}</TableCell>
                <TableCell>{r.raw_language ?? "driver"}</TableCell>
                <TableCell><StatusBadge status={r.status} /></TableCell>
                <TableCell className="flex gap-1">
                  <Button size="sm" variant="ghost" title="Compatibilidade" onClick={() => setCompatPrinter(r)}>
                    <Link2 className="size-4" />
                  </Button>
                  {canWrite && (
                    <Button size="sm" variant="ghost" title="Editar" onClick={() => { setForm({ ...empty, ...r }); setOpen(true); }}>
                      <Pencil className="size-4" />
                    </Button>
                  )}
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </Card>

      {compatPrinter && (
        <CompatibilityDialog
          printer={compatPrinter}
          companyId={companyId!}
          canWrite={!!canWrite}
          onClose={() => setCompatPrinter(null)}
        />
      )}

      {companyId && (
        <PrinterSetupWizard
          companyId={companyId}
          open={wizardOpen}
          onClose={() => setWizardOpen(false)}
          onRequestPairing={() => {
            setWizardOpen(false);
            setTimeout(() => {
              document.getElementById("pairing-section")?.scrollIntoView({ behavior: "smooth", block: "start" });
            }, 100);
          }}
        />
      )}

    </>
  );
}

function CompatibilityDialog({ printer, companyId, canWrite, onClose }: {
  printer: any; companyId: string; canWrite: boolean; onClose: () => void;
}) {
  const qc = useQueryClient();
  const [layoutId, setLayoutId] = useState<string>("");
  const [notes, setNotes] = useState("");

  const compat = useQuery({
    queryKey: ["printer-compat", printer.id],
    queryFn: () => PrinterCompatibilityService.listByPrinter(printer.id),
  });

  const layouts = useQuery({
    queryKey: ["layouts-for-compat", companyId],
    queryFn: async () => {
      const { data, error } = await (supabase.from("label_layouts" as any) as any)
        .select("id,name,label_type,format_id,status")
        .eq("company_id", companyId)
        .eq("status", "ativo")
        .order("name");
      if (error) throw error;
      return data as any[];
    },
  });

  const link = useMutation({
    mutationFn: async () => {
      if (!layoutId) throw new Error("Selecione um layout.");
      const layout = layouts.data?.find((l) => l.id === layoutId);
      await PrinterCompatibilityService.link({
        company_id: companyId,
        printer_id: printer.id,
        layout_id: layoutId,
        format_id: layout?.format_id ?? null,
        notes: notes || null,
      });
    },
    onSuccess: () => {
      toast.success("Layout vinculado");
      setLayoutId(""); setNotes("");
      qc.invalidateQueries({ queryKey: ["printer-compat", printer.id] });
    },
    onError: (e: any) => toast.error(e.message),
  });

  const unlink = useMutation({
    mutationFn: (id: string) => PrinterCompatibilityService.unlink(id),
    onSuccess: () => {
      toast.success("Vínculo removido");
      qc.invalidateQueries({ queryKey: ["printer-compat", printer.id] });
    },
    onError: (e: any) => toast.error(e.message),
  });

  const linkedIds = new Set((compat.data ?? []).map((c) => c.layout_id));
  const available = (layouts.data ?? []).filter((l) => !linkedIds.has(l.id));

  return (
    <Dialog open onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="max-w-2xl">
        <DialogHeader>
          <DialogTitle>Compatibilidade — {printer.name}</DialogTitle>
        </DialogHeader>

        {canWrite && (
          <div className="grid grid-cols-1 md:grid-cols-[1fr_1fr_auto] gap-2 items-end">
            <div>
              <Label>Layout compatível</Label>
              <Select value={layoutId} onValueChange={setLayoutId}>
                <SelectTrigger><SelectValue placeholder="Selecione..." /></SelectTrigger>
                <SelectContent>
                  {available.map((l) => (
                    <SelectItem key={l.id} value={l.id}>
                      {l.name} {l.label_type ? `(${l.label_type})` : ""}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div>
              <Label>Observações</Label>
              <Input value={notes} onChange={(e) => setNotes(e.target.value)} placeholder="Opcional" />
            </div>
            <Button onClick={() => link.mutate()} disabled={link.isPending || !layoutId}>
              <Plus className="size-4" /> Vincular
            </Button>
          </div>
        )}

        <Card className="p-3 mt-3">
          <Table>
            <TableHeader><TableRow>
              <TableHead>Layout</TableHead><TableHead>Tipo</TableHead>
              <TableHead>Observações</TableHead><TableHead></TableHead>
            </TableRow></TableHeader>
            <TableBody>
              {(compat.data ?? []).length === 0 && (
                <TableRow><TableCell colSpan={4} className="text-center text-muted-foreground">Nenhum layout vinculado.</TableCell></TableRow>
              )}
              {compat.data?.map((c) => (
                <TableRow key={c.id}>
                  <TableCell>{c.layout?.name ?? "—"}</TableCell>
                  <TableCell>{c.layout?.label_type ?? "—"}</TableCell>
                  <TableCell>{c.notes ?? "—"}</TableCell>
                  <TableCell>
                    {canWrite && (
                      <Button size="sm" variant="ghost" onClick={() => unlink.mutate(c.id)}>
                        <Trash2 className="size-4" />
                      </Button>
                    )}
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </Card>

        <DialogFooter>
          <Button variant="outline" onClick={onClose}>Fechar</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
