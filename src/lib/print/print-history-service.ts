// FASE 10 — Histórico e Auditoria de Impressão.
// Camada de leitura sobre print_queue + dados relacionados (impressora, layout,
// produto, usuário). Reaproveita RLS já existente:
//   - Operador: somente jobs onde user_id = auth.uid()
//   - Supervisor/Administrador: todos da company
//   - Global admin: respeita políticas existentes (membership)
//
// NÃO altera label-pdf, preview, layouts nem schema.
// NÃO duplica a Fila de Impressão (FASE 9) — esta camada é consultiva e
// inclui jobs concluídos / cancelados / falhos / reimpressos / fallback.

import { supabase } from "@/integrations/supabase/client";
import type { PrintJobSource, PrintJobStatus, PrintQueueJob } from "./types";

export interface HistoryFilters {
  companyId: string;
  from?: string | null;          // ISO date (YYYY-MM-DD)
  to?: string | null;            // ISO date (YYYY-MM-DD)
  status?: PrintJobStatus | "all" | "";
  source?: PrintJobSource | "all" | "";
  printerId?: string | null;
  layoutId?: string | null;
  productId?: string | null;
  userId?: string | null;
  onlyReprints?: boolean;
  onlyFailures?: boolean;
  onlyCancellations?: boolean;
  limit?: number;
}

export interface HistoryRow extends PrintQueueJob {
  printer_name: string | null;
  layout_name: string | null;
  product_name: string | null;
  product_code: string | null;
  user_name: string | null;
  user_email: string | null;
  is_reprint: boolean;
  reprint_of: string | null;
  duration_ms: number | null;
}

export const STATUS_LABEL: Record<PrintJobStatus, string> = {
  pending: "Pendente",
  sent: "Enviado",
  printing: "Imprimindo",
  completed: "Concluído",
  failed: "Falhou",
  canceled: "Cancelado",
};

export const SOURCE_LABEL: Record<PrintJobSource, string> = {
  print_agent: "Print Agent",
  pdf_fallback: "PDF (fallback)",
  manual: "Manual",
};

export function normalizeStatus(s: string | null | undefined): string {
  if (!s) return "—";
  return STATUS_LABEL[s as PrintJobStatus] ?? s;
}

export function normalizeSource(s: string | null | undefined): string {
  if (!s) return "—";
  return SOURCE_LABEL[s as PrintJobSource] ?? s;
}

export function computeDurationMs(job: Pick<PrintQueueJob, "started_at" | "finished_at" | "created_at">): number | null {
  const start = job.started_at ?? job.created_at;
  const end = job.finished_at;
  if (!start || !end) return null;
  const ms = new Date(end).getTime() - new Date(start).getTime();
  return Number.isFinite(ms) && ms >= 0 ? ms : null;
}

export function reprintOf(job: PrintQueueJob): string | null {
  const p = job.payload as Record<string, unknown> | null | undefined;
  const v = p?.reprint_of;
  return typeof v === "string" ? v : null;
}

export function isReprint(job: PrintQueueJob): boolean {
  return reprintOf(job) !== null;
}

