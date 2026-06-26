// FASE 7 — Testes do orquestrador de impressão direta.
// Cobre validações (campos obrigatórios, compatibilidade, configs técnicas)
// e o caminho de payload. As interações com PrintQueueService/PrintAgentClient
// são exercitadas indiretamente via app.print-labels (integração manual);
// aqui validamos a lógica pura, sem dependência de rede ou Supabase.

import { describe, expect, it } from "vitest";
import { buildAgentPayload, validateDirectPrint, type DirectPrintInput, type LayoutSnapshot } from "./direct-print";
import type { PrinterConfig } from "./types";

const baseLayout: LayoutSnapshot = {
  id: "layout-1",
  name: "Nutricional 10x15",
  status: "ativo",
  label_type: "nutricional",
  format: {
    id: "fmt-1",
    width: 100,
    height: 150,
    unit: "mm",
    margin_top: 2,
    margin_right: 2,
    margin_bottom: 2,
    margin_left: 2,
    orientation: "portrait",
  },
  elements: [
    { id: "el-1", element_type: "text", x: 5, y: 5, width: 50, height: 8 },
    { id: "el-2", element_type: "barcode", x: 5, y: 100, width: 80, height: 20 },
  ],
};

const basePrinter: PrinterConfig = {
  id: "prn-1",
  company_id: "co-1",
  name: "Zebra ZD220",
  manufacturer: "Zebra",
  model: "ZD220",
  printer_type: "termica",
  location: null,
  max_width: 110,
  max_height: 200,
  dpi: 203,
  paper_type: null,
  ribbon_type: null,
  connection_type: "usb",
  is_default: true,
  notes: null,
  status: "ativo",
  driver_name: "ZDesigner ZD220",
  agent_printer_id: "ZD220-USB-001",
  raw_language: "ZPL",
  speed: 4,
  rotation: 0,
  auto_cut: false,
  label_advance: 2,
  offset_x: 0,
  offset_y: 0,
  scale: 100,
  margin_top: 1,
  margin_right: 1,
  margin_bottom: 1,
  margin_left: 1,
  created_at: "2026-01-01T00:00:00Z",
  updated_at: "2026-01-01T00:00:00Z",
};

const baseInput: DirectPrintInput = {
  companyId: "co-1",
  branchId: null,
  productId: "prod-1",
  layout: baseLayout,
  printer: basePrinter,
  quantity: 5,
  compatibleLayoutIds: ["layout-1"],
  labelData: { product_name: "Linguiça toscana" },
};

describe("validateDirectPrint", () => {
  it("aceita input válido", () => {
    expect(validateDirectPrint(baseInput).ok).toBe(true);
  });

  it("bloqueia quantidade inválida", () => {
    const r = validateDirectPrint({ ...baseInput, quantity: 0 });
    expect(r.ok).toBe(false);
    expect(r.errors.join(" ")).toMatch(/Quantidade/);
  });

  it("bloqueia impressora inativa", () => {
    const r = validateDirectPrint({ ...baseInput, printer: { ...basePrinter, status: "inativo" } });
    expect(r.ok).toBe(false);
    expect(r.errors.join(" ")).toMatch(/inativa/);
  });

  it("bloqueia impressora sem agent_printer_id", () => {
    const r = validateDirectPrint({ ...baseInput, printer: { ...basePrinter, agent_printer_id: null } });
    expect(r.ok).toBe(false);
    expect(r.errors.join(" ")).toMatch(/agent_printer_id/);
  });

  it("bloqueia layout incompatível com a impressora", () => {
    const r = validateDirectPrint({ ...baseInput, compatibleLayoutIds: ["outro"] });
    expect(r.ok).toBe(false);
    expect(r.errors.join(" ")).toMatch(/compatível/);
  });

  it("aceita quando lista de compatibilidade está vazia (sem restrição)", () => {
    const r = validateDirectPrint({ ...baseInput, compatibleLayoutIds: [] });
    expect(r.ok).toBe(true);
  });

  it("bloqueia elemento fora da área útil", () => {
    const r = validateDirectPrint({
      ...baseInput,
      layout: { ...baseLayout, elements: [{ id: "x", element_type: "text", x: 9999, y: 1, width: 10, height: 5 }] },
    });
    expect(r.ok).toBe(false);
    expect(r.errors.join(" ")).toMatch(/área útil/);
  });

  it("bloqueia DPI fora do intervalo", () => {
    const r = validateDirectPrint({ ...baseInput, printer: { ...basePrinter, dpi: 9999 } });
    expect(r.ok).toBe(false);
    expect(r.errors.join(" ")).toMatch(/DPI/);
  });
});

describe("buildAgentPayload", () => {
  it("inclui geometria, impressora e dados da etiqueta", () => {
    const p = buildAgentPayload(baseInput);
    expect(p.company_id).toBe("co-1");
    expect(p.printer.agent_printer_id).toBe("ZD220-USB-001");
    expect(p.printer.raw_language).toBe("ZPL");
    expect(p.geometry.width).toBe(100);
    expect(p.geometry.scale).toBe(100);
    expect(p.geometry.margins.top).toBe(1);
    expect(p.label).toEqual({ product_name: "Linguiça toscana" });
    expect(p.layout.elements.length).toBe(2);
    expect(p.origin).toBe("lovable.print-labels");
  });
});
