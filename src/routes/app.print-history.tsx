// FASE 10 — Histórico e Auditoria de Impressão
// Tela com DUAS abas:
//   - "Lotes"  → histórico de print_batches (legado, comportamento original preservado)
//   - "Jobs"   → histórico do print_queue (Print Agent / PDF fallback / reimpressões)
// A Fila de Impressão (FASE 9) permanece em /app/print-queue, dedicada ao operacional.

import { createFileRoute, Link } from "@tanstack/react-router";
import { useMemo, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useActiveCompany } from "@/hooks/use-active-company";
import { PageHeader } from "@/components/page-header";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Checkbox } from "@/components/ui/checkbox";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible";
import { LABEL_TYPES } from "@/lib/label-emission";
import { Button } from "@/components/ui/button";
import { FileDown, Printer as PrinterIcon, RotateCcw, AlertTriangle, Eye, PrinterCheck, ListChecks } from "lucide-react";
import { buildLabelsPdf, buildFormatFromSnapshot, buildLabelDataFromSnapshot, downloadBlob } from "@/lib/label-pdf";
import { toast } from "sonner";
import {
  PrintHistoryService,
  normalizeSource,
  normalizeStatus,
  type HistoryRow,
} from "@/lib/print/print-history-service";
import type { PrintJobStatus, PrintJobSource } from "@/lib/print/types";
import { sanitizePayload } from "@/lib/print/security";

export const Route = createFileRoute("/app/print-history")({ component: Page });

function Page() {
  return (
    <div className="space-y-6">
      <PageHeader
        title="Histórico e Auditoria de Impressão"
        description="Consulta rastreável de lotes emitidos e jobs enviados ao Print Agent ou via PDF."
        actions={
          <div className="flex gap-2 flex-wrap">
            <Button asChild variant="outline" size="sm">
              <Link to="/app/print-queue"><ListChecks className="size-4 mr-1" />Fila de Impressão</Link>
            </Button>
            <Button asChild size="sm">
              <Link to="/app/print-labels"><PrinterCheck className="size-4 mr-1" />Nova emissão</Link>
            </Button>
          </div>
        }
      />

      <Tabs defaultValue="jobs">
        <TabsList>
          <TabsTrigger value="jobs">Jobs (Print Agent / PDF)</TabsTrigger>
          <TabsTrigger value="batches">Lotes emitidos</TabsTrigger>
        </TabsList>
        <TabsContent value="jobs" className="mt-4"><JobsTab /></TabsContent>
        <TabsContent value="batches" className="mt-4"><BatchesTab /></TabsContent>
      </Tabs>
    </div>
  );
}

/* ============================================================
   ABA: JOBS (FASE 10 — novo, baseado em print_queue)
   ============================================================ */

const STATUS_VARIANT: Record<PrintJobStatus, "default" | "secondary" | "destructive" | "outline"> = {
  pending: "outline", sent: "secondary", printing: "secondary",
  completed: "default", failed: "destructive", canceled: "outline",
};

