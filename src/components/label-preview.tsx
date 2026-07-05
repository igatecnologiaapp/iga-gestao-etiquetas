import { useEffect, useMemo, useState } from "react";
import QRCode from "qrcode";
import JsBarcode from "jsbarcode";
import { buildNutritionColumns } from "@/lib/nutrition-columns";
import { calculateDailyValuePercent } from "@/lib/nutrition-daily-values";


export type PreviewElement = {
  id?: string;
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

export type PreviewFormat = {
  width: number;
  height: number;
  unit: string;
  margin_top: number;
  margin_bottom: number;
  margin_left: number;
  margin_right: number;
  orientation: string;
};

export type PreviewData = {
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
  observations?: string;
  lot?: string;
  manufacture_date?: string;
  expiry?: string;
  weight?: string;
  price?: string;
  // Shelf-label / promotion (Phase 6)
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
  qr_payload?: any;
  barcode_value?: string;
  nutrition?: any;
};

const fallback: PreviewData = {
  product_name: "Espeto Bovino Temperado",
  internal_code: "PRD-001",
  sku: "SKU-001",
  ean: "7890000000017",
  brand: "IGA",
  weight: "150 g",
  lot: "L20260619",
  expiry: "19/12/2026",
  manufacture_date: "19/06/2026",
  ingredients: "Carne bovina, sal, alho, cebola, pimenta-do-reino.",
  preservation: "Manter congelado a -18°C",
  allergens: "Pode conter: glúten",
  gluten: "CONTÉM GLÚTEN",
  lactose: "NÃO CONTÉM LACTOSE",
  price: "R$ 24,90",
};

function labelOf(el: PreviewElement, d: PreviewData): string {
  if (el.element_type === "fixed_text") return el.fixed_text || "Texto fixo";
  if (el.element_type === "custom_field") return el.bound_field || "Campo personalizado";
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
    case "legal_notes": return d.legal_notes ?? "";
    case "observations":
    case "nutrition_notes":
      // Observações é renderizada dentro do bloco de Informação Nutricional.
      // Não renderizar em elementos avulsos do rodapé para evitar duplicidade.
      return "";
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

const UNIT_TO_PX: Record<string, number> = { mm: 3.78, cm: 37.8, in: 96, px: 1 };

function QrImage({ payload, size }: { payload: any; size: number }) {
  const [src, setSrc] = useState<string>("");
  useEffect(() => {
    const text = typeof payload === "string" ? payload : JSON.stringify(payload ?? {});
    QRCode.toDataURL(text || " ", { errorCorrectionLevel: "M", margin: 1, width: Math.max(64, Math.round(size)) })
      .then(setSrc).catch(() => setSrc(""));
  }, [payload, size]);
  return src ? <img src={src} style={{ width: size, height: size }} alt="QR" /> :
    <div style={{ width: size, height: size, background: "#000", color: "#fff", display: "grid", placeItems: "center", fontSize: 10 }}>QR</div>;
}

function BarcodeImage({ value, width, height }: { value: string; width: number; height: number }) {
  const [src, setSrc] = useState<string>("");
  useEffect(() => {
    try {
      const c = document.createElement("canvas");
      JsBarcode(c, value || "0000000000000", { format: "CODE128", width: 1.2, height: Math.max(30, height), displayValue: true, fontSize: 12, margin: 0 });
      setSrc(c.toDataURL("image/png"));
    } catch { setSrc(""); }
  }, [value, height]);
  return src ? <img src={src} style={{ width, height, objectFit: "fill" }} alt="barcode" /> :
    <div style={{ width, height, background: "repeating-linear-gradient(90deg,#000 0 2px,#fff 2px 4px)" }} />;
}

function NutritionMini({ n, fontPx }: { n: any | null | undefined; fontPx: number }) {
  const fmt = (v: any, d = 1) =>
    v == null || isNaN(Number(v))
      ? "—"
      : Number.isInteger(Number(v))
        ? String(v)
        : Number(v).toFixed(d);
  const dvPct = (v: any, ref: number) => {
    if (v == null || isNaN(Number(v))) return "";
    const p = (Number(v) / ref) * 100;
    return isFinite(p) ? `${p.toFixed(0)}%` : "";
  };
  const rows: Array<{ label: string; qty: string; vd: string; indent?: boolean }> = [
    { label: "Valor energético (kcal)", qty: fmt(n?.energy_kcal, 0), vd: dvPct(n?.energy_kcal, 2000) },
    { label: "Carboidratos (g)", qty: fmt(n?.carbs_g), vd: dvPct(n?.carbs_g, 300) },
    { label: "Açúcares totais (g)", qty: fmt(n?.total_sugars_g), vd: "", indent: true },
    { label: "Açúcares adicionados (g)", qty: fmt(n?.added_sugars_g), vd: dvPct(n?.added_sugars_g, 50), indent: true },
    { label: "Proteínas (g)", qty: fmt(n?.protein_g), vd: dvPct(n?.protein_g, 75) },
    { label: "Gorduras totais (g)", qty: fmt(n?.total_fat_g), vd: dvPct(n?.total_fat_g, 65) },
    { label: "Gorduras saturadas (g)", qty: fmt(n?.saturated_fat_g), vd: dvPct(n?.saturated_fat_g, 20), indent: true },
    { label: "Gorduras trans (g)", qty: fmt(n?.trans_fat_g), vd: "", indent: true },
    { label: "Fibra alimentar (g)", qty: fmt(n?.fiber_g), vd: dvPct(n?.fiber_g, 25) },
    { label: "Sódio (mg)", qty: fmt(n?.sodium_mg, 0), vd: dvPct(n?.sodium_mg, 2000) },
  ];

  // Colunas dinâmicas (Fase 16.13): substitui o cabeçalho "Quantidade" por
  // duas colunas rotuladas com o peso/unidade da porção (ex.: "100 g").
  const cols = buildNutritionColumns(n);
  const totalWeight =
    cols.labelCol.widthWeight +
    cols.valueCols.reduce((s, c) => s + c.widthWeight, 0) +
    cols.vdCol.widthWeight;
  const pctW = (w: number) => `${(w / totalWeight) * 100}%`;

  return (
    <div style={{ fontSize: fontPx, lineHeight: 1.05, padding: 2, height: "100%", overflow: "hidden", textAlign: "left", display: "flex", flexDirection: "column" }}>
      <div style={{ fontWeight: 800, textAlign: "center", fontSize: fontPx * 1.35, borderBottom: "1.5px solid #000", paddingBottom: 1 }}>
        INFORMAÇÃO NUTRICIONAL
      </div>
      <div style={{ fontSize: fontPx * 0.95, marginTop: 1 }}>Porções por embalagem: Variável</div>
      <div style={{ fontSize: fontPx * 0.95, fontWeight: 700, borderBottom: "1px solid #000", paddingBottom: 1 }}>
        {n?.serving_size_g ? `Porção: ${n.serving_size_g} g${n?.serving_household ? ` (${n.serving_household})` : ""}` : "Porção: —"}
      </div>
      <table style={{ width: "100%", borderCollapse: "collapse", fontSize: fontPx * 0.92, tableLayout: "fixed", flex: 1 }}>
        <colgroup>
          <col style={{ width: pctW(cols.labelCol.widthWeight) }} />
          {cols.valueCols.map((c) => (
            <col key={c.key} style={{ width: pctW(c.widthWeight) }} />
          ))}
          <col style={{ width: pctW(cols.vdCol.widthWeight) }} />
        </colgroup>
        <thead>
          <tr>
            <td></td>
            {cols.valueCols.map((c, idx) => (
              <td
                key={c.key}
                style={{ textAlign: c.align, fontWeight: 700, borderBottom: "1px solid #000", paddingLeft: idx === 0 ? 6 : 4, paddingRight: 4, whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}
              >
                {c.title}
              </td>
            ))}
            <td style={{ textAlign: "center", fontWeight: 700, borderBottom: "1px solid #000", paddingLeft: 6, paddingRight: 2 }}>{cols.vdCol.title}</td>
          </tr>
        </thead>
        <tbody>
          {rows.map((r) => (
            <tr key={r.label} style={{ borderBottom: "0.5px solid #cbd5e1" }}>
              <td style={{ textAlign: "left", paddingLeft: r.indent ? 8 : 1, paddingRight: 4, whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>{r.label}</td>
              {cols.valueCols.map((c, idx) => (
                <td key={c.key} style={{ textAlign: c.align, paddingLeft: idx === 0 ? 6 : 4, paddingRight: 4 }}>{r.qty}</td>
              ))}
              <td style={{ textAlign: "center", paddingLeft: 6, paddingRight: 2 }}>{r.vd}</td>
            </tr>
          ))}
        </tbody>
      </table>
      {n?.notes ? (
        <div style={{ fontSize: fontPx * 0.85, fontStyle: "italic", borderTop: "1px solid #000", paddingTop: 1, marginTop: 1 }}>
          Obs.: {n.notes}
        </div>
      ) : null}
      <div style={{ fontSize: fontPx * 0.8, marginTop: 1 }}>
        *% Valores diários de referência com base em uma dieta de 2.000 kcal.
      </div>
    </div>
  );
}



export function LabelPreview({
  format,
  elements,
  zoom = 2,
  data,
}: {
  format: PreviewFormat;
  elements: PreviewElement[];
  zoom?: number;
  data?: PreviewData;
}) {
  const d = { ...fallback, ...(data ?? {}) };
  const pxPerUnit = (UNIT_TO_PX[format.unit] ?? 3.78) * zoom;

  const usableLeft = format.margin_left * pxPerUnit;
  const usableTop = format.margin_top * pxPerUnit;
  const usableRight = (format.width - format.margin_right) * pxPerUnit;
  const usableBottom = (format.height - format.margin_bottom) * pxPerUnit;

  const W = format.width * pxPerUnit;
  const H = format.height * pxPerUnit;

  const enriched = useMemo(
    () =>
      elements.map((el) => {
        const x = el.pos_x * pxPerUnit;
        const y = el.pos_y * pxPerUnit;
        const w = el.width * pxPerUnit;
        const h = el.height * pxPerUnit;
        const outside =
          x < usableLeft - 0.01 ||
          y < usableTop - 0.01 ||
          x + w > usableRight + 0.01 ||
          y + h > usableBottom + 0.01;
        return { el, x, y, w, h, outside };
      }),
    [elements, pxPerUnit, usableLeft, usableTop, usableRight, usableBottom],
  );

  return (
    <div className="inline-block">
      <div
        className="relative bg-white border border-slate-300 shadow-sm overflow-hidden"
        style={{ width: W, height: H }}
      >
        <div
          className="absolute border border-dashed border-slate-300 pointer-events-none"
          style={{
            left: usableLeft,
            top: usableTop,
            width: usableRight - usableLeft,
            height: usableBottom - usableTop,
          }}
        />
        {enriched
          .filter((e) => e.el.visible !== false)
          .sort((a, b) => (a.el.layer ?? 0) - (b.el.layer ?? 0))
          .map((e, i) => {
            const { el, x, y, w, h, outside } = e;
            const common: React.CSSProperties = {
              position: "absolute",
              left: x,
              top: y,
              width: w,
              height: h,
              fontFamily: el.font_family ?? "Inter",
              fontSize: (el.font_size ?? 10) * zoom * 0.7,
              color: el.color ?? "#111",
              fontWeight: el.bold ? 700 : 400,
              textAlign: (el.align as any) ?? "left",
              outline: outside ? "1px solid #e11d48" : undefined,
              outlineOffset: outside ? 1 : 0,
            };
            if (el.element_type === "line") {
              return <div key={i} style={{ ...common, background: el.color ?? "#111", height: Math.max(1, h) }} />;
            }
            if (el.element_type === "box") {
              return <div key={i} style={{ ...common, border: `1px solid ${el.color ?? "#111"}`, background: "transparent" }} />;
            }
            if (el.element_type === "qrcode") {
              return <div key={i} style={{ ...common, display: "grid", placeItems: "center" }}><QrImage payload={d.qr_payload ?? "QR"} size={Math.min(w, h)} /></div>;
            }
            if (el.element_type === "barcode") {
              return <div key={i} style={common}><BarcodeImage value={d.barcode_value || d.ean || "0000000000000"} width={w} height={h} /></div>;
            }
            if (el.element_type === "image" || el.element_type === "logo") {
              return (
                <div key={i} style={{ ...common, background: "#f1f5f9", display: "grid", placeItems: "center", color: "#64748b" }}>
                  {el.element_type === "logo" ? "LOGO" : "IMG"}
                </div>
              );
            }
            if (el.element_type === "nutrition_facts") {
              return <div key={i} style={{ ...common, border: "1px solid #000", overflow: "hidden" }}><NutritionMini n={d.nutrition} fontPx={(el.font_size ?? 8) * zoom * 0.6} /></div>;
            }
            return (
              <div key={i} style={{ ...common, overflow: "hidden", lineHeight: 1.1, padding: 1 }}>
                {labelOf(el, d)}
              </div>
            );
          })}
      </div>
      <div className="text-xs text-muted-foreground mt-2">
        {format.width} × {format.height} {format.unit} · {format.orientation} · zoom {zoom}×
      </div>
    </div>
  );
}
