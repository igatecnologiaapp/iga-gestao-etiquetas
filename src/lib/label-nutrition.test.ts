import { describe, it, expect } from "vitest";
import {
  renderNutritionTable,
  elementValue,
  buildLabelDataFromSnapshot,
  type PdfElement,
  type PdfNutrition,
} from "@/lib/label-pdf";
import {
  checkNutritionElementHeight,
  MIN_NUTRITION_HEIGHT_MM,
  RECOMMENDED_NUTRITION_HEIGHT_MM,
} from "@/lib/nutrition-layout-rules";

/**
 * Lightweight stub of jsPDF: we only need to record every `text(...)` call
 * so the test can assert which strings the renderer drew onto the label.
 * This avoids spinning up a real canvas and lets the test run in happy-dom.
 */
function makeStubDoc() {
  const texts: string[] = [];
  const calls: { method: string; args: any[] }[] = [];
  const record = (method: string) => (...args: any[]) => calls.push({ method, args });
  const doc = {
    texts,
    calls,
    setFont: record("setFont"),
    setFontSize: record("setFontSize"),
    setLineWidth: record("setLineWidth"),
    setDrawColor: record("setDrawColor"),
    rect: record("rect"),
    line: record("line"),
    text: (t: string, ..._rest: any[]) => {
      texts.push(String(t));
      calls.push({ method: "text", args: [t, ..._rest] });
    },
    splitTextToSize: (t: string) => [String(t)],
  };
  return doc;
}

const NUTRITION_FULL: PdfNutrition = {
  serving_size_g: 100,
  serving_household: "1 espeto",
  energy_kcal: 250,
  carbs_g: 2.5,
  total_sugars_g: 0,
  added_sugars_g: 0,
  protein_g: 20,
  total_fat_g: 18,
  saturated_fat_g: 7.5,
  trans_fat_g: 0,
  fiber_g: 1.2,
  sodium_mg: 480,
  notes: "Pode conter traços de leite.",
};

function runNutritionRender(width: number, height: number, fontSize: number) {
  const doc = makeStubDoc();
  renderNutritionTable(doc as any, NUTRITION_FULL, 0, 0, width, height, fontSize);
  return doc.texts;
}

describe("Etiqueta nutricional — renderNutritionTable (PDF)", () => {
  describe("10x10 (100x100 mm, área nutricional ~56mm)", () => {
    const texts = runNutritionRender(95, 56, 6);

    it("renderiza Fibra alimentar sem cortar", () => {
      expect(texts.some((t) => /Fibra alimentar/i.test(t))).toBe(true);
    });
    it("renderiza Sódio sem cortar", () => {
      expect(texts.some((t) => /Sódio/i.test(t))).toBe(true);
    });
    it("renderiza Observações dentro da tabela", () => {
      expect(texts.some((t) => /Obs\.:/i.test(t) && /Pode conter/i.test(t))).toBe(true);
    });
    it("renderiza %VD footer obrigatório", () => {
      expect(texts.some((t) => /Valores diários de referência/i.test(t))).toBe(true);
    });
    it("renderiza as 10 linhas nutricionais obrigatórias", () => {
      const labels = [
        "Valor energético",
        "Carboidratos",
        "Açúcares totais",
        "Açúcares adicionados",
        "Proteínas",
        "Gorduras totais",
        "Gorduras saturadas",
        "Gorduras trans",
        "Fibra alimentar",
        "Sódio",
      ];
      for (const lbl of labels) {
        expect(texts.some((t) => t.includes(lbl))).toBe(true);
      }
    });
  });

  describe("10x15 (100x150 mm, área nutricional ~75mm)", () => {
    const texts = runNutritionRender(95, 75, 7);

    it("renderiza Fibra alimentar sem cortar", () => {
      expect(texts.some((t) => /Fibra alimentar/i.test(t))).toBe(true);
    });
    it("renderiza Sódio sem cortar", () => {
      expect(texts.some((t) => /Sódio/i.test(t))).toBe(true);
    });
    it("renderiza Observações dentro da tabela, sem duplicar abaixo", () => {
      const obs = texts.filter((t) => /Obs\.:/i.test(t));
      expect(obs.length).toBe(1);
    });
    it("renderiza título INFORMAÇÃO NUTRICIONAL", () => {
      expect(texts.some((t) => /INFORMA[ÇC][ÃA]O NUTRICIONAL/i.test(t))).toBe(true);
    });
  });
});

