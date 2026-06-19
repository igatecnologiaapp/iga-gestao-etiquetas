// Phase 4 — Emission helpers
import { supabase } from "@/integrations/supabase/client";

export const LABEL_TYPES = [
  { value: "nutricional", label: "Nutricional" },
  { value: "gondola", label: "Gôndola" },
  { value: "promocional", label: "Promocional" },
  { value: "logistica", label: "Logística" },
  { value: "producao", label: "Produção" },
  { value: "identificacao", label: "Identificação" },
  { value: "validade", label: "Validade" },
  { value: "outros", label: "Outros" },
] as const;

export type LabelType = (typeof LABEL_TYPES)[number]["value"];

export const SUGGESTION_SOURCE_LABEL: Record<string, string> = {
  product: "Produto específico",
  category: "Categoria do produto",
  brand: "Marca",
  branch: "Filial",
  company: "Empresa",
  label_category_default: "Padrão do tipo de etiqueta",
  label_category_any: "Layout ativo compatível",
  manual: "Selecionado manualmente",
};

export async function suggestLayout(params: {
  companyId: string;
  branchId: string | null;
  productId: string;
  labelType: LabelType;
}) {
  const { data, error } = await (supabase as any).rpc("suggest_label_layout", {
    _company_id: params.companyId,
    _branch_id: params.branchId,
    _product_id: params.productId,
    _label_type: params.labelType,
  });
  if (error) throw error;
  const row = (data as any[])?.[0];
  return row ? { layoutId: row.layout_id as string, source: row.source as string } : null;
}

export type PendingFlags = {
  missing_nutrition: boolean;
  missing_ingredients: boolean;
  missing_allergens: boolean;
  missing_shelf_life: boolean;
  missing_preservation: boolean;
  nutrition_in_review: boolean;
  status_pending: boolean;
};

export function blockingIssuesForNutritional(p: PendingFlags | null | undefined): string[] {
  if (!p) return [];
  const out: string[] = [];
  if (p.missing_nutrition) out.push("Sem informação nutricional");
  if (p.missing_ingredients) out.push("Sem ingredientes");
  if (p.missing_allergens) out.push("Sem alergênicos");
  if (p.missing_shelf_life) out.push("Sem validade (shelf life)");
  if (p.missing_preservation) out.push("Sem conservação");
  if (p.nutrition_in_review) out.push("Informação nutricional em revisão");
  if (p.status_pending) out.push("Produto com status pendente/revisão");
  return out;
}

export function computeExpiration(manufactureISO: string | null, shelfLifeDays: number | null): string | null {
  if (!manufactureISO || !shelfLifeDays) return null;
  const d = new Date(manufactureISO);
  if (Number.isNaN(d.getTime())) return null;
  d.setDate(d.getDate() + Number(shelfLifeDays));
  return d.toISOString().slice(0, 10);
}

export function uniqueLabelCode(companyShort: string, batchShort: string, seq: number) {
  const ts = Date.now().toString(36).toUpperCase();
  return `${companyShort}-${batchShort}-${seq.toString().padStart(5, "0")}-${ts}`;
}
