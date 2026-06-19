import { useMemo } from "react";

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

const sampleData: Record<string, string> = {
  product_name: "Espeto Bovino Temperado",
  internal_code: "PRD-001",
  sku: "SKU-001",
  barcode: "789000000001",
  qrcode: "QR",
  logo: "LOGO",
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
  nutrition_facts: "Tabela nutricional",
  price: "R$ 24,90",
};

function labelOf(el: PreviewElement): string {
  if (el.element_type === "fixed_text") return el.fixed_text || "Texto fixo";
  if (el.element_type === "custom_field") return el.bound_field || "Campo personalizado";
  return sampleData[el.element_type] ?? el.element_type;
}

const UNIT_TO_PX: Record<string, number> = { mm: 3.78, cm: 37.8, in: 96, px: 1 };

export function LabelPreview({
  format,
  elements,
  zoom = 2,
}: {
  format: PreviewFormat;
  elements: PreviewElement[];
  zoom?: number;
}) {
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
        {/* usable area marker */}
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
              return (
                <div
                  key={i}
                  style={{ ...common, background: el.color ?? "#111", height: Math.max(1, h) }}
                />
              );
            }
            if (el.element_type === "box") {
              return (
                <div
                  key={i}
                  style={{ ...common, border: `1px solid ${el.color ?? "#111"}`, background: "transparent" }}
                />
              );
            }
            if (el.element_type === "qrcode") {
              return (
                <div key={i} style={{ ...common, background: "#000", color: "#fff", display: "grid", placeItems: "center" }}>
                  QR
                </div>
              );
            }
            if (el.element_type === "barcode") {
              return (
                <div key={i} style={{ ...common, background: "repeating-linear-gradient(90deg,#000 0 2px,#fff 2px 4px)" }} />
              );
            }
            if (el.element_type === "image" || el.element_type === "logo") {
              return (
                <div key={i} style={{ ...common, background: "#f1f5f9", display: "grid", placeItems: "center", color: "#64748b" }}>
                  {el.element_type === "logo" ? "LOGO" : "IMG"}
                </div>
              );
            }
            return (
              <div key={i} style={{ ...common, overflow: "hidden", lineHeight: 1.1, padding: 1 }}>
                {labelOf(el)}
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
