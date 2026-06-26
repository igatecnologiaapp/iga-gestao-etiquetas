// FASE 8 — Testes do motor de layout dimensional.
import { describe, expect, it } from "vitest";
import {
  buildDimensionalPayload,
  computeGeometry,
  detectStandardFormat,
  mmToPt,
  mmToPx,
  toMm,
  validateLayoutDimensions,
} from "./layout-engine";
import type { LayoutSnapshot } from "./direct-print";
import type { PrinterConfig } from "./types";

const printer = (overrides: Partial<PrinterConfig> = {}): PrinterConfig => ({
  id: "p1",
  company_id: "c1",
  name: "Zebra",
  manufacturer: null,
  model: null,
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
  driver_name: "ZD",
  agent_printer_id: "AG1",
  raw_language: "ZPL",
  speed: 4,
  rotation: 0,
  auto_cut: false,
  label_advance: 2,
  offset_x: 0,
  offset_y: 0,
  scale: 100,
  margin_top: 0,
  margin_right: 0,
  margin_bottom: 0,
  margin_left: 0,
  created_at: "",
  updated_at: "",
  ...overrides,
});

const layout = (w: number, h: number, unit = "cm", extras: Partial<LayoutSnapshot> = {}): LayoutSnapshot => ({
  id: "l1",
  name: "L",
  status: "ativo",
  label_type: "nutricional",
  format: { width: w, height: h, unit, margin_top: 0, margin_right: 0, margin_bottom: 0, margin_left: 0, orientation: "portrait" },
  elements: [{ id: "e1", element_type: "text", x: 0.5, y: 0.5, width: 5, height: 1 }],
  ...extras,
});

describe("conversões", () => {
  it("cm→mm", () => expect(toMm(10, "cm")).toBe(100));
  it("in→mm", () => expect(toMm(1, "in")).toBeCloseTo(25.4));
  it("pt→mm", () => expect(toMm(72, "pt")).toBeCloseTo(25.4));
  it("px→mm requer DPI", () => expect(() => toMm(203, "px")).toThrow());
  it("px→mm com DPI", () => expect(toMm(203, "px", 203)).toBeCloseTo(25.4));
  it("mm→px", () => expect(mmToPx(25.4, 203)).toBeCloseTo(203));
  it("mm→pt", () => expect(mmToPt(25.4)).toBeCloseTo(72));
});

describe("formatos padrão", () => {
  it("detecta 10x10", () => expect(detectStandardFormat(100, 100)).toBe("nutricional_10x10"));
  it("detecta 10x15", () => expect(detectStandardFormat(100, 150)).toBe("nutricional_10x15"));
  it("detecta 10x3", () => expect(detectStandardFormat(100, 30)).toBe("gondola_10x3"));
  it("ignora formatos fora do padrão", () => expect(detectStandardFormat(80, 50)).toBeNull());
});

describe("geometria", () => {
  it("10x10cm em 203dpi", () => {
    const g = computeGeometry(layout(10, 10), printer());
    expect(g.width_mm).toBe(100);
    expect(g.height_mm).toBe(100);
    expect(g.width_px).toBe(Math.round(mmToPx(100, 203)));
    expect(g.detected_format).toBe("nutricional_10x10");
    expect(g.scale).toBe(100);
  });
  it("10x15cm preserva escala 100", () => {
    const g = computeGeometry(layout(10, 15), printer());
    expect(g.detected_format).toBe("nutricional_10x15");
    expect(g.scale).toBe(100);
  });
  it("10x3cm para gôndola", () => {
    const g = computeGeometry(layout(10, 3), printer());
    expect(g.detected_format).toBe("gondola_10x3");
  });
  it("escala customizada aplicada", () => {
    const g = computeGeometry(layout(10, 10), printer({ scale: 90 }));
    expect(g.scale).toBe(90);
  });
  it("offset/rotação aplicados", () => {
    const g = computeGeometry(layout(10, 10), printer({ offset_x: 1, offset_y: 2, rotation: 90 }));
    expect(g.offset_x_mm).toBe(1);
    expect(g.offset_y_mm).toBe(2);
    expect(g.rotation).toBe(90);
  });
  it("margens prevalecem maior entre layout e impressora", () => {
    const g = computeGeometry(
      layout(10, 10, "cm", { format: { width: 10, height: 10, unit: "cm", margin_top: 0.2, margin_right: 0, margin_bottom: 0, margin_left: 0, orientation: "portrait" } as any }),
      printer({ margin_top: 5 }),
    );
    expect(g.margins_mm.top).toBe(5);
    expect(g.printable_area_mm.height).toBe(95);
  });
});

describe("validação", () => {
  it("layout sem dimensão", () => {
    const l = layout(0, 0);
    expect(validateLayoutDimensions(l, printer()).ok).toBe(false);
  });
  it("layout sem elementos", () => {
    const l = layout(10, 10, "cm", { elements: [] });
    expect(validateLayoutDimensions(l, printer()).ok).toBe(false);
  });
  it("elemento fora da área útil", () => {
    const l = layout(10, 10, "cm", { elements: [{ id: "x", element_type: "text", x: 50, y: 0, width: 5, height: 1 }] });
    const r = validateLayoutDimensions(l, printer());
    expect(r.ok).toBe(false);
    expect(r.errors.join(" ")).toMatch(/área útil/);
  });
  it("margens inválidas (área zero)", () => {
    const r = validateLayoutDimensions(layout(10, 10), printer({ margin_top: 60, margin_bottom: 60 }));
    expect(r.ok).toBe(false);
  });
  it("rotação inválida", () => {
    const r = validateLayoutDimensions(layout(10, 10), printer({ rotation: 45 as any }));
    expect(r.ok).toBe(false);
  });
  it("escala fora do range", () => {
    const r = validateLayoutDimensions(layout(10, 10), printer({ scale: 500 }));
    expect(r.ok).toBe(false);
  });
  it("escala customizada válida gera warning", () => {
    const r = validateLayoutDimensions(layout(10, 10), printer({ scale: 95 }));
    expect(r.ok).toBe(true);
    expect(r.warnings.length).toBeGreaterThan(0);
  });
  it("layout maior que impressora", () => {
    const r = validateLayoutDimensions(layout(15, 10), printer({ max_width: 110 }));
    expect(r.ok).toBe(false);
  });
  it("aceita 10x10/10x15/10x3 válidos", () => {
    for (const dims of [[10, 10], [10, 15], [10, 3]]) {
      const r = validateLayoutDimensions(layout(dims[0], dims[1]), printer());
      expect(r.ok).toBe(true);
    }
  });
});

describe("payload dimensional", () => {
  it("contém metadados físicos completos", () => {
    const l = layout(10, 15);
    const p = printer({ scale: 100, offset_x: 1, offset_y: 2, rotation: 90 });
    const payload = buildDimensionalPayload(l, p);
    expect(payload.width_mm).toBe(100);
    expect(payload.height_mm).toBe(150);
    expect(payload.width_cm).toBe(10);
    expect(payload.height_cm).toBe(15);
    expect(payload.dpi).toBe(203);
    expect(payload.scale).toBe(100);
    expect(payload.rotation).toBe(90);
    expect(payload.offset_x).toBe(1);
    expect(payload.offset_y).toBe(2);
    expect(payload.detected_format).toBe("nutricional_10x15");
    expect(payload.raw_language).toBe("ZPL");
    expect(payload.printable_area.width).toBe(100);
    expect(payload.element_bounds.length).toBe(1);
    expect(payload.unit_conversion_info.mm_per_inch).toBe(25.4);
  });
});
