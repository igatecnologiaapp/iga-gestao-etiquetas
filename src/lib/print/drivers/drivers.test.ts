// FASE 13 — Testes da camada de drivers/adapters.

import { describe, expect, it } from "vitest";
import type { DimensionalPayload } from "../layout-engine";
import type { PrinterConfig } from "../types";
import {
  DRIVER_REGISTRY,
  renderWithAdapter,
  selectAdapter,
  suggestLanguageForManufacturer,
  validateAdapterContext,
} from "./index";
import { buildZplPreview } from "./zpl";
import { buildEplPreview } from "./epl";
import { buildPplbPreview } from "./pplb";
import { buildTsplPreview } from "./tspl";

function makePrinter(over: Partial<PrinterConfig> = {}): PrinterConfig {
  return {
    id: "p1",
    company_id: "c1",
    name: "Test",
    manufacturer: null,
    model: null,
    printer_type: "termica",
    location: null,
    max_width: 110,
    max_height: 200,
    dpi: 203,
    paper_type: null,
    ribbon_type: null,
    connection_type: null,
    is_default: false,
    notes: null,
    status: "ativo",
    driver_name: null,
    agent_printer_id: "AGT-1",
    raw_language: "driver",
    speed: 4,
    rotation: 0,
    auto_cut: false,
    label_advance: null,
    offset_x: 0,
    offset_y: 0,
    scale: 100,
    margin_top: 0,
    margin_right: 0,
    margin_bottom: 0,
    margin_left: 0,
    created_at: "",
    updated_at: "",
    ...over,
  };
}

function makeDimensional(over: Partial<DimensionalPayload> = {}): DimensionalPayload {
  return {
    width_mm: 100,
    height_mm: 100,
    width_cm: 10,
    height_cm: 10,
    width_px: 800,
    height_px: 800,
    dpi: 203,
    scale: 100,
    rotation: 0,
    offset_x: 0,
    offset_y: 0,
    margins: { top: 0, right: 0, bottom: 0, left: 0 },
    printable_area: { x: 0, y: 0, width: 100, height: 100 },
    layout_type: "nutricional_10x10",
    detected_format: "nutricional_10x10",
    element_bounds: [
      { element_id: "e1", x_mm: 2, y_mm: 2, width_mm: 50, height_mm: 10, within_printable_area: true },
    ],
    raw_language: "driver",
    unit_conversion_info: { source_unit: "cm", target_unit: "mm" } as any,
    ...over,
  };
}

describe("FASE 13 — adapter selection", () => {
  it("usa adapter direto por raw_language", () => {
    const sel = selectAdapter(makePrinter({ raw_language: "ZPL" }));
    expect(sel.effective).toBe("ZPL");
    expect(sel.fallbackUsed).toBe(false);
  });

  it("fallback ao driver padrão quando linguagem desconhecida", () => {
    const sel = selectAdapter(makePrinter({ raw_language: "XYZ" as any }));
    expect(sel.effective).toBe("driver");
    expect(sel.fallbackUsed).toBe(true);
  });

  it("usa sugestão por fabricante quando linguagem não tem adapter funcional", () => {
    const sel = selectAdapter(makePrinter({ raw_language: "DPL" as any, manufacturer: "TSC" }));
    expect(sel.effective).toBe("TSPL");
    expect(sel.fallbackUsed).toBe(true);
  });

  it("mapeia fabricantes conhecidos", () => {
    expect(suggestLanguageForManufacturer("Zebra ZD220")).toBe("ZPL");
    expect(suggestLanguageForManufacturer("Argox OS-214")).toBe("PPLB");
    expect(suggestLanguageForManufacturer("Elgin L42 PRO")).toBe("TSPL");
    expect(suggestLanguageForManufacturer("Datamax E-4205")).toBe("DPL");
    expect(suggestLanguageForManufacturer("Brother QL-810W")).toBe("driver");
    expect(suggestLanguageForManufacturer("Epson TM-T20")).toBe("driver");
    expect(suggestLanguageForManufacturer(null)).toBeNull();
  });
});