function JobsTab() {
  const { companyId } = useActiveCompany();
  const [from, setFrom] = useState("");
  const [to, setTo] = useState("");
  const [status, setStatus] = useState<string>("");
  const [source, setSource] = useState<string>("");
  const [printerId, setPrinterId] = useState("");
  const [layoutId, setLayoutId] = useState("");
  const [productId, setProductId] = useState("");
  const [userId, setUserId] = useState("");
  const [onlyReprints, setOnlyReprints] = useState(false);
  const [onlyFailures, setOnlyFailures] = useState(false);
  const [onlyCancellations, setOnlyCancellations] = useState(false);
  const [detail, setDetail] = useState<HistoryRow | null>(null);

  const printers = useQuery({
    queryKey: ["ph-printers", companyId], enabled: !!companyId,
    queryFn: async () => {
      const { data, error } = await supabase.from("printer_configs").select("id,name").eq("company_id", companyId!);
      if (error) throw error;
      return (data ?? []) as { id: string; name: string }[];
    },
  });

  const layouts = useQuery({
    queryKey: ["ph-layouts", companyId], enabled: !!companyId,
    queryFn: async () => {
      const { data, error } = await supabase.from("label_layouts").select("id,name").eq("company_id", companyId!);
      if (error) throw error;
      return (data ?? []) as { id: string; name: string }[];
    },
  });

  const users = useQuery({
    queryKey: ["ph-users", companyId], enabled: !!companyId,
    queryFn: () => PrintHistoryService.listUsersWithJobs(companyId!),
  });

  const jobs = useQuery({
    queryKey: ["ph-jobs", companyId, from, to, status, source, printerId, layoutId, productId, userId, onlyReprints, onlyFailures, onlyCancellations],
    enabled: !!companyId,
    queryFn: () => PrintHistoryService.list({
      companyId: companyId!,
      from: from || null,
      to: to || null,
      status: (status || "all") as any,
      source: (source || "all") as any,
      printerId: printerId || null,
      layoutId: layoutId || null,
      productId: productId || null,
      userId: userId || null,
      onlyReprints, onlyFailures, onlyCancellations,
      limit: 500,
    }),
  });

  const stats = useMemo(() => {
    const data = jobs.data ?? [];
    return {
      total: data.length,
      failed: data.filter((j) => j.status === "failed").length,
      canceled: data.filter((j) => j.status === "canceled").length,
      reprints: data.filter((j) => j.is_reprint).length,
      fallback: data.filter((j) => j.source === "pdf_fallback").length,
    };
  }, [jobs.data]);

  function exportCsv() {
    const rows = jobs.data ?? [];
    if (rows.length === 0) { toast.error("Sem registros para exportar."); return; }
    const csv = PrintHistoryService.toCsvRows(rows)
      .map((r) => r.map((c) => `"${String(c).replace(/"/g, '""')}"`).join(";"))
      .join("\n");
    const blob = new Blob([`\ufeff${csv}`], { type: "text/csv;charset=utf-8;" });
    downloadBlob(blob, `historico-impressao-${new Date().toISOString().slice(0, 10)}.csv`);
  }

  return (
    <div className="space-y-4">
      <Card className="p-4 grid grid-cols-2 md:grid-cols-4 gap-3">
        <div><Label>De</Label><Input type="date" value={from} onChange={(e) => setFrom(e.target.value)} /></div>
        <div><Label>Até</Label><Input type="date" value={to} onChange={(e) => setTo(e.target.value)} /></div>
        <div>
          <Label>Status</Label>
          <Select value={status || "all"} onValueChange={(v) => setStatus(v === "all" ? "" : v)}>
            <SelectTrigger><SelectValue /></SelectTrigger>
            <SelectContent>
              <SelectItem value="all">Todos</SelectItem>
              {(["pending", "sent", "printing", "completed", "failed", "canceled"] as PrintJobStatus[]).map((s) => (
                <SelectItem key={s} value={s}>{normalizeStatus(s)}</SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
        <div>
          <Label>Origem</Label>
          <Select value={source || "all"} onValueChange={(v) => setSource(v === "all" ? "" : v)}>
            <SelectTrigger><SelectValue /></SelectTrigger>
            <SelectContent>
              <SelectItem value="all">Todas</SelectItem>
              {(["print_agent", "pdf_fallback", "manual"] as PrintJobSource[]).map((s) => (
                <SelectItem key={s} value={s}>{normalizeSource(s)}</SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
        <div>
          <Label>Impressora</Label>
          <Select value={printerId || "all"} onValueChange={(v) => setPrinterId(v === "all" ? "" : v)}>
            <SelectTrigger><SelectValue placeholder="Todas" /></SelectTrigger>
            <SelectContent>
              <SelectItem value="all">Todas</SelectItem>
              {(printers.data ?? []).map((p) => <SelectItem key={p.id} value={p.id}>{p.name}</SelectItem>)}
            </SelectContent>
          </Select>
        </div>
        <div>
          <Label>Layout</Label>
          <Select value={layoutId || "all"} onValueChange={(v) => setLayoutId(v === "all" ? "" : v)}>
            <SelectTrigger><SelectValue placeholder="Todos" /></SelectTrigger>
            <SelectContent>
              <SelectItem value="all">Todos</SelectItem>
              {(layouts.data ?? []).map((l) => <SelectItem key={l.id} value={l.id}>{l.name}</SelectItem>)}
            </SelectContent>
          </Select>
        </div>
        <div>
          <Label>Usuário</Label>
          <Select value={userId || "all"} onValueChange={(v) => setUserId(v === "all" ? "" : v)}>
            <SelectTrigger><SelectValue placeholder="Todos" /></SelectTrigger>
            <SelectContent>
              <SelectItem value="all">Todos</SelectItem>
              {(users.data ?? []).map((u) => <SelectItem key={u.id} value={u.id}>{u.name}</SelectItem>)}
            </SelectContent>
          </Select>
        </div>
        <div><Label>Produto (ID)</Label><Input value={productId} onChange={(e) => setProductId(e.target.value)} placeholder="UUID" /></div>
        <div className="col-span-2 md:col-span-4 flex flex-wrap gap-4 pt-1">
          <label className="flex items-center gap-2 text-sm">
            <Checkbox checked={onlyReprints} onCheckedChange={(v) => setOnlyReprints(v === true)} />
            Apenas reimpressões
          </label>
          <label className="flex items-center gap-2 text-sm">
            <Checkbox checked={onlyFailures} onCheckedChange={(v) => setOnlyFailures(v === true)} />
            Apenas falhas
          </label>
          <label className="flex items-center gap-2 text-sm">
            <Checkbox checked={onlyCancellations} onCheckedChange={(v) => setOnlyCancellations(v === true)} />
            Apenas cancelamentos
          </label>
          <div className="ml-auto">
            <Button variant="outline" size="sm" onClick={exportCsv} disabled={(jobs.data?.length ?? 0) === 0}>
              <FileDown className="size-4 mr-1" />Exportar CSV
            </Button>
          </div>
        </div>
      </Card>

      <div className="grid grid-cols-2 md:grid-cols-5 gap-3 text-sm">
        <Stat label="Total" value={stats.total} />
        <Stat label="Falhas" value={stats.failed} tone={stats.failed ? "destructive" : "muted"} />
        <Stat label="Cancelamentos" value={stats.canceled} tone={stats.canceled ? "destructive" : "muted"} />
        <Stat label="Reimpressões" value={stats.reprints} tone="secondary" />
        <Stat label="Fallback PDF" value={stats.fallback} tone={stats.fallback ? "warn" : "muted"} />
      </div>

      <Card className="p-0 overflow-hidden">
        {jobs.isLoading ? (
          <div className="p-8 text-center text-sm text-muted-foreground">Carregando histórico…</div>
        ) : jobs.isError ? (
          <div className="p-8 text-center text-sm text-destructive">Erro ao carregar: {(jobs.error as any)?.message}</div>
        ) : (jobs.data?.length ?? 0) === 0 ? (
          <div className="p-8 text-center text-sm text-muted-foreground">
            <PrinterIcon className="size-8 mx-auto mb-2 opacity-50" />
            Nenhum job encontrado para os filtros selecionados.
          </div>
        ) : (
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Data / Hora</TableHead>
                <TableHead>Usuário</TableHead>
                <TableHead>Produto</TableHead>
                <TableHead>Layout</TableHead>
                <TableHead>Impressora</TableHead>
                <TableHead className="text-right">Qtd</TableHead>
                <TableHead>Origem</TableHead>
                <TableHead>Status</TableHead>
                <TableHead>Duração</TableHead>
                <TableHead></TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {jobs.data!.map((r) => {
                const rowTone =
                  r.status === "failed" ? "bg-destructive/5" :
                  r.status === "canceled" ? "bg-muted/40" : "";
                return (
                  <TableRow key={r.id} className={rowTone}>
                    <TableCell className="whitespace-nowrap text-xs">{new Date(r.created_at).toLocaleString("pt-BR")}</TableCell>
                    <TableCell className="text-sm">
                      {r.user_name ?? r.user_email ?? "—"}
                      {r.user_email && r.user_name && <div className="text-xs text-muted-foreground">{r.user_email}</div>}
                    </TableCell>
                    <TableCell className="text-sm">
                      {r.product_name ?? "—"}
                      {r.product_code && <div className="text-xs text-muted-foreground">{r.product_code}</div>}
                    </TableCell>
                    <TableCell className="text-sm">{r.layout_name ?? "—"}</TableCell>
                    <TableCell className="text-sm">{r.printer_name ?? "—"}</TableCell>
                    <TableCell className="text-right">{r.quantity}</TableCell>
                    <TableCell>
                      <Badge variant={r.source === "pdf_fallback" ? "outline" : "secondary"}>
                        {normalizeSource(r.source)}
                      </Badge>
                      {r.is_reprint && <Badge variant="outline" className="ml-1"><RotateCcw className="size-3 mr-1" />Reimpressão</Badge>}
                    </TableCell>
                    <TableCell>
                      <Badge variant={STATUS_VARIANT[r.status]}>{normalizeStatus(r.status)}</Badge>
                      {r.status === "failed" && <AlertTriangle className="size-3 inline ml-1 text-destructive" />}
                    </TableCell>
                    <TableCell className="text-xs text-muted-foreground">{PrintHistoryService.formatDuration(r.duration_ms)}</TableCell>
                    <TableCell className="text-right">
                      <Button variant="ghost" size="icon" onClick={() => setDetail(r)} title="Detalhes">
                        <Eye className="size-4" />
                      </Button>
                    </TableCell>
                  </TableRow>
                );
              })}
            </TableBody>
          </Table>
        )}
      </Card>

      <JobDetailDialog row={detail} onOpenChange={(o) => !o && setDetail(null)} />
    </div>
  );
}

function Stat({ label, value, tone = "muted" }: { label: string; value: number; tone?: "muted" | "destructive" | "warn" | "secondary" }) {
  const cls =
    tone === "destructive" ? "border-destructive/40 bg-destructive/5" :
    tone === "warn" ? "border-amber-300 bg-amber-50" :
    tone === "secondary" ? "border-primary/30 bg-primary/5" : "";
  return (
    <Card className={`p-3 ${cls}`}>
      <div className="text-xs text-muted-foreground">{label}</div>
      <div className="text-2xl font-semibold">{value}</div>
    </Card>
  );
}

function JobDetailDialog({ row, onOpenChange }: { row: HistoryRow | null; onOpenChange: (o: boolean) => void }) {
  return (
    <Dialog open={!!row} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-3xl">
        <DialogHeader><DialogTitle>Detalhes do job</DialogTitle></DialogHeader>
        {row && (
          <div className="space-y-3 text-sm">
            <div className="grid grid-cols-2 md:grid-cols-3 gap-3">
              <F label="ID" value={row.id} mono />
              <F label="Status" value={normalizeStatus(row.status)} />
              <F label="Origem" value={normalizeSource(row.source)} />
              <F label="Criado" value={new Date(row.created_at).toLocaleString("pt-BR")} />
              <F label="Iniciado" value={row.started_at ? new Date(row.started_at).toLocaleString("pt-BR") : "—"} />
              <F label="Concluído" value={row.finished_at ? new Date(row.finished_at).toLocaleString("pt-BR") : "—"} />
              <F label="Tentativas" value={String(row.attempts)} />
              <F label="Duração" value={PrintHistoryService.formatDuration(row.duration_ms)} />
              <F label="Quantidade" value={String(row.quantity)} />
              <F label="Usuário" value={row.user_name ?? row.user_email ?? "—"} />
              <F label="Produto" value={row.product_name ?? "—"} />
              <F label="Layout" value={row.layout_name ?? "—"} />
              <F label="Impressora" value={row.printer_name ?? "—"} />
              <F label="Agent Job ID" value={row.agent_job_id ?? "—"} mono />
              <F label="Lote" value={row.batch_id ?? "—"} mono />
              <F label="Reimpressão" value={row.is_reprint ? "Sim" : "Não"} />
              <F label="Job original" value={row.reprint_of ?? "—"} mono />
            </div>
            {row.error_message && (
              <div className="rounded-md border border-destructive/40 bg-destructive/5 p-3">
                <div className="text-xs font-semibold text-destructive mb-1">Mensagem de erro</div>
                <div className="text-xs whitespace-pre-wrap break-words">{row.error_message}</div>
              </div>
            )}
            <Collapsible>
              <CollapsibleTrigger asChild>
                <Button variant="outline" size="sm">Payload técnico</Button>
              </CollapsibleTrigger>
              <CollapsibleContent>
                <pre className="mt-2 max-h-80 overflow-auto rounded-md bg-muted p-3 text-xs">
                  {JSON.stringify(row.payload ?? {}, null, 2)}
                </pre>
              </CollapsibleContent>
            </Collapsible>
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}

function F({ label, value, mono }: { label: string; value: string; mono?: boolean }) {
  return (
    <div>
      <div className="text-xs text-muted-foreground">{label}</div>
      <div className={mono ? "font-mono text-xs break-all" : "text-sm"}>{value}</div>
    </div>
  );
}

/* ============================================================
   ABA: LOTES (legado — comportamento original preservado)
   ============================================================ */

function BatchesTab() {
  const { companyId } = useActiveCompany();
  const [from, setFrom] = useState("");

  async function downloadBatchPdf(batchId: string) {
    try {
      const { data: labels } = await (supabase.from("printed_labels" as any) as any)
        .select("*").eq("print_batch_id", batchId).order("sequential_number");
      const first = (labels as any[])?.find((l) => l.status !== "cancelled");
      if (!first) { toast.error("Lote sem etiquetas válidas"); return; }
      const { data: snap } = await (supabase.from("label_snapshots" as any) as any)
        .select("*").eq("printed_label_id", first.id).maybeSingle();
      if (!snap) { toast.error("Snapshot indisponível"); return; }
      const fmt = buildFormatFromSnapshot(snap.layout_snapshot);
      const elements = (snap.layout_snapshot?.elements ?? []) as any[];
      if (!fmt) { toast.error("Snapshot sem formato"); return; }
      const labelData = (labels as any[]).filter((l) => l.status !== "cancelled").map((l) =>
        buildLabelDataFromSnapshot(snap, { unique_label_code: l.unique_label_code, sequential: l.sequential_number }),
      );
      const blob = await buildLabelsPdf({ format: fmt as any, elements, labels: labelData });
      const fname = `lote-${batchId.slice(0, 8)}.pdf`;
      downloadBlob(blob, fname);
      const { data: u } = await supabase.auth.getUser();
      await (supabase.from("print_events" as any) as any).insert({
        company_id: snap.company_id, branch_id: snap.branch_id, print_batch_id: batchId,
        event_type: "pdf_downloaded", event_notes: `${labelData.length} etiqueta(s)`,
        metadata: { filename: fname }, created_by: u.user?.id ?? null,
      });
    } catch (e: any) { toast.error(e.message); }
  }

  const [to, setTo] = useState("");
  const [labelType, setLabelType] = useState<string>("");
  const [status, setStatus] = useState<string>("");
  const [productQ, setProductQ] = useState("");
  const [batchQ, setBatchQ] = useState("");

  const { data, isLoading } = useQuery({
    queryKey: ["print-batches", companyId, from, to, labelType, status, productQ, batchQ],
    enabled: !!companyId,
    queryFn: async () => {
      let q = (supabase.from("print_batches" as any) as any)
        .select("id, created_at, label_type, quantity, status, batch_code, label_layout_id, product_id, products(name, internal_code), label_layouts(name)")
        .eq("company_id", companyId!)
        .order("created_at", { ascending: false })
        .limit(200);
      if (from) q = q.gte("created_at", from);
      if (to) q = q.lte("created_at", to + "T23:59:59");
      if (labelType) q = q.eq("label_type", labelType);
      if (status) q = q.eq("status", status);
      if (batchQ) q = q.ilike("batch_code", `%${batchQ}%`);
      const { data, error } = await q;
      if (error) throw error;
      return data as any[];
    },
  });

  const rows = useMemo(() => {
    if (!data) return [];
    if (!productQ) return data;
    const s = productQ.toLowerCase();
    return data.filter((r) => r.products?.name?.toLowerCase().includes(s) || r.products?.internal_code?.toLowerCase().includes(s));
  }, [data, productQ]);

  return (
    <div className="space-y-4">
      <Card className="p-4 grid md:grid-cols-6 gap-3">
        <div><Label>De</Label><Input type="date" value={from} onChange={(e) => setFrom(e.target.value)} /></div>
        <div><Label>Até</Label><Input type="date" value={to} onChange={(e) => setTo(e.target.value)} /></div>
        <div>
          <Label>Tipo</Label>
          <Select value={labelType || "all"} onValueChange={(v) => setLabelType(v === "all" ? "" : v)}>
            <SelectTrigger><SelectValue /></SelectTrigger>
            <SelectContent>
              <SelectItem value="all">Todos</SelectItem>
              {LABEL_TYPES.map((t) => <SelectItem key={t.value} value={t.value}>{t.label}</SelectItem>)}
            </SelectContent>
          </Select>
        </div>
        <div>
          <Label>Status</Label>
          <Select value={status || "all"} onValueChange={(v) => setStatus(v === "all" ? "" : v)}>
            <SelectTrigger><SelectValue /></SelectTrigger>
            <SelectContent>
              <SelectItem value="all">Todos</SelectItem>
              <SelectItem value="generated">Gerado</SelectItem>
              <SelectItem value="cancelled">Cancelado</SelectItem>
              <SelectItem value="reprinted">Reimpresso</SelectItem>
              <SelectItem value="draft">Rascunho</SelectItem>
            </SelectContent>
          </Select>
        </div>
        <div><Label>Produto</Label><Input value={productQ} onChange={(e) => setProductQ(e.target.value)} placeholder="Nome ou código" /></div>
        <div><Label>Lote</Label><Input value={batchQ} onChange={(e) => setBatchQ(e.target.value)} /></div>
      </Card>

      <Card className="p-0 overflow-hidden">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Data</TableHead>
              <TableHead>Produto</TableHead>
              <TableHead>Tipo</TableHead>
              <TableHead>Layout</TableHead>
              <TableHead>Lote</TableHead>
              <TableHead className="text-right">Qtd</TableHead>
              <TableHead>Status</TableHead>
              <TableHead></TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {isLoading && <TableRow><TableCell colSpan={8}>Carregando...</TableCell></TableRow>}
            {!isLoading && rows.length === 0 && <TableRow><TableCell colSpan={8} className="text-center text-muted-foreground py-8">Nenhum lote encontrado.</TableCell></TableRow>}
            {rows.map((r) => (
              <TableRow key={r.id}>
                <TableCell className="whitespace-nowrap">{new Date(r.created_at).toLocaleString("pt-BR")}</TableCell>
                <TableCell>{r.products?.name ?? "—"}<div className="text-xs text-muted-foreground">{r.products?.internal_code}</div></TableCell>
                <TableCell><Badge variant="secondary">{r.label_type}</Badge></TableCell>
                <TableCell>{r.label_layouts?.name ?? "—"}</TableCell>
                <TableCell>{r.batch_code ?? "—"}</TableCell>
                <TableCell className="text-right">{r.quantity}</TableCell>
                <TableCell><Badge variant={r.status === "generated" ? "default" : r.status === "cancelled" ? "destructive" : "outline"}>{r.status}</Badge></TableCell>
                <TableCell className="text-right space-x-1">
                  <Button variant="ghost" size="sm" onClick={() => downloadBatchPdf(r.id)} title="Baixar PDF do lote"><FileDown className="size-4" /></Button>
                  <Button asChild variant="outline" size="sm"><Link to="/app/print-history/$id" params={{ id: r.id }}>Detalhes</Link></Button>
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </Card>
    </div>
  );
}