describe("Etiqueta nutricional — elementValue (Preview/PDF compartilhados)", () => {
  const baseEl = (type: string): PdfElement => ({
    element_type: type,
    pos_x: 0, pos_y: 0, width: 10, height: 5,
  });

  it("Observações avulsas NÃO renderizam (já vão dentro da tabela nutricional)", () => {
    const out = elementValue(baseEl("observations"), { observations: "X" });
    expect(out).toBe("");
  });

  it("Ingredientes renderizam com prefixo correto", () => {
    const out = elementValue(baseEl("ingredients"), { ingredients: "Carne, sal" });
    expect(out).toBe("Ingredientes: Carne, sal");
  });

  it("Alergênicos passam o texto original", () => {
    const out = elementValue(baseEl("allergens"), { allergens: "CONTÉM GLÚTEN" });
    expect(out).toBe("CONTÉM GLÚTEN");
  });

  it("Glúten reflete o cadastro real (não é forçado a 'não contém')", () => {
    expect(elementValue(baseEl("gluten"), { gluten: "CONTÉM GLÚTEN" })).toBe("CONTÉM GLÚTEN");
    expect(elementValue(baseEl("gluten"), { gluten: "NÃO CONTÉM GLÚTEN" })).toBe("NÃO CONTÉM GLÚTEN");
    expect(elementValue(baseEl("gluten"), {})).toBe("");
  });

  it("Conservação renderiza com prefixo", () => {
    const out = elementValue(baseEl("preservation"), { preservation: "-18°C" });
    expect(out).toBe("Conservação: -18°C");
  });
});

describe("Etiqueta nutricional — snapshot de impressão", () => {
  it("propaga campos obrigatórios do snapshot (preview e PDF lêem do mesmo adapter)", () => {
    const snap = {
      product_snapshot: {
        name: "Espeto bovino temperado",
        contains_gluten: true,
        contains_lactose: false,
        preservation: "Manter a -18°C",
      },
      nutrition_snapshot: NUTRITION_FULL,
      emission_snapshot: { batch_code: "L123", weight: 0.1 },
      ingredients_snapshot: [{ name: "Carne bovina" }, { name: "Sal" }],
      allergens_snapshot: [],
    };
    const d = buildLabelDataFromSnapshot(snap);
    expect(d.product_name).toBe("Espeto bovino temperado");
    expect(d.ingredients).toContain("Carne bovina");
    expect(d.gluten).toBe("CONTÉM GLÚTEN");
    expect(d.lactose).toBe("NÃO CONTÉM LACTOSE");
    expect(d.preservation).toBe("Manter a -18°C");
    expect(d.observations).toBe(NUTRITION_FULL.notes);
    expect(d.nutrition?.fiber_g).toBe(1.2);
    expect(d.nutrition?.sodium_mg).toBe(480);
    expect(d.weight).toMatch(/^0,100 /);
  });
});

describe("Validação de altura mínima do nutrition_facts (editor)", () => {
  it("bloqueia altura abaixo do mínimo", () => {
    const r = checkNutritionElementHeight(30, 90, "mm");
    expect(r.ok).toBe(false);
    expect(r.level).toBe("error");
    expect(r.message).toMatch(/Altura insuficiente/);
  });

  it("emite warning entre o mínimo e o recomendado", () => {
    const r = checkNutritionElementHeight(MIN_NUTRITION_HEIGHT_MM + 1, 90, "mm");
    expect(r.ok).toBe(true);
    expect(r.level).toBe("warning");
  });

  it("aceita altura recomendada para 10x10 (~56mm)", () => {
    const r = checkNutritionElementHeight(56, 90, "mm");
    expect(r.ok).toBe(true);
    expect(r.level).toBe("ok");
  });

  it("aceita altura recomendada para 10x15 (~75mm)", () => {
    const r = checkNutritionElementHeight(75, 90, "mm");
    expect(r.ok).toBe(true);
    expect(r.level).toBe("ok");
  });

  it("converte unidades corretamente (cm)", () => {
    const r = checkNutritionElementHeight(RECOMMENDED_NUTRITION_HEIGHT_MM / 10, 9, "cm");
    expect(r.heightMm).toBeCloseTo(RECOMMENDED_NUTRITION_HEIGHT_MM, 5);
    expect(r.level).toBe("ok");
  });
});
