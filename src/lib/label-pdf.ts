// Phase 5 — PDF label rendering service (client-side, browser only)
import jsPDF from "jspdf";
import QRCode from "qrcode";
import JsBarcode from "jsbarcode";

export type PdfFormat = {
  width: number; // in unit
  height: number;
  unit: "mm" | "cm" | "in" | "px" | string;
  margin_top: number;
  margin_bottom: number;
  margin_left: number;
  margin_right: number;
  orientation?: string;
  columns?: number | null;
  rows?: number | null;
  spacing_h?: number | null;
  spacing_v?: number | null;
};

export type PdfElement = {
  element_type: string;
  bound_field?: string | null;
  fixed_text?: string | null;
  pos_x: number;
  pos_y: number;
  width: number;
  height: number;
  layer?: number;
  font_family?: string | null;
  font_size?: number | null;
  color?: string | null;
  bold?: boolean | null;
  align?: string | null;
  visible?: boolean | null;
};

export type PdfNutrition = {
  serving_size_g?: number | null;
  serving_household?: string | null;
  energy_kcal?: number | null;
  carbs_g?: number | null;
  total_sugars_g?: number | null;
  added_sugars_g?: number | null;
  protein_g?: number | null;
  total_fat_g?: number | null;
  saturated_fat_g?: number | null;
  trans_fat_g?: number | null;
  fiber_g?: number | null;
  sodium_mg?: number | null;
  daily_values?: Record<string, number> | null;
  notes?: string | null;
};

export type PdfLabelData = {
  product_name?: string;
  brand?: string;
  internal_code?: string;
  sku?: string;
  ean?: string;
  ingredients?: string;
  allergens?: string;
  gluten?: string;
  lactose?: string;
  preservation?: string;
  preparation?: string;
  legal_notes?: string;
  lot?: string;
  manufacture_date?: string;
  expiry?: string;
  weight?: string;
  price?: string;
  // Shelf-label / promotion fields (Phase 6)
  regular_price?: string;
  promotional_price?: string;
  previous_price?: string;
  wholesale_price?: string;
  wholesale_min_quantity?: string;
  promotion_name?: string;
  promotion_rules?: string;
  promotion_start?: string;
  promotion_end?: string;
  promotion_period?: string;
  sale_unit?: string;
  company_name?: string;
  nutrition?: PdfNutrition | null;
  qr_payload?: any;
  barcode_value?: string;
  unique_label_code?: string;
};

export type PdfRenderOptions = {
  format: PdfFormat;
  elements: PdfElement[];
  /** When provided length > 1, renders that many copies; defaults to 1 */
  labels: PdfLabelData[];
};

const UNIT_TO_MM: Record<string, number> = { mm: 1, cm: 10, in: 25.4, px: 25.4 / 96 };

function toMm(value: number, unit: string) {
  return value * (UNIT_TO_MM[unit] ?? 1);
}

export function formatBRL(v: number | string | null | undefined): string {
  if (v == null || v === "") return "";
  const n = typeof v === "number" ? v : Number(v);
  if (!isFinite(n)) return "";
  return n.toLocaleString("pt-BR", { style: "currency", currency: "BRL" });
}

function fmtNum(n: number | null | undefined, digits = 1) {
  if (n === null || n === undefined || Number.isNaN(Number(n))) return "—";
  const v = Number(n);
  return Number.isInteger(v) ? v.toString() : v.toFixed(digits);
}

async function qrDataUrl(payload: any, sizePx = 256): Promise<string> {
  const text = typeof payload === "string" ? payload : JSON.stringify(payload ?? {});
  return QRCode.toDataURL(text, { errorCorrectionLevel: "M", margin: 1, width: sizePx });
}

function barcodeDataUrl(value: string, width = 1.2, height = 50): string {
  const canvas = document.createElement("canvas");
  try {
    JsBarcode(canvas, value || "0000000000000", {
      format: "CODE128",
      width,
      height,
      displayValue: true,
      fontSize: 12,
      margin: 0,
    });
    return canvas.toDataURL("image/png");
  } catch {
    return "";
  }
}

