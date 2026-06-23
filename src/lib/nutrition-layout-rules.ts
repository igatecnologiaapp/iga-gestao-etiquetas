// Rules that protect the nutrition table from being rendered in a space
// where it cannot fit the mandatory ANVISA content (title + meta + 10 rows
// + %VD footer + observations).
//
// The values below are conservative and were derived empirically from the
// PDF renderer (renderNutritionTable in label-pdf.ts):
//   - 10 nutritional rows (Fiber and Sodium MUST appear)
//   - 1 header row (Quantidade / %VD*)
//   - title + 2 meta lines (porções / porção)
//   - 1 %VD footer line
//   - reserved area for "Observações" (rendered inside the table)
//
// Below MIN_NUTRITION_HEIGHT_MM the renderer is forced to compress the rows
// so much that Fiber / Sodium / Observations become illegible or get
// silently clipped on print. We therefore warn the operator.

const UNIT_TO_MM: Record<string, number> = { mm: 1, cm: 10, in: 25.4, px: 25.4 / 96 };

export const MIN_NUTRITION_HEIGHT_MM = 45;
export const RECOMMENDED_NUTRITION_HEIGHT_MM = 55;
export const MIN_NUTRITION_WIDTH_MM = 35;

export type NutritionHeightCheck = {
  ok: boolean;
  level: "ok" | "warning" | "error";
  heightMm: number;
  widthMm: number;
  minMm: number;
  recommendedMm: number;
  message?: string;
};

export function toMm(value: number, unit: string): number {
  return value * (UNIT_TO_MM[unit] ?? 1);
}

/**
 * Validate a nutrition_facts element against the minimum height required to
 * show Fiber, Sodium and Observations without being clipped.
 */
export function checkNutritionElementHeight(
  height: number,
  width: number,
  unit: string,
): NutritionHeightCheck {
  const heightMm = toMm(height, unit);
  const widthMm = toMm(width, unit);

  if (heightMm < MIN_NUTRITION_HEIGHT_MM || widthMm < MIN_NUTRITION_WIDTH_MM) {
    return {
      ok: false,
      level: "error",
      heightMm,
      widthMm,
      minMm: MIN_NUTRITION_HEIGHT_MM,
      recommendedMm: RECOMMENDED_NUTRITION_HEIGHT_MM,
      message:
        `Altura insuficiente para exibir a tabela nutricional completa. ` +
        `Altura mínima recomendada: ${MIN_NUTRITION_HEIGHT_MM} mm ` +
        `(ideal: ${RECOMMENDED_NUTRITION_HEIGHT_MM} mm). ` +
        `Com menos espaço, Fibra alimentar, Sódio ou Observações podem ser cortados na impressão.`,
    };
  }

  if (heightMm < RECOMMENDED_NUTRITION_HEIGHT_MM) {
    return {
      ok: true,
      level: "warning",
      heightMm,
      widthMm,
      minMm: MIN_NUTRITION_HEIGHT_MM,
      recommendedMm: RECOMMENDED_NUTRITION_HEIGHT_MM,
      message:
        `Altura abaixo do recomendado (${RECOMMENDED_NUTRITION_HEIGHT_MM} mm). ` +
        `A tabela será renderizada, mas a leitura pode ficar comprimida.`,
    };
  }

  return {
    ok: true,
    level: "ok",
    heightMm,
    widthMm,
    minMm: MIN_NUTRITION_HEIGHT_MM,
    recommendedMm: RECOMMENDED_NUTRITION_HEIGHT_MM,
  };
}
