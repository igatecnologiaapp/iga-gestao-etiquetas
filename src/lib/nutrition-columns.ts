// Central configuration for nutrition-table value columns.
//
// Objetivo (Fase 16.13 — camada de apresentação):
// A tabela nutricional das etiquetas passa a exibir DUAS colunas de valores
// dinamicamente rotuladas com o peso/unidade da porção cadastrada no produto
// (ex.: "100 g", "80 g"). Neste momento ambas exibem os mesmos valores
// nutricionais (por porção), porém a estrutura já está preparada para
// evoluir para bases distintas (por 100 g, preparado, cru, drenado, etc.)
// bastando adicionar uma nova entrada em `buildNutritionColumns`.
//
// Nada aqui altera os cálculos nutricionais — cada coluna apenas descreve
// qual valor bruto será lido e como será formatado.

export type NutritionColumnSource = "per_serving" | "per_100" | "custom";

export type NutritionValueColumn = {
  /** chave interna estável */
  key: string;
  /** cabeçalho já formatado (ex.: "100 g"). Vazio → sem cabeçalho */
  title: string;
  /** origem lógica dos valores (documentação para evoluções futuras) */
  source: NutritionColumnSource;
  /** alinhamento do texto */
  align: "left" | "right" | "center";
  /** peso relativo da coluna (soma livre; usada para distribuir largura) */
  widthWeight: number;
};

export type NutritionColumnsConfig = {
  labelCol: { widthWeight: number };
  valueCols: NutritionValueColumn[];
  vdCol: { title: string; widthWeight: number };
};

/**
 * Rótulo dinâmico da porção — ex.: "100 g".
 * Regras:
 *  - Se não houver `serving_size_g`, retorna string vazia (cabeçalho fica sem título).
 *  - A unidade padrão é "g" (schema atual armazena gramas). Se o texto de
 *    medida caseira mencionar "ml", assume-se líquido e usa "ml".
 */
export function formatServingHeader(
  servingSize: number | null | undefined,
  household?: string | null,
): string {
  if (servingSize == null || !isFinite(Number(servingSize))) return "";
  const n = Number(servingSize);
  const isMl = typeof household === "string" && /\bml\b/i.test(household);
  const unit = isMl ? "ml" : "g";
  const rendered = Number.isInteger(n) ? String(n) : n.toFixed(1).replace(/\.0$/, "");
  return `${rendered} ${unit}`;
}

/**
 * Constrói as colunas nutricionais para uma dada porção.
 * Estrutura preparada para expansão futura: basta trocar/incluir entradas
 * em `valueCols` (ex.: `{ key: "per100", title: "100 g", source: "per_100" }`).
 */
export function buildNutritionColumns(
  n: { serving_size_g?: number | null; serving_household?: string | null } | null | undefined,
): NutritionColumnsConfig {
  const header = formatServingHeader(n?.serving_size_g, n?.serving_household);
  // Duas colunas dinâmicas — hoje ambas mostram valor por porção;
  // amanhã a segunda pode virar "por 100 g" ou "preparado".
  // Pesos calibrados (Fase 16.14 — refinamento visual):
  // Proporção alvo ~ 45% / 18% / 18% / 19% (soma 10.0), garantindo
  // separação clara entre as duas colunas numéricas e o %VD*.
  const valueCols: NutritionValueColumn[] = [
    { key: "serving_a", title: header, source: "per_serving", align: "center", widthWeight: 1.8 },
    { key: "serving_b", title: header, source: "per_serving", align: "center", widthWeight: 1.8 },
  ];
  return {
    labelCol: { widthWeight: 4.5 },
    valueCols,
    vdCol: { title: "%VD*", widthWeight: 1.9 },
  };
}
