// FASE 12 — Impressão em Lote.
// Tela operacional para montar uma lista de itens (produto + layout + impressora + quantidade)
// e disparar impressão em lote. Reusa: PrinterCompatibilityService, runDirectPrint
// (via runBatchPrint), PrintQueueService, Layout Engine e fallback PDF de label-pdf.
//
// NÃO altera emissão individual, fila, histórico, dashboard, layouts ou PDF.

import { createFileRoute, Link } from "@tanstack/react-router";
import { useEffect, useMemo, useState } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useActiveCompany } from "@/hooks/use-active-company";
import { PageHeader } from "@/components/page-header";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Badge } from "@/components/ui/badge";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogDescription,
} from "@/components/ui/dialog";
import { toast } from "sonner";
import {
  AlertTriangle, Copy, Plus, Printer as PrinterIcon, RefreshCw,
  Send, Trash2, Loader2, History, BarChart3, ListChecks,
} from "lucide-react";
import { PrintAgentPanel } from "@/components/print/print-agent-panel";
import { usePrintAgent } from "@/lib/print/use-print-agent";
import { PrinterCompatibilityService } from "@/lib/print/printer-compatibility-service";
import {
  newBatchItem, runBatchPrint, validateBatchItem,
  type BatchItemState, type BatchPrintItem, type BatchPrintSummary,
} from "@/lib/print/batch-print";
import type { LayoutSnapshot } from "@/lib/print/direct-print";

export const Route = createFileRoute("/app/print-batch")({ component: PrintBatchPage });

type Draft = {
  id: string;
  productId: string;
  layoutId: string;
  printerId: string;
  quantity: number;
  notes: string;
};

function emptyDraft(): Draft {
  return {
    id: (globalThis.crypto?.randomUUID?.() ?? `d-${Date.now()}-${Math.random()}`),
    productId: "",
    layoutId: "",
    printerId: "",
    quantity: 1,
    notes: "",
  };
}

function statusBadge(status: BatchItemState["status"]) {
  const map: Record<string, { label: string; cls: string }> = {
    pending: { label: "Pendente", cls: "bg-slate-200 text-slate-800" },
    validating: { label: "Validando", cls: "bg-slate-200 text-slate-800" },
    invalid: { label: "Inválido", cls: "bg-red-100 text-red-800" },
    ready: { label: "Pronto", cls: "bg-blue-100 text-blue-800" },
    sending: { label: "Enviando", cls: "bg-amber-100 text-amber-800" },
    sent: { label: "Enviado", cls: "bg-emerald-100 text-emerald-800" },
    failed: { label: "Falhou", cls: "bg-red-100 text-red-800" },
    fallback_pdf: { label: "Fallback PDF", cls: "bg-orange-100 text-orange-800" },
    canceled: { label: "Cancelado", cls: "bg-slate-200 text-slate-800" },
  };
  const m = map[status] ?? map.pending;
  return <span className={`text-xs px-2 py-0.5 rounded ${m.cls}`}>{m.label}</span>;
}

