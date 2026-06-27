// FASE 11 — Dashboard de Impressão.
// Reaproveita PrintHistoryService (FASE 10) + agregações puras de print-analytics
// para entregar uma visão gerencial. NÃO duplica fila/histórico/emissão.

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
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  ResponsiveContainer, BarChart, Bar, LineChart, Line, XAxis, YAxis, Tooltip,
  CartesianGrid, Legend, PieChart, Pie, Cell,
} from "recharts";
import {
  PrintHistoryService, normalizeSource, normalizeStatus,
} from "@/lib/print/print-history-service";
import {
  aggregateByDimension, aggregateByEnum, aggregateByPeriod,
  buildDashboardCsv, computeMetrics, type Granularity,
} from "@/lib/print/print-analytics";
import { downloadBlob } from "@/lib/label-pdf";
import { toast } from "sonner";
import {
  FileDown, History, ListChecks, PrinterCheck, AlertTriangle, TrendingUp,
} from "lucide-react";
import type { PrintJobSource, PrintJobStatus } from "@/lib/print/types";

export const Route = createFileRoute("/app/print-dashboard")({
  head: () => ({ meta: [{ title: "Dashboard de Impressão" }] }),
  component: Page,
});

const PIE_COLORS = ["#3b82f6", "#10b981", "#f59e0b", "#ef4444", "#8b5cf6", "#06b6d4", "#ec4899"];