function renderNutritionTable(
  doc: jsPDF,
  n: PdfNutrition | null | undefined,
  x: number, y: number, w: number, h: number, fontSize: number,
) {
  const baseSize = Math.max(5, fontSize);
  doc.setLineWidth(0.15);
  doc.rect(x, y, w, h);

  let cy = y + 0.5;
  doc.setFont("helvetica", "bold");
  doc.setFontSize(baseSize + 0.5);
  doc.text("INFORMAÇÃO NUTRICIONAL", x + w / 2, cy + baseSize * 0.35, { align: "center" });
  cy += baseSize * 0.6 + 0.6;

  doc.setFont("helvetica", "normal");
  doc.setFontSize(baseSize - 0.5);
  doc.text("Porções por embalagem: Variável", x + 1, cy + baseSize * 0.35);
  cy += baseSize * 0.55 + 0.2;
  const serving = n?.serving_size_g ? `Porção: ${fmtNum(n.serving_size_g, 0)} g${n?.serving_household ? ` (${n.serving_household})` : ""}` : "Porção: —";
  doc.text(serving, x + 1, cy + baseSize * 0.35);
  cy += baseSize * 0.55 + 0.4;

  doc.setLineWidth(0.1);
  doc.line(x, cy, x + w, cy);
  cy += 0.5;

  const rows: Array<{ label: string; qty: string; vd: string; indent?: boolean }> = [
    { label: "Valor energético", qty: `${fmtNum(n?.energy_kcal, 0)} kcal`, vd: dv(n, "energy_kcal", 200) },
    { label: "Carboidratos", qty: `${fmtNum(n?.carbs_g)} g`, vd: dv(n, "carbs_g", 50) },
    { label: "Açúcares totais", qty: `${fmtNum(n?.total_sugars_g)} g`, vd: "", indent: true },
    { label: "Açúcares adicionados", qty: `${fmtNum(n?.added_sugars_g)} g`, vd: dv(n, "added_sugars_g", 50), indent: true },
    { label: "Proteínas", qty: `${fmtNum(n?.protein_g)} g`, vd: dv(n, "protein_g", 50) },
    { label: "Gorduras totais", qty: `${fmtNum(n?.total_fat_g)} g`, vd: dv(n, "total_fat_g", 55) },
    { label: "Saturadas", qty: `${fmtNum(n?.saturated_fat_g)} g`, vd: dv(n, "saturated_fat_g", 22), indent: true },
    { label: "Trans", qty: `${fmtNum(n?.trans_fat_g)} g`, vd: "", indent: true },
    { label: "Fibra alimentar", qty: `${fmtNum(n?.fiber_g)} g`, vd: dv(n, "fiber_g", 25) },
    { label: "Sódio", qty: `${fmtNum(n?.sodium_mg, 0)} mg`, vd: dv(n, "sodium_mg", 2000) },
  ];
  const rowH = Math.max(0.9, baseSize * 0.55);
  const col1 = x + 1;
  const col1Indent = x + 1 + Math.max(1, baseSize * 0.25);
  const col2 = x + w * 0.55;
  const col3 = x + w * 0.78;

  doc.setFont("helvetica", "bold");
  doc.text("Nutriente", col1, cy + rowH * 0.7, { align: "left" });
  doc.text("Qtd.", col2, cy + rowH * 0.7, { align: "left" });
  doc.text("%VD*", col3, cy + rowH * 0.7, { align: "left" });
  cy += rowH;
  doc.line(x, cy, x + w, cy);

  doc.setFont("helvetica", "normal");
  for (const r of rows) {
    if (cy + rowH > y + h) break;
    doc.text(r.label, r.indent ? col1Indent : col1, cy + rowH * 0.7, { align: "left" });
    doc.text(r.qty, col2, cy + rowH * 0.7, { align: "left" });
    doc.text(r.vd, col3, cy + rowH * 0.7, { align: "left" });
    cy += rowH;
  }

  doc.setFontSize(baseSize - 1);
  if (cy + rowH < y + h) {
    doc.text("*% Valores diários de referência com base em uma dieta de 2.000 kcal.", x + 1, y + h - 0.6, { maxWidth: w - 2 });
  }
}

