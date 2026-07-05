import { describe, it, expect } from "vitest";
import { calculateDailyValuePercent, DAILY_VALUES } from "@/lib/nutrition-daily-values";

describe("calculateDailyValuePercent — VDR centralizados (ANVISA)", () => {
  it("Proteínas 18,4 g com VD 50 g → 37%", () => {
    expect(DAILY_VALUES.protein_g).toBe(50);
    expect(calculateDailyValuePercent("protein_g", 18.4)).toBe("37%");
  });

  it("Açúcares Totais 0 g → 0% (nunca vazio para zero real)", () => {
    expect(calculateDailyValuePercent("total_sugars_g", 0)).toBe("0%");
  });

  it("Açúcares Totais >0 sem VDR → vazio", () => {
    expect(DAILY_VALUES.total_sugars_g).toBeNull();
    expect(calculateDailyValuePercent("total_sugars_g", 5)).toBe("");
  });

  it("Gorduras Trans 0 g → 0%", () => {
    expect(calculateDailyValuePercent("trans_fat_g", 0)).toBe("0%");
  });

  it("Gorduras Trans 0,3 g sem VDR parametrizado → vazio", () => {
    expect(DAILY_VALUES.trans_fat_g).toBeNull();
    expect(calculateDailyValuePercent("trans_fat_g", 0.3)).toBe("");
  });

  it("Valor ausente / null / undefined / '' → vazio (diferente de zero)", () => {
    expect(calculateDailyValuePercent("protein_g", null)).toBe("");
    expect(calculateDailyValuePercent("protein_g", undefined)).toBe("");
    expect(calculateDailyValuePercent("protein_g", "")).toBe("");
    expect(calculateDailyValuePercent("protein_g", "abc")).toBe("");
  });

  it("Nutrientes com VDR usam o valor centralizado", () => {
    expect(DAILY_VALUES).toMatchObject({
      energy_kcal: 2000,
      carbs_g: 300,
      added_sugars_g: 50,
      protein_g: 50,
      total_fat_g: 65,
      saturated_fat_g: 20,
      fiber_g: 25,
      sodium_mg: 2000,
    });
  });

  it("Todas as células com valor 0 exibem 0% (sem célula vazia indevida)", () => {
    const keys = [
      "energy_kcal","carbs_g","total_sugars_g","added_sugars_g","protein_g",
      "total_fat_g","saturated_fat_g","trans_fat_g","fiber_g","sodium_mg",
    ] as const;
    for (const k of keys) {
      expect(calculateDailyValuePercent(k, 0)).toBe("0%");
    }
  });

  it("Override explícito daily_values usa o percentual fornecido", () => {
    expect(calculateDailyValuePercent("protein_g", 18.4, 42)).toBe("42%");
  });

  it("Cálculos amostrais coerentes com VDR", () => {
    expect(calculateDailyValuePercent("carbs_g", 30)).toBe("10%");   // 30/300
    expect(calculateDailyValuePercent("sodium_mg", 400)).toBe("20%"); // 400/2000
    expect(calculateDailyValuePercent("saturated_fat_g", 5)).toBe("25%"); // 5/20
    expect(calculateDailyValuePercent("fiber_g", 5)).toBe("20%"); // 5/25
  });
});