function Page() {
  const { companyId, role } = useActiveCompany();
  const [from, setFrom] = useState(() => {
    const d = new Date(); d.setDate(d.getDate() - 30);
    return d.toISOString().slice(0, 10);
  });
  const [to, setTo] = useState(() => new Date().toISOString().slice(0, 10));
  const [status, setStatus] = useState("");
  const [source, setSource] = useState("");
  const [printerId, setPrinterId] = useState("");
  const [layoutId, setLayoutId] = useState("");
  const [userId, setUserId] = useState("");
  const [granularity, setGranularity] = useState<Granularity>("day");

  const printers = useQuery({
    queryKey: ["dash-printers", companyId], enabled: !!companyId,
    queryFn: async () => {
      const { data } = await supabase.from("printer_configs").select("id,name").eq("company_id", companyId!);
      return (data ?? []) as { id: string; name: string }[];
    },
  });
  const layouts = useQuery({
    queryKey: ["dash-layouts", companyId], enabled: !!companyId,
    queryFn: async () => {
      const { data } = await supabase.from("label_layouts").select("id,name").eq("company_id", companyId!);
      return (data ?? []) as { id: string; name: string }[];
    },
  });
  const users = useQuery({
    queryKey: ["dash-users", companyId], enabled: !!companyId,
    queryFn: () => PrintHistoryService.listUsersWithJobs(companyId!),
  });

  // Carrega até 1000 jobs do período — limite seguro; volumes maiores precisarão
  // de agregação SQL dedicada (não implementada nesta fase por escopo).
  const jobs = useQuery({
    queryKey: ["dash-jobs", companyId, from, to, status, source, printerId, layoutId, userId],
    enabled: !!companyId,
    queryFn: () => PrintHistoryService.list({
      companyId: companyId!,
      from: from || null, to: to || null,
      status: (status || "all") as any, source: (source || "all") as any,
      printerId: printerId || null, layoutId: layoutId || null,
      userId: userId || null,
      limit: 1000,
    }),
  });

  const metrics = useMemo(() => computeMetrics(jobs.data ?? []), [jobs.data]);
  const byPeriod = useMemo(() => aggregateByPeriod(jobs.data ?? [], granularity), [jobs.data, granularity]);
  const byPrinter = useMemo(() => aggregateByDimension(jobs.data ?? [], "printer"), [jobs.data]);
  const byLayout = useMemo(() => aggregateByDimension(jobs.data ?? [], "layout"), [jobs.data]);
  const byUser = useMemo(() => aggregateByDimension(jobs.data ?? [], "user"), [jobs.data]);
  const byProduct = useMemo(() => aggregateByDimension(jobs.data ?? [], "product"), [jobs.data]);
  const bySource = useMemo(() => aggregateByEnum(jobs.data ?? [], "source"), [jobs.data]);
  const byStatus = useMemo(() => aggregateByEnum(jobs.data ?? [], "status"), [jobs.data]);

  function exportCsv() {
    if ((jobs.data?.length ?? 0) === 0) { toast.error("Sem dados para exportar."); return; }
    const csv = buildDashboardCsv(metrics, byPeriod)
      .map((r) => r.map((c) => `"${String(c).replace(/"/g, '""')}"`).join(";"))
      .join("\n");
    const blob = new Blob([`\ufeff${csv}`], { type: "text/csv;charset=utf-8;" });
    downloadBlob(blob, `dashboard-impressao-${new Date().toISOString().slice(0, 10)}.csv`);
  }

  const isEmpty = !jobs.isLoading && !jobs.isError && (jobs.data?.length ?? 0) === 0;

  return (
    <div className="space-y-6">
      <PageHeader
        title="Dashboard de Impressão"
        description="Visão gerencial de jobs, falhas, reimpressões e fallback PDF."
        actions={
          <div className="flex gap-2 flex-wrap">
            <Button asChild variant="outline" size="sm">
              <Link to="/app/print-history"><History className="size-4 mr-1" />Histórico</Link>
            </Button>
            <Button asChild variant="outline" size="sm">
              <Link to="/app/print-queue"><ListChecks className="size-4 mr-1" />Fila</Link>
            </Button>
            <Button asChild size="sm">
              <Link to="/app/print-labels"><PrinterCheck className="size-4 mr-1" />Nova emissão</Link>
            </Button>
          </div>
        }
      />

      {role === "consulta" && (
        <Card className="p-3 bg-muted/40 text-sm">Modo consulta — métricas exibidas conforme RLS.</Card>
      )}

      <Card className="p-4 grid grid-cols-2 md:grid-cols-4 gap-3">
        <div><Label>De</Label><Input type="date" value={from} onChange={(e) => setFrom(e.target.value)} /></div>
        <div><Label>Até</Label><Input type="date" value={to} onChange={(e) => setTo(e.target.value)} /></div>
        <div>
          <Label>Granularidade</Label>
          <Select value={granularity} onValueChange={(v) => setGranularity(v as Granularity)}>
            <SelectTrigger><SelectValue /></SelectTrigger>
            <SelectContent>
              <SelectItem value="day">Diária</SelectItem>
              <SelectItem value="week">Semanal</SelectItem>
              <SelectItem value="month">Mensal</SelectItem>
              <SelectItem value="year">Anual</SelectItem>
            </SelectContent>
          </Select>
        </div>
        <div>
          <Label>Status</Label>
          <Select value={status || "all"} onValueChange={(v) => setStatus(v === "all" ? "" : v)}>
            <SelectTrigger><SelectValue /></SelectTrigger>
            <SelectContent>
              <SelectItem value="all">Todos</SelectItem>
              {(["pending","sent","printing","completed","failed","canceled"] as PrintJobStatus[]).map((s) => (
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
              {(["print_agent","pdf_fallback","manual"] as PrintJobSource[]).map((s) => (
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
        <div className="col-span-2 md:col-span-4 flex justify-end">
          <Button variant="outline" size="sm" onClick={exportCsv} disabled={isEmpty}>
            <FileDown className="size-4 mr-1" />Exportar CSV
          </Button>
        </div>
      </Card>

      {jobs.isLoading && <Card className="p-8 text-center text-sm text-muted-foreground">Carregando indicadores…</Card>}
      {jobs.isError && (
        <Card className="p-8 text-center text-sm text-destructive">
          Erro ao carregar: {(jobs.error as any)?.message}
        </Card>
      )}
      {isEmpty && (
        <Card className="p-8 text-center text-sm text-muted-foreground">
          <TrendingUp className="size-8 mx-auto mb-2 opacity-50" />
          Sem dados de impressão no período/filtros selecionados.
        </Card>
      )}

      {!jobs.isLoading && !jobs.isError && !isEmpty && (
        <>
          <div className="grid grid-cols-2 md:grid-cols-5 gap-3">
            <Stat label="Etiquetas impressas" value={metrics.totalLabels} />
            <Stat label="Jobs" value={metrics.totalJobs} />
            <Stat label="Concluídos" value={metrics.completed} tone="success" />
            <Stat label="Falhas" value={metrics.failed} tone={metrics.failed ? "destructive" : "muted"} />
            <Stat label="Cancelamentos" value={metrics.canceled} tone={metrics.canceled ? "destructive" : "muted"} />
            <Stat label="Reimpressões" value={metrics.reprints} tone="secondary" />
            <Stat label="Fallback PDF" value={metrics.fallback} tone={metrics.fallback ? "warn" : "muted"} />
            <Stat label="Taxa de sucesso" value={`${(metrics.successRate * 100).toFixed(1)}%`} tone="success" />
            <Stat
              label="Taxa de erro"
              value={`${(metrics.errorRate * 100).toFixed(1)}%`}
              tone={metrics.errorRate > 0.1 ? "destructive" : "muted"}
            />
            <Stat
              label="Tempo médio"
              value={metrics.avgDurationMs == null ? "—" : PrintHistoryService.formatDuration(metrics.avgDurationMs)}
            />
          </div>

          <Card className="p-4">
            <div className="font-semibold mb-3">Impressões por período ({granularityLabel(granularity)})</div>
            <div className="h-64">
              <ResponsiveContainer width="100%" height="100%">
                <LineChart data={byPeriod}>
                  <CartesianGrid strokeDasharray="3 3" opacity={0.3} />
                  <XAxis dataKey="bucket" fontSize={11} />
                  <YAxis fontSize={11} />
                  <Tooltip />
                  <Legend />
                  <Line type="monotone" dataKey="jobs" stroke="#3b82f6" name="Jobs" strokeWidth={2.5} dot={false} />
                  <Line type="monotone" dataKey="labels" stroke="#10b981" name="Etiquetas" strokeWidth={2.5} dot={false} />
                  <Line type="monotone" dataKey="failed" stroke="#ef4444" name="Falhas" strokeWidth={2.5} dot={false} />
                </LineChart>
              </ResponsiveContainer>
            </div>
          </Card>

          <div className="grid lg:grid-cols-2 gap-4">
            <DimChart title="Impressões por impressora" data={byPrinter} fill="#3b82f6" />
            <DimChart title="Falhas por impressora" data={byPrinter.map((d) => ({ ...d, jobs: d.failed }))} fill="#ef4444" emptyHint="Sem falhas no período." />
            <DimChart title="Impressões por layout" data={byLayout} fill="#06b6d4" />
            <DimChart title="Impressões por usuário" data={byUser} fill="#8b5cf6" />
            <DimChart title="Top produtos" data={byProduct} fill="#10b981" />
            <Card className="p-4">
              <div className="font-semibold mb-3">Print Agent × PDF fallback</div>
              <div className="h-64">
                <ResponsiveContainer width="100%" height="100%">
                  <PieChart>
                    <Pie data={bySource} dataKey="jobs" nameKey="label" outerRadius={80} label>
                      {bySource.map((_, i) => <Cell key={i} fill={PIE_COLORS[i % PIE_COLORS.length]} />)}
                    </Pie>
                    <Tooltip />
                    <Legend />
                  </PieChart>
                </ResponsiveContainer>
              </div>
            </Card>
            <Card className="p-4">
              <div className="font-semibold mb-3">Distribuição por status</div>
              <div className="flex flex-wrap gap-2">
                {byStatus.map((s) => (
                  <Badge key={s.key} variant={s.key === "failed" ? "destructive" : s.key === "completed" ? "default" : "outline"}>
                    {s.label}: {s.jobs}
                  </Badge>
                ))}
              </div>
            </Card>
          </div>
        </>
      )}
    </div>
  );
}

function granularityLabel(g: Granularity): string {
  return g === "day" ? "diária" : g === "week" ? "semanal" : g === "month" ? "mensal" : "anual";
}

function Stat({
  label, value, tone = "muted",
}: { label: string; value: number | string; tone?: "muted" | "destructive" | "warn" | "secondary" | "success" }) {
  const cls =
    tone === "destructive" ? "border-red-300/60 bg-red-50/60 dark:border-red-900/40 dark:bg-red-950/30" :
    tone === "warn" ? "border-amber-300/60 bg-amber-50/60 dark:border-amber-900/40 dark:bg-amber-950/30" :
    tone === "secondary" ? "border-violet-300/60 bg-violet-50/60 dark:border-violet-900/40 dark:bg-violet-950/30" :
    tone === "success" ? "border-emerald-300/60 bg-emerald-50/60 dark:border-emerald-900/40 dark:bg-emerald-950/30" : "";
  return (
    <Card className={`p-3 ${cls}`}>
      <div className="text-xs text-muted-foreground">{label}</div>
      <div className="text-2xl font-semibold">{value}</div>
      {tone === "destructive" && typeof value === "number" && value > 0 && (
        <div className="mt-1 text-xs text-destructive flex items-center gap-1">
          <AlertTriangle className="size-3" />requer atenção
        </div>
      )}
    </Card>
  );
}

function DimChart({
  title, data, fill, emptyHint,
}: {
  title: string;
  data: { label: string; jobs: number }[];
  fill: string;
  emptyHint?: string;
}) {
  const trimmed = data.filter((d) => d.jobs > 0).map((d) => ({ ...d, label: d.label.slice(0, 18) }));
  return (
    <Card className="p-4">
      <div className="font-semibold mb-3">{title}</div>
      <div className="h-64">
        {trimmed.length === 0 ? (
          <div className="h-full flex items-center justify-center text-sm text-muted-foreground">
            {emptyHint ?? "Sem dados."}
          </div>
        ) : (
          <ResponsiveContainer width="100%" height="100%">
            <BarChart data={trimmed} layout="vertical">
              <CartesianGrid strokeDasharray="3 3" opacity={0.3} />
              <XAxis type="number" fontSize={11} />
              <YAxis dataKey="label" type="category" width={120} fontSize={11} />
              <Tooltip />
              <Bar dataKey="jobs" fill={fill} radius={[0, 4, 4, 0]} />
            </BarChart>
          </ResponsiveContainer>
        )}
      </div>
    </Card>
  );
}