function dv(n: PdfNutrition | null | undefined, key: keyof PdfNutrition, ref: number): string {
  if (!n) return "";
  const raw = (n as any)[key];
  if (raw === null || raw === undefined) return "";
  const explicit = n.daily_values?.[key as string];
  if (typeof explicit === "number") return `${explicit.toFixed(0)}%`;
  const pct = (Number(raw) / ref) * 100;
  if (!isFinite(pct)) return "";
  return `${pct.toFixed(0)}%`;
}

function elementValue(el: PdfElement, d: PdfLabelData): string {
  if (el.element_type === "fixed_text") return el.fixed_text || "";
  if (el.element_type === "custom_field") return el.bound_field || "";
  switch (el.element_type) {
    case "product_name": return d.product_name ?? "";
    case "brand": return d.brand ?? "";
    case "internal_code": return d.internal_code ? `Cód: ${d.internal_code}` : "";
    case "sku": return d.sku ?? "";
    case "ingredients": return d.ingredients ? `Ingredientes: ${d.ingredients}` : "Ingredientes: —";
    case "allergens": return d.allergens ?? "";
    case "gluten": return d.gluten ?? "";
    case "lactose": return d.lactose ?? "";
    case "preservation": return d.preservation ? `Conservação: ${d.preservation}` : "";
    case "preparation": return d.preparation ?? "";
    case "lot": return d.lot ? `Lote: ${d.lot}` : "";
    case "manufacture_date": return d.manufacture_date ? `Fab: ${d.manufacture_date}` : "";
    case "expiry": return d.expiry ? `Val: ${d.expiry}` : "";
    case "weight": return d.weight ? `Peso: ${d.weight}` : "";
    case "price": return d.price ?? d.regular_price ?? "";
    case "regular_price": return d.regular_price ?? "";
    case "promotional_price": return d.promotional_price ?? "";
    case "previous_price": return d.previous_price ? `de ${d.previous_price}` : "";
    case "wholesale_price": return d.wholesale_price ?? "";
    case "wholesale_min_quantity": return d.wholesale_min_quantity ? `A partir de ${d.wholesale_min_quantity} un` : "";
    case "promotion_name": return d.promotion_name ?? "";
    case "promotion_rules": return d.promotion_rules ?? "";
    case "promotion_period": return d.promotion_period ?? (d.promotion_start && d.promotion_end ? `${d.promotion_start} a ${d.promotion_end}` : "");
    case "promotion_start": return d.promotion_start ? `De: ${d.promotion_start}` : "";
    case "promotion_end": return d.promotion_end ? `Até: ${d.promotion_end}` : "";
    case "sale_unit": return d.sale_unit ?? "";
    default: return "";
  }
}

