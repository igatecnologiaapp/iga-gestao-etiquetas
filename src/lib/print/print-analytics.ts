// FASE 11 — Agregações puras para o Dashboard de Impressão.
// Recebem rows já carregadas via PrintHistoryService.list (FASE 10) e devolvem
// estruturas prontas para cards e gráficos. Nenhuma chamada de rede aqui —
// código 100% determinístico e testável.

import type { HistoryRow } from "./print-history-service";
import { SOURCE_LABEL, STATUS_LABEL } from "./print-history-service";
import type { PrintJobSource, PrintJobStatus } from "./types";

export type Granularity = "day" | "week" | "month" | "year";

export interface DashboardMetrics {
  totalJobs: number;
  totalLabels: number;
  completed: number;
  failed: number;
  canceled: number;
  reprints: number;
  fallback: number;
  successRate: number;   // 0..1
  errorRate: number;     // 0..1
  avgDurationMs: number | null;
}

export function computeMetrics(rows: HistoryRow[]): DashboardMetrics {
  const total = rows.length;
  let labels = 0, completed = 0, failed = 0, canceled = 0, reprints = 0, fallback = 0;
  let durSum = 0, durCount = 0;
  for (const r of rows) {
    labels += Number(r.quantity) || 0;
    if (r.status === "completed") completed += 1;
    else if (r.status === "failed") failed += 1;
    else if (r.status === "canceled") canceled += 1;
    if (r.is_reprint) reprints += 1;
    if (r.source === "pdf_fallback") fallback += 1;
    if (r.duration_ms != null) { durSum += r.duration_ms; durCount += 1; }
  }
  const finished = completed + failed + canceled;
  return {
    totalJobs: total,
    totalLabels: labels,
    completed, failed, canceled, reprints, fallback,
    successRate: finished > 0 ? completed / finished : 0,
    errorRate: finished > 0 ? (failed + canceled) / finished : 0,
    avgDurationMs: durCount > 0 ? Math.round(durSum / durCount) : null,
  };
}

/** Bucket por período. Devolve séries ordenadas ascendentes por chave. */
export function aggregateByPeriod(
  rows: HistoryRow[],
  granularity: Granularity,
): { bucket: string; jobs: number; labels: number; failed: number }[] {
  const buckets = new Map<string, { jobs: number; labels: number; failed: number }>();
  for (const r of rows) {
    const key = bucketKey(r.created_at, granularity);
    const cur = buckets.get(key) ?? { jobs: 0, labels: 0, failed: 0 };
    cur.jobs += 1;
    cur.labels += Number(r.quantity) || 0;
    if (r.status === "failed") cur.failed += 1;
    buckets.set(key, cur);
  }
  return Array.from(buckets.entries())
    .sort(([a], [b]) => (a < b ? -1 : a > b ? 1 : 0))
    .map(([bucket, v]) => ({ bucket, ...v }));
}

export function bucketKey(iso: string, g: Granularity): string {
  const d = new Date(iso);
  if (!Number.isFinite(d.getTime())) return iso;
  const y = d.getUTCFullYear();
  const m = String(d.getUTCMonth() + 1).padStart(2, "0");
  const day = String(d.getUTCDate()).padStart(2, "0");
  if (g === "year") return `${y}`;
  if (g === "month") return `${y}-${m}`;
  if (g === "day") return `${y}-${m}-${day}`;
  // week: ISO week start (Monday) — usa ano-Wsemana
  const tmp = new Date(Date.UTC(y, d.getUTCMonth(), d.getUTCDate()));
  const dow = (tmp.getUTCDay() + 6) % 7; // 0=Mon
  tmp.setUTCDate(tmp.getUTCDate() - dow + 3); // Thursday of the ISO week
  const isoYear = tmp.getUTCFullYear();
  const week1 = new Date(Date.UTC(isoYear, 0, 4));
  const week = 1 + Math.round(((tmp.getTime() - week1.getTime()) / 86400000 - 3 + ((week1.getUTCDay() + 6) % 7)) / 7);
  return `${isoYear}-W${String(week).padStart(2, "0")}`;
}

/** Top-N agregando por uma dimensão (nome legível + total jobs + labels + falhas). */
export function aggregateByDimension(
  rows: HistoryRow[],
  dim: "printer" | "layout" | "user" | "product" | "company",
  topN = 10,
): { key: string; label: string; jobs: number; labels: number; failed: number }[] {
  const map = new Map<string, { label: string; jobs: number; labels: number; failed: number }>();
  for (const r of rows) {
    const { key, label } = dimensionKey(r, dim);
    const cur = map.get(key) ?? { label, jobs: 0, labels: 0, failed: 0 };
    cur.jobs += 1;
    cur.labels += Number(r.quantity) || 0;
    if (r.status === "failed") cur.failed += 1;
    map.set(key, cur);
  }
  return Array.from(map.entries())
    .map(([key, v]) => ({ key, ...v }))
    .sort((a, b) => b.jobs - a.jobs)
    .slice(0, topN);
}

function dimensionKey(r: HistoryRow, dim: "printer" | "layout" | "user" | "product" | "company"): { key: string; label: string } {
  switch (dim) {
    case "printer": return { key: r.printer_id ?? "—", label: r.printer_name ?? "Sem impressora" };
    case "layout":  return { key: r.layout_id ?? "—",  label: r.layout_name ?? "Sem layout" };
    case "user":    return { key: r.user_id ?? "—",    label: r.user_name ?? r.user_email ?? "—" };
    case "product": return { key: r.product_id ?? "—", label: r.product_name ?? "—" };
    case "company": return { key: r.company_id,        label: r.company_id.slice(0, 8) };
  }
}

/** Distribuição por enum (status/source). */
export function aggregateByEnum<T extends "status" | "source">(
  rows: HistoryRow[],
  field: T,
): { key: string; label: string; jobs: number }[] {
  const map = new Map<string, number>();
  for (const r of rows) {
    const k = String(r[field]);
    map.set(k, (map.get(k) ?? 0) + 1);
  }
  return Array.from(map.entries()).map(([key, jobs]) => ({
    key,
    label: field === "status" ? STATUS_LABEL[key as PrintJobStatus] ?? key : SOURCE_LABEL[key as PrintJobSource] ?? key,
    jobs,
  }));
}

/** Linhas CSV para exportação do dashboard (cards + período). */
export function buildDashboardCsv(
  metrics: DashboardMetrics,
  byPeriod: { bucket: string; jobs: number; labels: number; failed: number }[],
): string[][] {
  const rows: string[][] = [
    ["indicador", "valor"],
    ["total_jobs", String(metrics.totalJobs)],
    ["total_etiquetas", String(metrics.totalLabels)],
    ["concluidos", String(metrics.completed)],
    ["falhas", String(metrics.failed)],
    ["cancelamentos", String(metrics.canceled)],
    ["reimpressoes", String(metrics.reprints)],
    ["fallback_pdf", String(metrics.fallback)],
    ["taxa_sucesso", (metrics.successRate * 100).toFixed(2) + "%"],
    ["taxa_erro", (metrics.errorRate * 100).toFixed(2) + "%"],
    ["tempo_medio_ms", metrics.avgDurationMs == null ? "" : String(metrics.avgDurationMs)],
    [],
    ["periodo", "jobs", "etiquetas", "falhas"],
    ...byPeriod.map((b) => [b.bucket, String(b.jobs), String(b.labels), String(b.failed)]),
  ];
  return rows;
}
