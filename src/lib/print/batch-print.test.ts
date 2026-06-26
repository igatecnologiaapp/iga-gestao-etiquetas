// FASE 12 — Testes do orquestrador de impressão em lote.
// Cobre validação por item, agrupamento via batch_group_id, envio
// sequencial, falha parcial e separação dos itens com fallback PDF.

import { describe, expect, it, vi } from "vitest";
import {
  failedItems,
  newBatchItem,
  runBatchPrint,
  validateBatch,
  validateBatchItem,
  type BatchPrintItem,
} from "./batch-print";
import type { LayoutSnapshot } from "./direct-print";
import { PrintAgentOfflineError, type PrintAgentClient } from "./print-agent-client";
import type { PrinterConfig } from "./types";

// ---- Fixtures ----
const layout: LayoutSnapshot = {
  id: "layout-1",
  name: "Nutricional 10x15",
  status: "ativo",
  label_type: "nutricional",
  format: {
    id: "fmt-1", width: 100, height: 150, unit: "mm",
    margin_top: 2, margin_right: 2, margin_bottom: 2, margin_left: 2,
    orientation: "portrait",
  },
  elements: [{ id: "e1", element_type: "text", x: 5, y: 5, width: 50, height: 8 }],
};

const printer: PrinterConfig = {
  id: "p1", company_id: "co-1", name: "Zebra",
  manufacturer: null, model: null, printer_type: "termica", location: null,
  max_width: 110, max_height: 200, dpi: 203,
  paper_type: null, ribbon_type: null, connection_type: "usb",
  is_default: true, notes: null, status: "ativo",
  driver_name: "ZD", agent_printer_id: "ZD-001", raw_language: "ZPL",
  speed: 4, rotation: 0, auto_cut: false, label_advance: 2,
  offset_x: 0, offset_y: 0, scale: 100,
  margin_top: 1, margin_right: 1, margin_bottom: 1, margin_left: 1,
  created_at: "", updated_at: "",
};

function makeItem(over: Partial<BatchPrintItem> = {}): BatchPrintItem {
  return newBatchItem({
    companyId: "co-1",
    productId: "prod-1",
    productName: "Linguiça",
    printer,
    layout,
    quantity: 3,
    compatibleLayoutIds: ["layout-1"],
    labelData: { product_name: "Linguiça" },
    ...over,
  });
}

// Mock do PrintQueueService usado por runDirectPrint
vi.mock("./print-queue-service", () => {
  let seq = 0;
  return {
    PrintQueueService: {
      enqueue: vi.fn(async (j: any) => ({ id: `job-${++seq}`, ...j, status: "pending", attempts: 0 })),
      markSent: vi.fn(async () => undefined),
      updateStatus: vi.fn(async () => undefined),
      recordFailure: vi.fn(async () => undefined),
    },
  };
});

function makeMockAgent(behavior: "ok" | "offline" | "mixed"): PrintAgentClient {
  let n = 0;
  return {
    submit: vi.fn(async () => {
      n++;
      if (behavior === "offline") throw new PrintAgentOfflineError();
      if (behavior === "mixed" && n === 2) throw new PrintAgentOfflineError();
      return { jobId: `agent-${n}` };
    }),
  } as unknown as PrintAgentClient;
}

describe("validateBatchItem", () => {
  it("aceita item válido", () => {
    expect(validateBatchItem(makeItem()).ok).toBe(true);
  });
  it("bloqueia produto vazio", () => {
    const r = validateBatchItem(makeItem({ productId: "" }));
    expect(r.ok).toBe(false);
    expect(r.errors.join(" ")).toMatch(/Produto/);
  });
  it("bloqueia quantidade zero", () => {
    expect(validateBatchItem(makeItem({ quantity: 0 })).ok).toBe(false);
  });
  it("bloqueia layout incompatível", () => {
    const r = validateBatchItem(makeItem({ compatibleLayoutIds: ["outro"] }));
    expect(r.ok).toBe(false);
    expect(r.errors.join(" ")).toMatch(/compatível/);
  });
  it("bloqueia impressora inativa", () => {
    const r = validateBatchItem(makeItem({ printer: { ...printer, status: "inativo" } }));
    expect(r.ok).toBe(false);
  });
});

describe("validateBatch", () => {
  it("classifica cada item individualmente", () => {
    const states = validateBatch([makeItem(), makeItem({ productId: "" })]);
    expect(states[0].status).toBe("ready");
    expect(states[1].status).toBe("invalid");
    expect(states[1].validationErrors.length).toBeGreaterThan(0);
  });
});

describe("runBatchPrint", () => {
  it("agrupa jobs sob um batch_group_id e marca enviados", async () => {
    const agent = makeMockAgent("ok");
    const summary = await runBatchPrint(agent, [makeItem(), makeItem()], { batchGroupId: "B1" });
    expect(summary.batchGroupId).toBe("B1");
    expect(summary.sent).toBe(2);
    expect(summary.failed).toBe(0);
    expect(summary.invalid).toBe(0);
    expect(summary.items.every((i) => i.status === "sent")).toBe(true);
  });

  it("itens inválidos não são enviados", async () => {
    const agent = makeMockAgent("ok");
    const summary = await runBatchPrint(agent, [makeItem({ productId: "" }), makeItem()]);
    expect(summary.invalid).toBe(1);
    expect(summary.sent).toBe(1);
    expect((agent.submit as any).mock.calls.length).toBe(1);
  });

  it("marca fallback_pdf quando o Print Agent está offline", async () => {
    const agent = makeMockAgent("offline");
    const summary = await runBatchPrint(agent, [makeItem(), makeItem()]);
    expect(summary.fallback).toBe(2);
    expect(summary.sent).toBe(0);
    expect(failedItems(summary).length).toBe(2);
  });

  it("permite falha parcial — restantes seguem", async () => {
    const agent = makeMockAgent("mixed");
    const summary = await runBatchPrint(agent, [makeItem(), makeItem(), makeItem()]);
    expect(summary.sent).toBe(2);
    expect(summary.fallback).toBe(1);
  });

  it("emite progresso por item", async () => {
    const agent = makeMockAgent("ok");
    const events: string[] = [];
    await runBatchPrint(agent, [makeItem(), makeItem()], {
      onProgress: (p) => events.push(`${p.done}/${p.total}:${p.state.status}`),
    });
    // sending + done por item
    expect(events.length).toBeGreaterThanOrEqual(2);
    expect(events.some((e) => e.includes("sent"))).toBe(true);
  });
});

describe("failedItems", () => {
  it("retorna apenas failed/fallback_pdf", async () => {
    const agent = makeMockAgent("offline");
    const summary = await runBatchPrint(agent, [makeItem(), makeItem()]);
    const failed = failedItems(summary);
    expect(failed.length).toBe(2);
    expect(failed.every((f) => f.status === "fallback_pdf")).toBe(true);
  });
});
