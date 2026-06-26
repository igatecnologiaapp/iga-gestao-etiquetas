// FASE 9 — Fila de Impressão (UI operacional).
// Lista, filtra, reimprime e cancela jobs em `print_queue` usando os
// services existentes (PrintQueueService + PrintAgentClient + layout engine).
// Não toca em label-pdf, preview, layouts nem schema.

import { createFileRoute, Link } from "@tanstack/react-router";
import { useMemo, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useActiveCompany } from "@/hooks/use-active-company";
import { PageHeader } from "@/components/page-header";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription,
  AlertDialogFooter, AlertDialogHeader, AlertDialogTitle, AlertDialogTrigger,
} from "@/components/ui/alert-dialog";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible";
import { toast } from "sonner";
import { Printer as PrinterIcon, RefreshCw, X, Eye, FileWarning, ArrowLeft, Settings2 } from "lucide-react";
import { PrintQueueService } from "@/lib/print/print-queue-service";
import { PrintAgentError, PrintAgentOfflineError } from "@/lib/print/print-agent-client";
import { usePrintAgent } from "@/lib/print/use-print-agent";
import type { PrintJobStatus, PrintQueueJob } from "@/lib/print/types";
import { sanitizePayload } from "@/lib/print/security";

export const Route = createFileRoute("/app/print-queue")({ component: PrintQueuePage });

const STATUS_LABEL: Record<PrintJobStatus, string> = {
  pending: "Pendente", sent: "Enviado", printing: "Imprimindo",
  completed: "Concluído", failed: "Falhou", canceled: "Cancelado",
};

const STATUS_VARIANT: Record<PrintJobStatus, "default" | "secondary" | "destructive" | "outline"> = {
  pending: "outline", sent: "secondary", printing: "secondary",
  completed: "default", failed: "destructive", canceled: "outline",
};

function formatDateTime(iso: string | null): string {
  if (!iso) return "—";
  try { return new Date(iso).toLocaleString("pt-BR"); } catch { return iso; }
}

function shortId(id: string | null): string {
  return id ? id.slice(0, 8) : "—";
}