export const PrintHistoryService = {
  async list(filters: HistoryFilters): Promise<HistoryRow[]> {
    let q = (supabase.from("print_queue" as any) as any)
      .select(
        "*, printer_configs(name), label_layouts(name), products(name, internal_code)",
      )
      .eq("company_id", filters.companyId)
      .order("created_at", { ascending: false })
      .limit(Math.min(filters.limit ?? 500, 1000));

    if (filters.from) q = q.gte("created_at", filters.from);
    if (filters.to) q = q.lte("created_at", `${filters.to}T23:59:59`);
    if (filters.status && filters.status !== "all") q = q.eq("status", filters.status);
    if (filters.source && filters.source !== "all") q = q.eq("source", filters.source);
    if (filters.printerId) q = q.eq("printer_id", filters.printerId);
    if (filters.layoutId) q = q.eq("layout_id", filters.layoutId);
    if (filters.productId) q = q.eq("product_id", filters.productId);
    if (filters.userId) q = q.eq("user_id", filters.userId);
    if (filters.onlyReprints) q = q.not("payload->reprint_of", "is", null);
    if (filters.onlyFailures) q = q.eq("status", "failed");
    if (filters.onlyCancellations) q = q.eq("status", "canceled");

    const { data, error } = await q;
    if (error) throw new Error(error.message);
    const rows = (data ?? []) as any[];

    // Resolve usuários em lote (FK aponta para auth.users — sem embed direto).
    const userIds = Array.from(new Set(rows.map((r) => r.user_id).filter(Boolean))) as string[];
    let users: Record<string, { full_name: string | null; email: string | null }> = {};
    if (userIds.length > 0) {
      const { data: ups } = await supabase
        .from("user_profiles")
        .select("id, full_name, email")
        .in("id", userIds);
      users = Object.fromEntries((ups ?? []).map((u: any) => [u.id, { full_name: u.full_name, email: u.email }]));
    }

    return rows.map((r): HistoryRow => ({
      ...r,
      printer_name: r.printer_configs?.name ?? null,
      layout_name: r.label_layouts?.name ?? null,
      product_name: r.products?.name ?? null,
      product_code: r.products?.internal_code ?? null,
      user_name: r.user_id ? users[r.user_id]?.full_name ?? null : null,
      user_email: r.user_id ? users[r.user_id]?.email ?? null : null,
      is_reprint: isReprint(r),
      reprint_of: reprintOf(r),
      duration_ms: computeDurationMs(r),
    }));
  },

  async getById(id: string): Promise<HistoryRow | null> {
    const { data, error } = await (supabase.from("print_queue" as any) as any)
      .select("*, printer_configs(name), label_layouts(name), products(name, internal_code)")
      .eq("id", id)
      .maybeSingle();
    if (error) throw new Error(error.message);
    if (!data) return null;
    const r = data as any;
    let user: { full_name: string | null; email: string | null } | null = null;
    if (r.user_id) {
      const { data: up } = await supabase
        .from("user_profiles").select("full_name, email").eq("id", r.user_id).maybeSingle();
      user = (up as any) ?? null;
    }
    return {
      ...r,
      printer_name: r.printer_configs?.name ?? null,
      layout_name: r.label_layouts?.name ?? null,
      product_name: r.products?.name ?? null,
      product_code: r.products?.internal_code ?? null,
      user_name: user?.full_name ?? null,
      user_email: user?.email ?? null,
      is_reprint: isReprint(r),
      reprint_of: reprintOf(r),
      duration_ms: computeDurationMs(r),
    };
  },

  /** Lista usuários distintos que aparecem em jobs da empresa (para filtros). */
  async listUsersWithJobs(companyId: string): Promise<{ id: string; name: string; email: string | null }[]> {
    const { data: ids } = await (supabase.from("print_queue" as any) as any)
      .select("user_id").eq("company_id", companyId).not("user_id", "is", null).limit(1000);
    const unique = Array.from(new Set(((ids ?? []) as any[]).map((r) => r.user_id))).filter(Boolean) as string[];
    if (unique.length === 0) return [];
    const { data: ups } = await supabase
      .from("user_profiles").select("id, full_name, email").in("id", unique);
    return ((ups ?? []) as any[]).map((u) => ({
      id: u.id,
      name: u.full_name ?? u.email ?? u.id.slice(0, 8),
      email: u.email ?? null,
    }));
  },

  /** Formato human-readable da duração. */
  formatDuration(ms: number | null): string {
    if (ms == null) return "—";
    if (ms < 1000) return `${ms} ms`;
    const s = Math.round(ms / 100) / 10;
    if (s < 60) return `${s.toFixed(1)} s`;
    const m = Math.floor(s / 60);
    return `${m}min ${Math.round(s - m * 60)}s`;
  },

  /** Constrói linhas CSV (sem disparar download — preparado para FASE futura). */
  toCsvRows(rows: HistoryRow[]): string[][] {
    const header = [
      "data", "hora", "usuario", "email", "produto", "codigo_produto", "layout",
      "impressora", "quantidade", "origem", "status", "duracao_ms",
      "reimpressao", "job_original", "erro", "agent_job_id", "job_id",
    ];
    const body = rows.map((r) => {
      const d = new Date(r.created_at);
      return [
        d.toLocaleDateString("pt-BR"),
        d.toLocaleTimeString("pt-BR"),
        r.user_name ?? "",
        r.user_email ?? "",
        r.product_name ?? "",
        r.product_code ?? "",
        r.layout_name ?? "",
        r.printer_name ?? "",
        String(r.quantity),
        normalizeSource(r.source),
        normalizeStatus(r.status),
        r.duration_ms != null ? String(r.duration_ms) : "",
        r.is_reprint ? "sim" : "não",
        r.reprint_of ?? "",
        r.error_message ?? "",
        r.agent_job_id ?? "",
        r.id,
      ];
    });
    return [header, ...body];
  },
};
