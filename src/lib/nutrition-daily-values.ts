// Central Daily Values (Valores Diários de Referência - VDR) para rotulagem
// nutricional, conforme legislação vigente ANVISA (RDC 429/2020 + IN 75/2020).
//
// IMPORTANTE:
//  - Esta é a ÚNICA fonte de verdade dos VDR utilizados pelo sistema.
//  - Preview, PDF, impressão direta e impressão em lote consomem daqui.
//  - Nunca duplicar/hardcodar valores em outros arquivos.
//
// Nutrientes sem VDR estabelecido pela ANVISA (ex.: Açúcares Totais e
// Gorduras Trans) ficam com valor `null`. Nesses casos:
//  - Quando o nutriente vale exatamente 0 → exibe "0%".
//  - Quando o nutriente é > 0 → coluna %VD fica vazia (não há VD parametrizado).
//  - Quando o nutriente é ausente/null/undefined → coluna vazia.

export type NutritionKey =
  | "energy_kcal"
  | "carbs_g"
  | "total_sugars_g"
  | "added_sugars_g"
  | "protein_g"
  | "total_fat_g"
  | "saturated_fat_g"
  | "trans_fat_g"
  | "fiber_g"
  | "sodium_mg";

/** Valores Diários de Referência (ANVISA RDC 429/2020 + IN 75/2020). */
export const DAILY_VALUES: Record<NutritionKey, number | null> = {
  energy_kcal: 2000,
  carbs_g: 300,
  total_sugars_g: null,   // ANVISA: sem VDR estabelecido
  added_sugars_g: 50,
  protein_g: 50,          // Correção: era 75, agora 50 conforme ANVISA
  total_fat_g: 65,
  saturated_fat_g: 20,
  trans_fat_g: null,      // ANVISA: sem VDR estabelecido (evitar ao máximo)
  fiber_g: 25,
  sodium_mg: 2000,
};

/**
 * Distingue "valor numérico informado" (inclui 0) de "valor ausente".
 * Retorna o número quando `v` for número finito (0 é válido); caso contrário null.
 */
export function toFiniteNumber(v: unknown): number | null {
  if (v === null || v === undefined || v === "") return null;
  const n = typeof v === "number" ? v : Number(v);
  return Number.isFinite(n) ? n : null;
}

/**
 * Cálculo unificado do %VD para uma etiqueta nutricional.
 *
 * Regras (conforme escopo):
 *  - valor ausente/null/undefined/""   → ""            (célula vazia)
 *  - valor === 0                       → "0%"          (obrigatório, mesmo sem VDR)
 *  - valor > 0 e há VDR                → "N%" (arredondado)
 *  - valor > 0 e não há VDR (null)     → ""            (nutriente sem VDR)
 *  - override explícito em `explicitPct` → usa o valor fornecido (arredondado)
 */
export function calculateDailyValuePercent(
  key: NutritionKey,
  amount: unknown,
  explicitPct?: number | null,
): string {
  if (typeof explicitPct === "number" && Number.isFinite(explicitPct)) {
    return `${Math.round(explicitPct)}%`;
  }
  const n = toFiniteNumber(amount);
  if (n === null) return "";
  if (n === 0) return "0%";
  const ref = DAILY_VALUES[key];
  if (ref == null || ref <= 0) return "";
  const pct = (n / ref) * 100;
  if (!Number.isFinite(pct)) return "";
  return `${Math.round(pct)}%`;
}
