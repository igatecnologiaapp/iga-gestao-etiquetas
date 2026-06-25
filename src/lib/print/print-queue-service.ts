// FASE 3 — PrintQueueService
// CRUD sobre public.print_queue. RLS já aplica isolamento por company_id
// (pq select/insert/update/delete policies definidas na FASE 2).
//
// Esta camada não decide POLÍTICA de impressão (fallback, retry, etc.) — apenas
// expõe primitivas usadas pela tela de emissão (FASE 7) e pela fila (FASE 9).

import { supabase } from "@/integrations/supabase/client";
import type {
  NewPrintJob,
  PrintJobSource,
  PrintJobStatus,
  PrintQueueJob,
} from "./types";

const table = () => (supabase.from("print_queue" as any) as any);

export interface QueueListOptions {
  status?: PrintJobStatus | "active" | "all";
  printerId?: string;
  limit?: number;
}

const ACTIVE: PrintJobStatus[] = ["pending", "sent", "printing"];

export const PrintQueueService = {
  async list(companyId: string, opts: QueueListOptions = {}): Promise<PrintQueueJob[]> {
    let q = table().select("*").eq("company_id", companyId).order("created_at", { ascending: false });
    if (opts.printerId) q = q.eq("printer_id", opts.printerId);
    if (opts.status && opts.status !== "all") {
      if (opts.status === "active") q = q.in("status", ACTIVE);
      else q = q.eq("status", opts.status);
    }
    if (opts.limit) q = q.limit(opts.limit);
    const { data, error } = await q;
    if (error) throw new Error(error.message);
    return (data ?? []) as PrintQueueJob[];
  },

  async getById(id: string): Promise<PrintQueueJob | null> {
    const { data, error } = await table().select("*").eq("id", id).maybeSingle();
    if (error) throw new Error(error.message);
    return (data ?? null) as PrintQueueJob | null;
  },

  async enqueue(job: NewPrintJob): Promise<PrintQueueJob> {
    // user_id é exigido pela policy de INSERT (= auth.uid()).
    const { data: u } = await supabase.auth.getUser();
    if (!u.user) throw new Error("Sessão expirada");
    const payload = {
      company_id: job.company_id,
      branch_id: job.branch_id ?? null,
      user_id: u.user.id,
      printer_id: job.printer_id ?? null,
      layout_id: job.layout_id ?? null,
      product_id: job.product_id ?? null,
      batch_id: job.batch_id ?? null,
      quantity: job.quantity ?? 1,
      source: (job.source ?? "print_agent") as PrintJobSource,
      payload: job.payload ?? {},
      status: "pending" as PrintJobStatus,
    };
    const { data, error } = await table().insert(payload).select("*").single();
    if (error) throw new Error(error.message);
    return data as PrintQueueJob;
  },

  async markSent(id: string, agentJobId: string): Promise<void> {
    const { error } = await table()
      .update({
        status: "sent" as PrintJobStatus,
        agent_job_id: agentJobId,
        started_at: new Date().toISOString(),
      })
      .eq("id", id);
    if (error) throw new Error(error.message);
  },

  async updateStatus(id: string, status: PrintJobStatus, extra: Partial<PrintQueueJob> = {}): Promise<void> {
    const patch: Record<string, unknown> = { status, ...extra };
    if (status === "completed" || status === "failed" || status === "canceled") {
      patch.finished_at = new Date().toISOString();
    }
    const { error } = await table().update(patch).eq("id", id);
    if (error) throw new Error(error.message);
  },

  async recordFailure(id: string, message: string): Promise<void> {
    // Incrementa attempts via fetch + update (Postgres não permite expressões via Data API).
    const job = await this.getById(id);
    const attempts = (job?.attempts ?? 0) + 1;
    const { error } = await table()
      .update({
        status: "failed" as PrintJobStatus,
        error_message: message.slice(0, 1000),
        attempts,
        finished_at: new Date().toISOString(),
      })
      .eq("id", id);
    if (error) throw new Error(error.message);
  },

  async cancel(id: string, reason?: string): Promise<void> {
    const { error } = await table()
      .update({
        status: "canceled" as PrintJobStatus,
        error_message: reason ?? null,
        finished_at: new Date().toISOString(),
      })
      .eq("id", id);
    if (error) throw new Error(error.message);
  },

  // Reimpressão: cria um NOVO job (não muta o original) para preservar histórico.
  async requeue(id: string): Promise<PrintQueueJob> {
    const job = await this.getById(id);
    if (!job) throw new Error("Trabalho não encontrado");
    return this.enqueue({
      company_id: job.company_id,
      branch_id: job.branch_id,
      printer_id: job.printer_id,
      layout_id: job.layout_id,
      product_id: job.product_id,
      batch_id: job.batch_id,
      quantity: job.quantity,
      source: job.source,
      payload: job.payload,
    });
  },
};