function PrintBatchPage() {
  const { companyId, role, canCreateProduct, isReadOnly } = useActiveCompany();
  const agent = usePrintAgent(companyId);

  const [drafts, setDrafts] = useState<Draft[]>([emptyDraft()]);
  const [running, setRunning] = useState(false);
  const [progress, setProgress] = useState<{ done: number; total: number }>({ done: 0, total: 0 });
  const [summary, setSummary] = useState<BatchPrintSummary | null>(null);
  const [showConfirm, setShowConfirm] = useState(false);
  const [showClearConfirm, setShowClearConfirm] = useState(false);

  // ===== Lookups =====
  const products = useQuery({
    queryKey: ["pb-products", companyId],
    enabled: !!companyId,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("products")
        .select("id,name,internal_code,ean,variable_weight,standard_weight,unit_of_measure,contains_gluten,contains_lactose,preservation,sku,nutrition_fact_id,status")
        .eq("company_id", companyId!).eq("status", "ativo" as any).order("name");
      if (error) throw error;
      return data as any[];
    },
  });

  const printers = useQuery({
    queryKey: ["pb-printers", companyId],
    enabled: !!companyId,
    queryFn: async () => {
      const { data, error } = await (supabase.from("printer_configs" as any) as any)
        .select("*").eq("company_id", companyId!).eq("status", "ativo");
      if (error) throw error;
      return data as any[];
    },
  });

  const layouts = useQuery({
    queryKey: ["pb-layouts", companyId],
    enabled: !!companyId,
    queryFn: async () => {
      const { data, error } = await (supabase.from("label_layouts" as any) as any)
        .select("id,name,status,label_type,current_version,format_id, label_formats(*)")
        .eq("company_id", companyId!).eq("status", "ativo");
      if (error) throw error;
      return data as any[];
    },
  });

  // Compat por impressora (cache simples)
  const printerCompat = useQuery({
    queryKey: ["pb-compat", companyId, printers.data?.map((p) => p.id).join(",")],
    enabled: !!printers.data?.length,
    queryFn: async () => {
      const map: Record<string, string[]> = {};
      for (const p of printers.data!) {
        const rows = await PrinterCompatibilityService.listByPrinter(p.id);
        map[p.id] = rows.map((r) => r.layout_id).filter(Boolean) as string[];
      }
      return map;
    },
  });

  function setDraftField<K extends keyof Draft>(id: string, k: K, v: Draft[K]) {
    setDrafts((d) => d.map((it) => (it.id === id ? { ...it, [k]: v } : it)));
  }

  function addDraft() { setDrafts((d) => [...d, emptyDraft()]); }
  function removeDraft(id: string) { setDrafts((d) => d.filter((x) => x.id !== id)); }
  function duplicateDraft(id: string) {
    setDrafts((d) => {
      const found = d.find((x) => x.id === id);
      if (!found) return d;
      const copy: Draft = { ...found, id: emptyDraft().id };
      const idx = d.findIndex((x) => x.id === id);
      const next = d.slice();
      next.splice(idx + 1, 0, copy);
      return next;
    });
  }
  function clearAll() { setDrafts([emptyDraft()]); setSummary(null); }

  // ===== Conversão Draft -> BatchPrintItem =====
  function buildItem(draft: Draft): BatchPrintItem | { error: string } {
    if (!companyId) return { error: "Empresa não selecionada." };
    const product = products.data?.find((p) => p.id === draft.productId);
    const layout = layouts.data?.find((l) => l.id === draft.layoutId);
    const printer = printers.data?.find((p) => p.id === draft.printerId);
    if (!product) return { error: "Produto não selecionado." };
    if (!layout) return { error: "Layout não selecionado." };
    if (!printer) return { error: "Impressora não selecionada." };
    const fmt = layout.label_formats;
    const layoutSnap: LayoutSnapshot = {
      id: layout.id,
      name: layout.name,
      status: layout.status,
      label_type: layout.label_type,
      format: fmt ? {
        id: fmt.id,
        width: Number(fmt.width), height: Number(fmt.height), unit: fmt.unit,
        margin_top: Number(fmt.margin_top), margin_right: Number(fmt.margin_right),
        margin_bottom: Number(fmt.margin_bottom), margin_left: Number(fmt.margin_left),
        orientation: fmt.orientation,
      } : null,
      // Elementos são carregados lazy só se necessário — para validação dimensional
      // bastam dados de formato; o orquestrador valida com o que existir.
      elements: [],
    };
    const compatIds = printerCompat.data?.[printer.id] ?? [];
    return newBatchItem({
      id: draft.id,
      companyId,
      productId: product.id,
      productName: product.name,
      printer: printer as any,
      layout: layoutSnap,
      quantity: draft.quantity,
      compatibleLayoutIds: compatIds,
      labelData: {
        product_name: product.name,
        internal_code: product.internal_code,
        ean: product.ean,
        sku: product.sku,
      },
      notes: draft.notes || null,
    });
  }

  const itemsBuilt = useMemo(() => drafts.map((d) => ({ draft: d, item: buildItem(d) })), [drafts, products.data, printers.data, layouts.data, printerCompat.data, companyId]);

  const itemValidations = useMemo(
    () => itemsBuilt.map(({ draft, item }) => {
      if ("error" in item) return { draftId: draft.id, ok: false, errors: [item.error] };
      const v = validateBatchItem(item as BatchPrintItem);
      return { draftId: draft.id, ok: v.ok, errors: v.errors };
    }),
    [itemsBuilt],
  );

  const validCount = itemValidations.filter((v) => v.ok).length;
  const invalidCount = itemValidations.length - validCount;

  // ===== Execução =====
  async function runBatch() {
    if (!companyId) return;
    setShowConfirm(false);
    const valid = itemsBuilt
      .map(({ item }) => item)
      .filter((i): i is BatchPrintItem => !("error" in i));
    if (valid.length === 0) {
      toast.error("Nenhum item válido para enviar.");
      return;
    }
    setRunning(true);
    setSummary(null);
    setProgress({ done: 0, total: valid.length });
    try {
      const s = await runBatchPrint(agent.client, valid, {
        onProgress: (p) => setProgress({ done: p.done, total: p.total }),
      });
      setSummary(s);
      if (s.sent === s.total) toast.success(`Lote enviado: ${s.sent} item(s).`);
      else if (s.fallback > 0) toast.warning(`Lote concluído com ${s.fallback} fallback(s) PDF. ${s.sent} enviado(s).`);
      else toast.warning(`Lote concluído: ${s.sent} enviado(s), ${s.failed} falha(s), ${s.invalid} inválido(s).`);
    } catch (e: any) {
      toast.error(`Falha geral do lote: ${e?.message ?? String(e)}`);
    } finally {
      setRunning(false);
    }
  }

  // Fallback PDF item-a-item — gera um PDF por item com fallback_pdf
  async function downloadPdfForFailed() {
    if (!summary) return;
    const { buildLabelsPdf, openBlob } = await import("@/lib/label-pdf");
    const failed = summary.items.filter((i) => i.status === "fallback_pdf" || i.status === "failed");
    if (!failed.length) { toast.info("Sem itens para fallback PDF."); return; }
    for (const it of failed) {
      const fmt = it.layout.format;
      if (!fmt) continue;
      try {
        const labels = Array.from({ length: it.quantity }, () => it.labelData as any);
        const blob = await buildLabelsPdf({ format: fmt as any, elements: it.layout.elements as any, labels });
        openBlob(blob);
      } catch (e: any) {
        toast.error(`PDF falhou para ${it.productName}: ${e?.message ?? e}`);
      }
    }
  }

  async function reprintFailed() {
    if (!summary) return;
    const failed = summary.items.filter((i) => i.status === "failed" || i.status === "fallback_pdf");
    if (!failed.length) { toast.info("Sem itens com falha."); return; }
    // Recria drafts apenas com falhos para reprocesso
    const newDrafts: Draft[] = failed.map((f) => ({
      id: emptyDraft().id,
      productId: f.productId,
      layoutId: f.layout.id,
      printerId: f.printer.id,
      quantity: f.quantity,
      notes: f.notes ?? "",
    }));
    setDrafts(newDrafts);
    setSummary(null);
    toast.info(`${newDrafts.length} item(ns) com falha carregado(s) para reenvio. Revise e confirme.`);
  }

  // ===== UI =====
  if (isReadOnly || !canCreateProduct) {
    return (
      <div className="space-y-4">
        <PageHeader title="Impressão em Lote" />
        <Alert variant="destructive">
          <AlertTriangle className="h-4 w-4" />
          <AlertTitle>Acesso restrito</AlertTitle>
          <AlertDescription>Seu perfil não permite emitir etiquetas em lote.</AlertDescription>
        </Alert>
      </div>
    );
  }

  if (!companyId) {
    return (
      <div className="space-y-4">
        <PageHeader title="Impressão em Lote" />
        <Alert><AlertTitle>Empresa não selecionada</AlertTitle></Alert>
      </div>
    );
  }

  const loadingLookups = products.isLoading || printers.isLoading || layouts.isLoading;

  return (
    <div className="space-y-6">
      <PageHeader
        title="Impressão em Lote"
        description="Monte uma lista com múltiplos produtos/layouts/impressoras e envie em uma operação controlada. Cada item é validado e enviado individualmente; falhas têm fallback PDF."
      />

      <div className="flex flex-wrap gap-2">
        <Button asChild variant="outline" size="sm"><Link to="/app/print-queue"><ListChecks className="w-4 h-4 mr-1" />Fila</Link></Button>
        <Button asChild variant="outline" size="sm"><Link to="/app/print-history"><History className="w-4 h-4 mr-1" />Histórico</Link></Button>
        <Button asChild variant="outline" size="sm"><Link to="/app/print-dashboard"><BarChart3 className="w-4 h-4 mr-1" />Dashboard</Link></Button>
      </div>

      <PrintAgentPanel companyId={companyId} canManage={role === "administrador"} />

      {!agent.health?.ok && (
        <Alert variant="destructive">
          <AlertTriangle className="h-4 w-4" />
          <AlertTitle>Print Agent offline</AlertTitle>
          <AlertDescription>
            O agente local não está respondendo. O lote ainda pode ser montado e validado.
            Ao enviar, itens com falha de conexão serão sinalizados para fallback PDF.
          </AlertDescription>
        </Alert>
      )}

      <Card className="p-5 space-y-4">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <h3 className="font-semibold">Itens do lote</h3>
            <p className="text-sm text-muted-foreground">
              {drafts.length} item(ns) · {validCount} válido(s) · {invalidCount} inválido(s)
            </p>
          </div>
          <div className="flex gap-2">
            <Button variant="outline" size="sm" onClick={addDraft} disabled={running}>
              <Plus className="w-4 h-4 mr-1" /> Adicionar item
            </Button>
            <Button variant="outline" size="sm" onClick={() => setShowClearConfirm(true)} disabled={running || drafts.length === 0}>
              <Trash2 className="w-4 h-4 mr-1" /> Limpar lote
            </Button>
          </div>
        </div>

        {loadingLookups ? (
          <div className="text-sm text-muted-foreground flex items-center gap-2">
            <Loader2 className="w-4 h-4 animate-spin" /> Carregando dados…
          </div>
        ) : drafts.length === 0 ? (
          <div className="text-sm text-muted-foreground py-8 text-center">
            Nenhum item adicionado. Use “Adicionar item” para começar.
          </div>
        ) : (
          <div className="space-y-3">
            {drafts.map((d, idx) => {
              const v = itemValidations[idx];
              const sentState = summary?.items.find((s) => s.id === d.id);
              return (
                <div key={d.id} className="border rounded-lg p-3 space-y-2 bg-card">
                  <div className="flex items-start justify-between gap-2">
                    <div className="flex items-center gap-2">
                      <Badge variant="outline">#{idx + 1}</Badge>
                      {sentState ? statusBadge(sentState.status) : (v?.ok ? statusBadge("ready") : statusBadge("invalid"))}
                    </div>
                    <div className="flex gap-1">
                      <Button size="sm" variant="ghost" onClick={() => duplicateDraft(d.id)} disabled={running}>
                        <Copy className="w-4 h-4" />
                      </Button>
                      <Button size="sm" variant="ghost" onClick={() => removeDraft(d.id)} disabled={running}>
                        <Trash2 className="w-4 h-4" />
                      </Button>
                    </div>
                  </div>
                  <div className="grid md:grid-cols-4 gap-3">
                    <div>
                      <Label>Produto</Label>
                      <Select value={d.productId} onValueChange={(v) => setDraftField(d.id, "productId", v)} disabled={running}>
                        <SelectTrigger><SelectValue placeholder="Selecione…" /></SelectTrigger>
                        <SelectContent>
                          {products.data?.map((p) => (
                            <SelectItem key={p.id} value={p.id}>
                              {p.name}{p.internal_code ? ` · ${p.internal_code}` : ""}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>
                    <div>
                      <Label>Layout</Label>
                      <Select value={d.layoutId} onValueChange={(v) => setDraftField(d.id, "layoutId", v)} disabled={running}>
                        <SelectTrigger><SelectValue placeholder="Selecione…" /></SelectTrigger>
                        <SelectContent>
                          {layouts.data?.map((l) => (
                            <SelectItem key={l.id} value={l.id}>{l.name}</SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>
                    <div>
                      <Label>Impressora</Label>
                      <Select value={d.printerId} onValueChange={(v) => setDraftField(d.id, "printerId", v)} disabled={running}>
                        <SelectTrigger><SelectValue placeholder="Selecione…" /></SelectTrigger>
                        <SelectContent>
                          {printers.data?.map((p) => (
                            <SelectItem key={p.id} value={p.id}>{p.name}</SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>
                    <div>
                      <Label>Quantidade</Label>
                      <Input
                        type="number" min={1} max={5000}
                        value={d.quantity}
                        onChange={(e) => setDraftField(d.id, "quantity", Math.max(1, Number(e.target.value) || 1))}
                        disabled={running}
                      />
                    </div>
                  </div>
                  <div>
                    <Label className="text-xs">Observação (opcional)</Label>
                    <Input value={d.notes} onChange={(e) => setDraftField(d.id, "notes", e.target.value)} disabled={running} />
                  </div>
                  {v && !v.ok && (
                    <ul className="text-xs text-red-700 list-disc pl-5 space-y-0.5">
                      {v.errors.map((err, i) => <li key={i}>{err}</li>)}
                    </ul>
                  )}
                  {sentState?.result?.errorMessage && (
                    <div className="text-xs text-red-700">{sentState.result.errorMessage}</div>
                  )}
                </div>
              );
            })}
          </div>
        )}

        <div className="flex flex-wrap items-center justify-between gap-3 pt-2">
          <div className="text-sm text-muted-foreground">
            {running ? `Enviando ${progress.done}/${progress.total}…` : "Confirme antes de enviar."}
          </div>
          <Button onClick={() => setShowConfirm(true)} disabled={running || validCount === 0}>
            {running ? <Loader2 className="w-4 h-4 mr-1 animate-spin" /> : <Send className="w-4 h-4 mr-1" />}
            Enviar lote ({validCount})
          </Button>
        </div>
      </Card>

      {summary && (
        <Card className="p-5 space-y-3">
          <h3 className="font-semibold flex items-center gap-2"><PrinterIcon className="w-4 h-4" /> Resumo do lote</h3>
          <div className="grid grid-cols-2 md:grid-cols-5 gap-3 text-sm">
            <div><div className="text-muted-foreground">Total</div><div className="text-2xl font-semibold">{summary.total}</div></div>
            <div><div className="text-muted-foreground">Enviados</div><div className="text-2xl font-semibold text-emerald-700">{summary.sent}</div></div>
            <div><div className="text-muted-foreground">Falhas</div><div className="text-2xl font-semibold text-red-700">{summary.failed}</div></div>
            <div><div className="text-muted-foreground">Fallback PDF</div><div className="text-2xl font-semibold text-orange-700">{summary.fallback}</div></div>
            <div><div className="text-muted-foreground">Inválidos</div><div className="text-2xl font-semibold text-slate-700">{summary.invalid}</div></div>
          </div>
          <div className="text-xs text-muted-foreground">batch_group_id: <code>{summary.batchGroupId}</code></div>
          <div className="flex flex-wrap gap-2">
            <Button size="sm" variant="outline" onClick={reprintFailed} disabled={summary.failed + summary.fallback === 0}>
              <RefreshCw className="w-4 h-4 mr-1" /> Reimprimir falhos ({summary.failed + summary.fallback})
            </Button>
            <Button size="sm" variant="outline" onClick={downloadPdfForFailed} disabled={summary.failed + summary.fallback === 0}>
              PDF dos falhos
            </Button>
            <Button asChild size="sm" variant="ghost"><Link to="/app/print-queue">Ver na fila</Link></Button>
          </div>
        </Card>
      )}

      {/* Confirmações */}
      <Dialog open={showConfirm} onOpenChange={setShowConfirm}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Confirmar envio do lote</DialogTitle>
            <DialogDescription>
              Serão enviados {validCount} item(ns) válido(s) ao Print Agent.
              {invalidCount > 0 && ` ${invalidCount} item(ns) inválido(s) NÃO serão enviados.`}
              {!agent.health?.ok && " Print Agent offline — itens serão direcionados a fallback PDF."}
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowConfirm(false)}>Cancelar</Button>
            <Button onClick={runBatch}><Send className="w-4 h-4 mr-1" />Confirmar e enviar</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={showClearConfirm} onOpenChange={setShowClearConfirm}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Limpar lote?</DialogTitle>
            <DialogDescription>Esta ação remove todos os itens montados (não afeta jobs já enviados).</DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowClearConfirm(false)}>Cancelar</Button>
            <Button variant="destructive" onClick={() => { clearAll(); setShowClearConfirm(false); }}>Limpar</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