function PrintQueuePage() {
  const { companyId, role, canWrite } = useActiveCompany();
  const qc = useQueryClient();
  const agent = usePrintAgent(companyId);
  const canManage = canWrite; // administrador/supervisor — operador vê apenas próprios via RLS

  const [status, setStatus] = useState<string>("all");
  const [from, setFrom] = useState<string>("");
  const [to, setTo] = useState<string>("");
  const [printerId, setPrinterId] = useState<string>("");
  const [layoutId, setLayoutId] = useState<string>("");
  const [productId, setProductId] = useState<string>("");
  const [userIdF, setUserIdF] = useState<string>("");
  const [source, setSource] = useState<string>("");
  const [detail, setDetail] = useState<PrintQueueJob | null>(null);

  const printers = useQuery({
    queryKey: ["pq-printers", companyId], enabled: !!companyId,
    queryFn: async () => {
      const { data, error } = await supabase.from("printer_configs").select("id,name").eq("company_id", companyId!);
      if (error) throw error;
      return (data ?? []) as { id: string; name: string }[];
    },
  });

  const layouts = useQuery({
    queryKey: ["pq-layouts", companyId], enabled: !!companyId,
    queryFn: async () => {
      const { data, error } = await supabase.from("label_layouts").select("id,name").eq("company_id", companyId!);
      if (error) throw error;
      return (data ?? []) as { id: string; name: string }[];
    },
  });

  const jobs = useQuery({
    queryKey: ["print-queue", companyId, status, from, to, printerId, layoutId, productId, userIdF, source],
    enabled: !!companyId,
    queryFn: async () => {
      let q = (supabase.from("print_queue" as any) as any)
        .select("*").eq("company_id", companyId!).order("created_at", { ascending: false }).limit(200);
      if (status !== "all") q = q.eq("status", status);
      if (from) q = q.gte("created_at", from);
      if (to) q = q.lte("created_at", `${to}T23:59:59`);
      if (printerId) q = q.eq("printer_id", printerId);
      if (layoutId) q = q.eq("layout_id", layoutId);
      if (productId) q = q.eq("product_id", productId);
      if (userIdF) q = q.eq("user_id", userIdF);
      if (source) q = q.eq("source", source);
      const { data, error } = await q;
      if (error) throw new Error(error.message);
      return (data ?? []) as PrintQueueJob[];
    },
  });

  const cancelMut = useMutation({
    mutationFn: async (job: PrintQueueJob) => {
      if (["completed", "canceled", "failed"].includes(job.status)) {
        throw new Error("Este job não pode ser cancelado.");
      }
      if (job.status === "sent" || job.status === "printing") {
        if (job.agent_job_id) {
          try { await agent.client.cancelJob(job.agent_job_id); }
          catch (e: any) {
            if (e instanceof PrintAgentOfflineError) {
              throw new Error("Print Agent offline — não foi possível cancelar no agente.");
            }
            if (e instanceof PrintAgentError) {
              throw new Error(`Agente recusou cancelamento: ${e.message}`);
            }
            throw e;
          }
        }
      }
      await PrintQueueService.cancel(job.id, "Cancelado pelo operador");
    },
    onSuccess: () => { toast.success("Job cancelado."); qc.invalidateQueries({ queryKey: ["print-queue"] }); },
    onError: (e: any) => toast.error(e?.message ?? "Falha ao cancelar"),
  });

  const reprintMut = useMutation({
    mutationFn: async (job: PrintQueueJob) => {
      // Revalidação mínima antes de reenfileirar
      if (!job.printer_id || !job.layout_id) {
        throw new Error("Job original sem impressora/layout — reimpressão indisponível.");
      }
      const { data: printer, error: pErr } = await supabase
        .from("printer_configs").select("status").eq("id", job.printer_id).maybeSingle();
      if (pErr) throw new Error(pErr.message);
      if (!printer || (printer as any).status !== "ativo") {
        throw new Error("Impressora original inativa ou removida.");
      }
      const { data: layout, error: lErr } = await supabase
        .from("label_layouts").select("status").eq("id", job.layout_id).maybeSingle();
      if (lErr) throw new Error(lErr.message);
      if (!layout || (layout as any).status !== "ativo") {
        throw new Error("Layout original inativo ou removido.");
      }
      // Compatibilidade explícita (FASE 6)
      const { data: compat } = await (supabase.from("printer_layout_compatibility" as any) as any)
        .select("layout_id").eq("printer_id", job.printer_id);
      const ids = ((compat ?? []) as any[]).map((r) => r.layout_id);
      if (ids.length > 0 && !ids.includes(job.layout_id)) {
        throw new Error("Impressora não é mais compatível com este layout.");
      }
      // Cria NOVO job (preserva o original) com referência cruzada no payload
      const payload = {
        ...(job.payload ?? {}),
        reprint_of: job.id,
        reprint_at: new Date().toISOString(),
      };
      return PrintQueueService.enqueue({
        company_id: job.company_id,
        branch_id: job.branch_id,
        printer_id: job.printer_id,
        layout_id: job.layout_id,
        product_id: job.product_id,
        batch_id: job.batch_id,
        quantity: job.quantity,
        source: job.source,
        payload,
      });
    },
    onSuccess: () => { toast.success("Reimpressão enfileirada."); qc.invalidateQueries({ queryKey: ["print-queue"] }); },
    onError: (e: any) => toast.error(e?.message ?? "Falha ao reimprimir"),
  });

  const printerName = (id: string | null) => id ? (printers.data?.find((p) => p.id === id)?.name ?? shortId(id)) : "—";
  const layoutName = (id: string | null) => id ? (layouts.data?.find((l) => l.id === id)?.name ?? shortId(id)) : "—";

  const agentOffline = !agent.loading && !agent.health?.ok;

  return (
    <div className="space-y-4">
      <PageHeader
        title="Fila de Impressão"
        description="Trabalhos enviados ao Print Agent — acompanhe, reimprima ou cancele."
        actions={
          <div className="flex gap-2">
            <Button asChild variant="outline" size="sm"><Link to="/app/print-labels"><ArrowLeft className="size-4 mr-1" />Emissão</Link></Button>
            {canManage && (
              <Button asChild variant="outline" size="sm"><Link to="/app/printers"><Settings2 className="size-4 mr-1" />Impressoras</Link></Button>
            )}
            <Button size="sm" variant="ghost" onClick={() => jobs.refetch()}><RefreshCw className="size-4" /></Button>
          </div>
        }
      />

      {agentOffline && (
        <Card className="p-3 border-amber-300 bg-amber-50 text-amber-900 text-sm flex items-center gap-2">
          <FileWarning className="size-4" />
          Print Agent offline ou sem token configurado nesta estação. Cancelamentos no agente e reimpressões diretas podem falhar.
        </Card>
      )}

      <Card className="p-4 grid grid-cols-1 md:grid-cols-4 gap-3">
        <div>
          <Label>Status</Label>
          <Select value={status} onValueChange={setStatus}>
            <SelectTrigger><SelectValue /></SelectTrigger>
            <SelectContent>
              <SelectItem value="all">Todos</SelectItem>
              {(Object.keys(STATUS_LABEL) as PrintJobStatus[]).map((s) => (
                <SelectItem key={s} value={s}>{STATUS_LABEL[s]}</SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
        <div><Label>De</Label><Input type="date" value={from} onChange={(e) => setFrom(e.target.value)} /></div>
        <div><Label>Até</Label><Input type="date" value={to} onChange={(e) => setTo(e.target.value)} /></div>
        <div>
          <Label>Origem</Label>
          <Select value={source || "all"} onValueChange={(v) => setSource(v === "all" ? "" : v)}>
            <SelectTrigger><SelectValue /></SelectTrigger>
            <SelectContent>
              <SelectItem value="all">Todas</SelectItem>
              <SelectItem value="print_agent">Print Agent</SelectItem>
              <SelectItem value="pdf_fallback">PDF fallback</SelectItem>
              <SelectItem value="manual">Manual</SelectItem>
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
        <div><Label>Produto (ID)</Label><Input value={productId} onChange={(e) => setProductId(e.target.value)} placeholder="UUID" /></div>
        <div><Label>Usuário (ID)</Label><Input value={userIdF} onChange={(e) => setUserIdF(e.target.value)} placeholder="UUID" /></div>
      </Card>

      <Card>
        {jobs.isLoading ? (
          <div className="p-8 text-center text-sm text-muted-foreground">Carregando fila…</div>
        ) : jobs.isError ? (
          <div className="p-8 text-center text-sm text-destructive">Erro ao carregar: {(jobs.error as any)?.message}</div>
        ) : (jobs.data?.length ?? 0) === 0 ? (
          <div className="p-8 text-center text-sm text-muted-foreground">
            <PrinterIcon className="size-8 mx-auto mb-2 opacity-50" />
            Nenhum trabalho de impressão encontrado para os filtros atuais.
          </div>
        ) : (
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Job</TableHead>
                <TableHead>Criado em</TableHead>
                <TableHead>Impressora</TableHead>
                <TableHead>Layout</TableHead>
                <TableHead>Qtd</TableHead>
                <TableHead>Origem</TableHead>
                <TableHead>Status</TableHead>
                <TableHead className="text-right">Ações</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {jobs.data!.map((j) => {
                const canCancel = !["completed", "canceled", "failed"].includes(j.status);
                return (
                  <TableRow key={j.id}>
                    <TableCell className="font-mono text-xs">{shortId(j.id)}</TableCell>
                    <TableCell className="text-xs">{formatDateTime(j.created_at)}</TableCell>
                    <TableCell className="text-sm">{printerName(j.printer_id)}</TableCell>
                    <TableCell className="text-sm">{layoutName(j.layout_id)}</TableCell>
                    <TableCell>{j.quantity}</TableCell>
                    <TableCell className="text-xs">{j.source}</TableCell>
                    <TableCell><Badge variant={STATUS_VARIANT[j.status]}>{STATUS_LABEL[j.status]}</Badge></TableCell>
                    <TableCell className="text-right space-x-1">
                      <Button size="icon" variant="ghost" onClick={() => setDetail(j)} title="Detalhes"><Eye className="size-4" /></Button>
                      <ReprintButton job={j} onConfirm={() => reprintMut.mutate(j)} disabled={reprintMut.isPending} />
                      <CancelButton job={j} disabled={!canCancel || cancelMut.isPending} onConfirm={() => cancelMut.mutate(j)} />
                    </TableCell>
                  </TableRow>
                );
              })}
            </TableBody>
          </Table>
        )}
      </Card>

      <JobDetailDialog job={detail} onOpenChange={(o) => !o && setDetail(null)} printerName={printerName} layoutName={layoutName} />
    </div>
  );
}

function ReprintButton({ job, onConfirm, disabled }: { job: PrintQueueJob; onConfirm: () => void; disabled?: boolean }) {
  return (
    <AlertDialog>
      <AlertDialogTrigger asChild>
        <Button size="icon" variant="ghost" disabled={disabled} title="Reimprimir"><RefreshCw className="size-4" /></Button>
      </AlertDialogTrigger>
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle>Reimprimir job {shortId(job.id)}?</AlertDialogTitle>
          <AlertDialogDescription>
            Um novo job será criado, vinculado ao original. Impressora, layout e compatibilidade serão revalidados.
          </AlertDialogDescription>
        </AlertDialogHeader>
        <AlertDialogFooter>
          <AlertDialogCancel>Cancelar</AlertDialogCancel>
          <AlertDialogAction onClick={onConfirm}>Reimprimir</AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
}

function CancelButton({ job, onConfirm, disabled }: { job: PrintQueueJob; onConfirm: () => void; disabled?: boolean }) {
  return (
    <AlertDialog>
      <AlertDialogTrigger asChild>
        <Button size="icon" variant="ghost" disabled={disabled} title={disabled ? "Job não pode ser cancelado" : "Cancelar"}>
          <X className="size-4" />
        </Button>
      </AlertDialogTrigger>
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle>Cancelar job {shortId(job.id)}?</AlertDialogTitle>
          <AlertDialogDescription>
            Se já enviado, tentaremos cancelar no Print Agent. O registro será preservado para auditoria.
          </AlertDialogDescription>
        </AlertDialogHeader>
        <AlertDialogFooter>
          <AlertDialogCancel>Voltar</AlertDialogCancel>
          <AlertDialogAction onClick={onConfirm}>Cancelar job</AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
}

function JobDetailDialog({
  job, onOpenChange, printerName, layoutName,
}: {
  job: PrintQueueJob | null;
  onOpenChange: (open: boolean) => void;
  printerName: (id: string | null) => string;
  layoutName: (id: string | null) => string;
}) {
  return (
    <Dialog open={!!job} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl">
        <DialogHeader><DialogTitle>Detalhes do job</DialogTitle></DialogHeader>
        {job && (
          <div className="space-y-3 text-sm">
            <div className="grid grid-cols-2 gap-3">
              <Field label="ID" value={job.id} mono />
              <Field label="Status" value={STATUS_LABEL[job.status]} />
              <Field label="Criado" value={formatDateTime(job.created_at)} />
              <Field label="Iniciado" value={formatDateTime(job.started_at)} />
              <Field label="Concluído" value={formatDateTime(job.finished_at)} />
              <Field label="Tentativas" value={String(job.attempts)} />
              <Field label="Impressora" value={printerName(job.printer_id)} />
              <Field label="Layout" value={layoutName(job.layout_id)} />
              <Field label="Quantidade" value={String(job.quantity)} />
              <Field label="Origem" value={job.source} />
              <Field label="Agent Job ID" value={job.agent_job_id ?? "—"} mono />
              <Field label="Batch" value={job.batch_id ?? "—"} mono />
            </div>
            {job.error_message && (
              <div className="rounded-md border border-destructive/40 bg-destructive/5 p-3">
                <div className="text-xs font-semibold text-destructive mb-1">Mensagem de erro</div>
                <div className="text-xs whitespace-pre-wrap break-words">{job.error_message}</div>
              </div>
            )}
            <Collapsible>
              <CollapsibleTrigger asChild>
                <Button variant="outline" size="sm">Payload técnico</Button>
              </CollapsibleTrigger>
              <CollapsibleContent>
                <pre className="mt-2 max-h-80 overflow-auto rounded-md bg-muted p-3 text-xs">
                  {JSON.stringify(sanitizePayload(job.payload ?? {}), null, 2)}
                </pre>
              </CollapsibleContent>
            </Collapsible>
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}

function Field({ label, value, mono }: { label: string; value: string; mono?: boolean }) {
  return (
    <div>
      <div className="text-xs text-muted-foreground">{label}</div>
      <div className={mono ? "font-mono text-xs break-all" : "text-sm"}>{value}</div>
    </div>
  );
}