async function renderSingleLabel(
  doc: jsPDF, opts: PdfRenderOptions, d: PdfLabelData, offsetX: number, offsetY: number,
) {
  const { format, elements } = opts;
  const u = format.unit;
  const fmt = {
    w: toMm(format.width, u), h: toMm(format.height, u),
    mt: toMm(format.margin_top, u), mb: toMm(format.margin_bottom, u),
    ml: toMm(format.margin_left, u), mr: toMm(format.margin_right, u),
  };

  // Border outline (thin)
  doc.setLineWidth(0.15);
  doc.setDrawColor(180, 180, 180);
  doc.rect(offsetX, offsetY, fmt.w, fmt.h);
  doc.setDrawColor(0, 0, 0);

  const visible = elements.filter((e) => e.visible !== false).sort((a, b) => (a.layer ?? 0) - (b.layer ?? 0));

  for (const el of visible) {
    const x = offsetX + toMm(el.pos_x, u);
    const y = offsetY + toMm(el.pos_y, u);
    const w = toMm(el.width, u);
    const h = toMm(el.height, u);
    const fs = Math.max(4, Math.min(18, el.font_size ?? 8));
    doc.setFontSize(fs);
    doc.setFont("helvetica", el.bold ? "bold" : "normal");

    const t = el.element_type;

    if (t === "line") { doc.setLineWidth(0.3); doc.line(x, y + h / 2, x + w, y + h / 2); continue; }
    if (t === "box")  { doc.setLineWidth(0.25); doc.rect(x, y, w, h); continue; }

    if (t === "qrcode") {
      const sizePx = Math.max(64, Math.round(Math.min(w, h) * 12));
      const data = await qrDataUrl(d.qr_payload ?? d.unique_label_code ?? "", sizePx);
      doc.addImage(data, "PNG", x, y, Math.min(w, h), Math.min(w, h));
      continue;
    }
    if (t === "barcode") {
      const value = d.barcode_value || d.ean || d.unique_label_code || "0000000000000";
      const data = barcodeDataUrl(value, 1.2, Math.max(40, h * 6));
      if (data) doc.addImage(data, "PNG", x, y, w, h);
      continue;
    }
    if (t === "logo" || t === "image") {
      doc.setDrawColor(160); doc.rect(x, y, w, h);
      doc.text(t === "logo" ? "LOGO" : "IMG", x + w / 2, y + h / 2, { align: "center", baseline: "middle" });
      doc.setDrawColor(0);
      continue;
    }
    if (t === "nutrition_facts") {
      renderNutritionTable(doc, d.nutrition ?? null, x, y, w, h, fs);
      continue;
    }

    // Text content
    const text = elementValue(el, d);
    if (!text) continue;
    const align = (el.align as any) || "left";
    const tx = align === "center" ? x + w / 2 : align === "right" ? x + w : x;
    const lines = doc.splitTextToSize(text, w - 0.5);
    const lh = fs * 0.42;
    let cy = y + lh;
    for (const ln of lines as string[]) {
      if (cy > y + h) break;
      doc.text(ln, tx, cy, { align });
      cy += lh;
    }
  }
}

/**
 * Build a PDF with N labels. When the format defines columns/rows, packs labels per page;
 * otherwise one label per page sized to the label.
 */
export async function buildLabelsPdf(opts: PdfRenderOptions): Promise<Blob> {
  const { format, labels } = opts;
  const u = format.unit;
  const labelW = toMm(format.width, u);
  const labelH = toMm(format.height, u);

  const cols = Math.max(1, format.columns ?? 1);
  const rows = Math.max(1, format.rows ?? 1);
  const perPage = cols * rows;

  // If columns/rows > 1 we use A4 sheet, else page = label size
  const useSheet = perPage > 1;
  const sheetW = useSheet ? 210 : labelW;
  const sheetH = useSheet ? 297 : labelH;
  const sx = useSheet ? toMm(format.spacing_h ?? 0, u) : 0;
  const sy = useSheet ? toMm(format.spacing_v ?? 0, u) : 0;
  const mx = useSheet ? (sheetW - cols * labelW - (cols - 1) * sx) / 2 : 0;
  const my = useSheet ? 10 : 0;

  const doc = new jsPDF({
    orientation: sheetW > sheetH ? "landscape" : "portrait",
    unit: "mm",
    format: useSheet ? "a4" : [sheetW, sheetH],
    compress: true,
  });

  for (let i = 0; i < labels.length; i++) {
    const slot = i % perPage;
    if (i > 0 && slot === 0) doc.addPage();
    const r = Math.floor(slot / cols);
    const c = slot % cols;
    const ox = mx + c * (labelW + sx);
    const oy = my + r * (labelH + sy);
    await renderSingleLabel(doc, opts, labels[i], ox, oy);
  }

  return doc.output("blob");
}

export function downloadBlob(blob: Blob, filename: string) {
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 1500);
}

export function openBlob(blob: Blob) {
  const url = URL.createObjectURL(blob);
  window.open(url, "_blank");
  setTimeout(() => URL.revokeObjectURL(url), 30000);
}