describe("FASE 13 — geração de payload por linguagem", () => {
  const ctx = {
    printer: makePrinter(),
    dimensional: makeDimensional(),
    label: {},
    copies: 3,
  };

  it("ZPL gera estrutura ^XA…^XZ", () => {
    const raw = buildZplPreview(ctx);
    expect(raw).toMatch(/^CT~~CD/);
    expect(raw).toContain("^XA");
    expect(raw).toContain("^XZ");
    expect(raw).toContain("^PQ3");
  });

  it("EPL gera comandos N/q/Q/P", () => {
    const raw = buildEplPreview(ctx);
    expect(raw.startsWith("N")).toBe(true);
    expect(raw).toMatch(/\nq\d+/);
    expect(raw).toMatch(/\nQ\d+,24/);
    expect(raw.trimEnd().endsWith("P3")).toBe(true);
  });

  it("PPLB gera Q/q/N/P", () => {
    const raw = buildPplbPreview(ctx);
    expect(raw).toMatch(/^Q\d+,24/);
    expect(raw).toContain("\nN");
    expect(raw.trimEnd().endsWith("P3")).toBe(true);
  });

  it("TSPL gera SIZE/GAP/PRINT", () => {
    const raw = buildTsplPreview(ctx);
    expect(raw).toContain("SIZE 100 mm, 100 mm");
    expect(raw).toContain("GAP 2 mm, 0 mm");
    expect(raw.trimEnd().endsWith("PRINT 3,1")).toBe(true);
  });
});

describe("FASE 13 — validações cruzadas", () => {
  it("rejeita DPI inválido", () => {
    const errs = validateAdapterContext(DRIVER_REGISTRY.ZPL, {
      printer: makePrinter({ raw_language: "ZPL" }),
      dimensional: makeDimensional({ dpi: 0 }),
      label: {},
      copies: 1,
    });
    expect(errs.length).toBeGreaterThan(0);
  });

  it("rejeita rotação não suportada", () => {
    const errs = validateAdapterContext(DRIVER_REGISTRY.driver, {
      printer: makePrinter(),
      dimensional: makeDimensional({ rotation: 45 as any }),
      label: {},
      copies: 1,
    });
    expect(errs.join(" ")).toMatch(/Rota/);
  });

  it("rejeita layout sem elementos", () => {
    const errs = validateAdapterContext(DRIVER_REGISTRY.driver, {
      printer: makePrinter(),
      dimensional: makeDimensional({ element_bounds: [] }),
      label: {},
      copies: 1,
    });
    expect(errs.join(" ")).toMatch(/elementos/);
  });

  it("rejeita dimensão inválida", () => {
    const errs = validateAdapterContext(DRIVER_REGISTRY.driver, {
      printer: makePrinter(),
      dimensional: makeDimensional({ width_mm: 0, height_mm: 0 }),
      label: {},
      copies: 1,
    });
    expect(errs.join(" ")).toMatch(/Dimens/);
  });
});

describe("FASE 13 — render integrado", () => {
  it("renderiza ZPL com aviso de maturity 'prepared'", () => {
    const r = renderWithAdapter(makePrinter({ raw_language: "ZPL", manufacturer: "Zebra" }), {
      printer: makePrinter({ raw_language: "ZPL", manufacturer: "Zebra" }),
      dimensional: makeDimensional(),
      label: {},
      copies: 1,
    });
    expect(r.errors).toEqual([]);
    expect(r.output.language).toBe("ZPL");
    expect(r.output.kind).toBe("raw");
    expect(r.output.raw).toContain("^XA");
    expect(r.output.maturity).toBe("prepared");
  });

  it("renderiza driver padrão com saída dimensional", () => {
    const r = renderWithAdapter(makePrinter(), {
      printer: makePrinter(),
      dimensional: makeDimensional(),
      label: {},
      copies: 1,
    });
    expect(r.output.kind).toBe("dimensional");
    expect(r.output.dimensional).toBeDefined();
  });

  it("aplica fallback de fabricante e propaga aviso", () => {
    const printer = makePrinter({ raw_language: "DPL" as any, manufacturer: "TSC" });
    const r = renderWithAdapter(printer, {
      printer,
      dimensional: makeDimensional(),
      label: {},
      copies: 1,
    });
    expect(r.selection.effective).toBe("TSPL");
    expect(r.selection.fallbackUsed).toBe(true);
    expect(r.output.warnings.join(" ")).toMatch(/sugerido por fabricante|sem adapter/);
  });
});
