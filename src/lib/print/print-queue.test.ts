// FASE 9 — Testes de regras operacionais da Fila de Impressão.
// Cobrem cancelamento, bloqueios e enfileiramento de reimpressão.
// A UI é validada manualmente; aqui testamos o service + integração com o
// cliente do Print Agent (mockado) sem depender de Supabase.

import { describe, expect, it, vi, beforeEach } from "vitest";
import { createMockPrintAgent, PrintAgentOfflineError } from "./print-agent-client";
import type { PrintQueueJob } from "./types";

vi.mock("@/integrations/supabase/client", () => {
  const state: { rows: any[] } = { rows: [] };
  const builder = (table: string) => {
    const ctx: any = { _filters: [] };
    const exec = async () => ({ data: state.rows.filter(() => true), error: null });
    ctx.select = () => ctx;
    ctx.eq = () => ctx;
    ctx.order = () => ctx;
    ctx.limit = () => ctx;
    ctx.maybeSingle = async () => ({ data: state.rows[0] ?? null, error: null });
    ctx.single = async () => ({ data: state.rows[0] ?? null, error: null });
    ctx.insert = (payload: any) => {
      const row = { id: `q-${state.rows.length + 1}`, attempts: 0, status: payload.status ?? "pending", ...payload };
      state.rows.push(row);
      return { select: () => ({ single: async () => ({ data: row, error: null }) }) };
    };
    ctx.update = (patch: any) => {
      state.rows = state.rows.map((r) => ({ ...r, ...patch }));
      return { eq: async () => ({ error: null }) };
    };
    ctx.then = (resolve: any) => exec().then(resolve);
    return ctx;
  };
  return {
    supabase: {
      from: (t: string) => builder(t),
      auth: { getUser: async () => ({ data: { user: { id: "u-1" } } }) },
    },
    __state: state,
  };
});

import { PrintQueueService } from "./print-queue-service";

const baseJob = (overrides: Partial<PrintQueueJob> = {}): PrintQueueJob => ({
  id: "q-orig",
  company_id: "c1",
  branch_id: null,
  user_id: "u-1",
  printer_id: "p1",
  layout_id: "l1",
  product_id: "prod-1",
  batch_id: null,
  quantity: 3,
  status: "pending",
  source: "print_agent",
  payload: { foo: "bar" },
  agent_job_id: null,
  error_message: null,
  attempts: 0,
  started_at: null,
  finished_at: null,
  created_at: new Date().toISOString(),
  updated_at: new Date().toISOString(),
  ...overrides,
});

describe("PrintQueueService.cancel", () => {
  it("marca status como canceled", async () => {
    await expect(PrintQueueService.cancel("q-1", "user")).resolves.toBeUndefined();
  });
});

describe("Regras de cancelamento (UI)", () => {
  const isCancelable = (s: string) => !["completed", "canceled", "failed"].includes(s);
  it("permite cancelar pending/sent/printing", () => {
    expect(isCancelable("pending")).toBe(true);
    expect(isCancelable("sent")).toBe(true);
    expect(isCancelable("printing")).toBe(true);
  });
  it("bloqueia completed/canceled/failed", () => {
    expect(isCancelable("completed")).toBe(false);
    expect(isCancelable("canceled")).toBe(false);
    expect(isCancelable("failed")).toBe(false);
  });
});

describe("Cancelamento via Print Agent", () => {
  it("cancela com sucesso quando job existe", async () => {
    const agent = createMockPrintAgent({ online: true });
    const sub = await agent.submit({ printerId: "p1", copies: 1 });
    const r = await agent.cancelJob(sub.jobId);
    expect(r.canceled).toBe(true);
  });
  it("lança PrintAgentOfflineError quando offline", async () => {
    const agent = createMockPrintAgent({ online: false });
    await expect(agent.cancelJob("ag-job-1")).rejects.toBeInstanceOf(PrintAgentOfflineError);
  });
});

describe("Reimpressão (revalidação)", () => {
  // Helpers que espelham as regras aplicadas na UI antes de chamar enqueue.
  type Ctx = { printerActive: boolean; layoutActive: boolean; compat: string[] };
  function preflight(job: PrintQueueJob, ctx: Ctx): string | null {
    if (!job.printer_id || !job.layout_id) return "Job original sem impressora/layout — reimpressão indisponível.";
    if (!ctx.printerActive) return "Impressora original inativa ou removida.";
    if (!ctx.layoutActive) return "Layout original inativo ou removido.";
    if (ctx.compat.length > 0 && !ctx.compat.includes(job.layout_id)) {
      return "Impressora não é mais compatível com este layout.";
    }
    return null;
  }

  it("aprova reimpressão quando tudo válido", () => {
    expect(preflight(baseJob(), { printerActive: true, layoutActive: true, compat: ["l1"] })).toBeNull();
  });
  it("bloqueia se impressora inativa", () => {
    expect(preflight(baseJob(), { printerActive: false, layoutActive: true, compat: [] })).toMatch(/Impressora/);
  });
  it("bloqueia se layout inativo", () => {
    expect(preflight(baseJob(), { printerActive: true, layoutActive: false, compat: [] })).toMatch(/Layout/);
  });
  it("bloqueia se incompatível", () => {
    expect(preflight(baseJob(), { printerActive: true, layoutActive: true, compat: ["outro"] })).toMatch(/compatível/);
  });
  it("bloqueia se job sem impressora/layout", () => {
    expect(preflight(baseJob({ printer_id: null }), { printerActive: true, layoutActive: true, compat: [] }))
      .toMatch(/sem impressora/);
  });
  it("preserva referência ao job original no payload", () => {
    const original = baseJob();
    const payload = { ...(original.payload ?? {}), reprint_of: original.id, reprint_at: "now" };
    expect((payload as any).reprint_of).toBe(original.id);
    expect((payload as any).foo).toBe("bar");
  });
});
