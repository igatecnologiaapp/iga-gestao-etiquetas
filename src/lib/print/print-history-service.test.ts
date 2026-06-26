// FASE 10 — Testes unitários puros (normalizadores e helpers).
// Não tocam Supabase — validação focada nas regras de exibição/filtro.

import { describe, it, expect } from "vitest";
import {
  computeDurationMs,
  isReprint,
  normalizeSource,
  normalizeStatus,
  PrintHistoryService,
  reprintOf,
  type HistoryRow,
} from "./print-history-service";
import type { PrintQueueJob } from "./types";

const baseJob = (over: Partial<PrintQueueJob> = {}): PrintQueueJob => ({
  id: "00000000-0000-0000-0000-000000000001",
  company_id: "c1",
  branch_id: null,
  user_id: "u1",
  printer_id: "p1",
  layout_id: "l1",
  product_id: "pr1",
  batch_id: null,
  quantity: 1,
  status: "completed",
  source: "print_agent",
  payload: {},
  agent_job_id: "ag-1",
  error_message: null,
  attempts: 0,
  started_at: "2026-01-01T10:00:00.000Z",
  finished_at: "2026-01-01T10:00:02.500Z",
  created_at: "2026-01-01T09:59:59.000Z",
  updated_at: "2026-01-01T10:00:02.500Z",
  ...over,
});

describe("normalizeStatus / normalizeSource", () => {
  it("translates statuses", () => {
    expect(normalizeStatus("completed")).toBe("Concluído");
    expect(normalizeStatus("failed")).toBe("Falhou");
    expect(normalizeStatus("canceled")).toBe("Cancelado");
    expect(normalizeStatus(null)).toBe("—");
  });
  it("translates sources", () => {
    expect(normalizeSource("print_agent")).toBe("Print Agent");
    expect(normalizeSource("pdf_fallback")).toBe("PDF (fallback)");
    expect(normalizeSource("manual")).toBe("Manual");
    expect(normalizeSource(undefined)).toBe("—");
  });
});

describe("computeDurationMs", () => {
  it("computes positive duration", () => {
    expect(computeDurationMs(baseJob())).toBe(2500);
  });
  it("returns null when finished_at missing", () => {
    expect(computeDurationMs(baseJob({ finished_at: null }))).toBeNull();
  });
  it("falls back to created_at when started_at missing", () => {
    const r = computeDurationMs(baseJob({ started_at: null }));
    expect(r).toBe(3500);
  });
  it("returns null for negative deltas", () => {
    expect(
      computeDurationMs(baseJob({ started_at: "2026-01-01T10:00:05.000Z" })),
    ).toBeNull();
  });
});

describe("reprintOf / isReprint", () => {
  it("detects reprint metadata", () => {
    const j = baseJob({ payload: { reprint_of: "orig-1" } });
    expect(reprintOf(j)).toBe("orig-1");
    expect(isReprint(j)).toBe(true);
  });
  it("returns null for plain jobs", () => {
    expect(reprintOf(baseJob())).toBeNull();
    expect(isReprint(baseJob())).toBe(false);
  });
  it("ignores non-string reprint_of", () => {
    expect(reprintOf(baseJob({ payload: { reprint_of: 42 as any } }))).toBeNull();
  });
});

describe("formatDuration", () => {
  it("handles ranges", () => {
    expect(PrintHistoryService.formatDuration(null)).toBe("—");
    expect(PrintHistoryService.formatDuration(250)).toBe("250 ms");
    expect(PrintHistoryService.formatDuration(2500)).toBe("2.5 s");
    expect(PrintHistoryService.formatDuration(125_000)).toMatch(/^2min\s+5s$/);
  });
});

describe("toCsvRows", () => {
  const row = (over: Partial<HistoryRow> = {}): HistoryRow => ({
    ...baseJob(),
    printer_name: "Zebra GK420",
    layout_name: "10x10",
    product_name: "Picanha",
    product_code: "P001",
    user_name: "Operador",
    user_email: "op@example.com",
    is_reprint: false,
    reprint_of: null,
    duration_ms: 2500,
    ...over,
  });

  it("emits a header plus one row per job", () => {
    const csv = PrintHistoryService.toCsvRows([row(), row({ is_reprint: true, reprint_of: "orig" })]);
    expect(csv.length).toBe(3);
    expect(csv[0]).toContain("data");
    expect(csv[0]).toContain("reimpressao");
    expect(csv[1]).toContain("Concluído");
    expect(csv[1]).toContain("Print Agent");
    expect(csv[2]).toContain("sim");
    expect(csv[2]).toContain("orig");
  });

  it("escapes nulls as empty strings", () => {
    const csv = PrintHistoryService.toCsvRows([row({ user_name: null, user_email: null, error_message: null })]);
    expect(csv[1][2]).toBe("");
    expect(csv[1][3]).toBe("");
  });
});
