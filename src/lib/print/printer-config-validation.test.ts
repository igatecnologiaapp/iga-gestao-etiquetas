import { describe, it, expect } from "vitest";
import { validateTechnicalConfig } from "./printer-config-validation";

describe("validateTechnicalConfig", () => {
  it("aceita config válida", () => {
    expect(validateTechnicalConfig({
      dpi: 203, speed: 4, scale: 100,
      margin_top: 0, margin_right: 0, margin_bottom: 0, margin_left: 0,
      rotation: 0, offset_x: 0, offset_y: 0, label_advance: 0, raw_language: "ZPL",
    })).toEqual([]);
  });
  it("rejeita DPI inválido", () => {
    expect(validateTechnicalConfig({ dpi: 0 }).length).toBeGreaterThan(0);
    expect(validateTechnicalConfig({ dpi: 3000 }).length).toBeGreaterThan(0);
  });
  it("rejeita escala fora do intervalo", () => {
    expect(validateTechnicalConfig({ scale: 5 }).length).toBeGreaterThan(0);
    expect(validateTechnicalConfig({ scale: 500 }).length).toBeGreaterThan(0);
  });
  it("rejeita margem negativa", () => {
    expect(validateTechnicalConfig({ margin_top: -1 }).length).toBeGreaterThan(0);
  });
  it("rejeita rotação não suportada", () => {
    expect(validateTechnicalConfig({ rotation: 45 as any }).length).toBeGreaterThan(0);
  });
  it("rejeita linguagem inválida", () => {
    expect(validateTechnicalConfig({ raw_language: "PCL" as any }).length).toBeGreaterThan(0);
  });
  it("rejeita offset fora do intervalo", () => {
    expect(validateTechnicalConfig({ offset_x: 999 }).length).toBeGreaterThan(0);
    expect(validateTechnicalConfig({ offset_y: -999 }).length).toBeGreaterThan(0);
  });
});