/* ===== Snapshot adapter ===== */

export function buildFormatFromSnapshot(layoutSnapshot: any): PdfFormat | null {
  const f = layoutSnapshot?.format;
  if (!f) return null;
  return {
    width: Number(f.width), height: Number(f.height), unit: f.unit,
    margin_top: Number(f.margin_top), margin_bottom: Number(f.margin_bottom),
    margin_left: Number(f.margin_left), margin_right: Number(f.margin_right),
    orientation: f.orientation,
    columns: f.columns, rows: f.rows, spacing_h: f.spacing_h, spacing_v: f.spacing_v,
  };
}

export function buildLabelDataFromSnapshot(snapshot: any, opts?: { unique_label_code?: string; sequential?: number }): PdfLabelData {
  const p = snapshot?.product_snapshot ?? {};
  const n = snapshot?.nutrition_snapshot ?? null;
  const em = snapshot?.emission_snapshot ?? {};
  const ing = (snapshot?.ingredients_snapshot ?? []) as any[];
  const al = (snapshot?.allergens_snapshot ?? []) as any[];
  const ingText = Array.isArray(ing) && ing.length
    ? ing.map((i: any) => i?.name ?? i).join(", ")
    : (p.commercial_description ?? "");
  const alParts: string[] = [];
  if (Array.isArray(al) && al.length) alParts.push(`Contém: ${al.map((a: any) => a?.name ?? a).join(", ")}`);
  if (p.contains_gluten) alParts.push("CONTÉM GLÚTEN");
  else if (p && Object.keys(p).length) alParts.push("NÃO CONTÉM GLÚTEN");
  if (p.contains_lactose) alParts.push("Contém lactose");
  const alText = alParts.join(" · ");
  return {
    product_name: p.name,
    brand: p.brand_name ?? undefined,
    internal_code: p.internal_code,
    sku: p.sku,
    ean: p.ean,
    ingredients: ingText,
    allergens: alText,
    gluten: p ? (p.contains_gluten ? "CONTÉM GLÚTEN" : "NÃO CONTÉM GLÚTEN") : undefined,
    lactose: p ? (p.contains_lactose ? "CONTÉM LACTOSE" : "NÃO CONTÉM LACTOSE") : undefined,
    preservation: p.preservation,
    preparation: p.preparation,
    legal_notes: p.legal_notes,
    lot: em.batch_code,
    manufacture_date: em.manufacture_date ? new Date(em.manufacture_date).toLocaleDateString("pt-BR") : undefined,
    expiry: em.expiration_date ? new Date(em.expiration_date).toLocaleDateString("pt-BR") : undefined,
    weight: em.weight ? `${em.weight} kg` : (p.standard_weight ? `${p.standard_weight} ${p.unit_of_measure ?? ""}` : undefined),
    nutrition: n,
    regular_price: em.regular_price != null ? formatBRL(em.regular_price) : undefined,
    promotional_price: em.promotional_price != null ? formatBRL(em.promotional_price) : undefined,
    previous_price: em.previous_price != null ? formatBRL(em.previous_price) : (em.regular_price != null && em.promotional_price != null ? formatBRL(em.regular_price) : undefined),
    wholesale_price: em.wholesale_price != null ? formatBRL(em.wholesale_price) : undefined,
    wholesale_min_quantity: em.wholesale_min_quantity != null ? String(em.wholesale_min_quantity) : undefined,
    promotion_name: em.promotion_name,
    promotion_rules: em.promotion_rules,
    promotion_start: em.promotion_start ? new Date(em.promotion_start).toLocaleDateString("pt-BR") : undefined,
    promotion_end: em.promotion_end ? new Date(em.promotion_end).toLocaleDateString("pt-BR") : undefined,
    sale_unit: em.sale_unit ?? p.unit_of_measure,
    qr_payload: { ...em, id: opts?.unique_label_code, seq: opts?.sequential },
    barcode_value: p.ean,
    unique_label_code: opts?.unique_label_code,
  };
}
