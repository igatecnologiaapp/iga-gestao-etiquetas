import type { AdapterContext, DriverLanguage } from "./types";

export type DirectRawLanguage = "ZPL" | "EPL" | "PPLA" | "PPLB" | "TSPL" | "ESCPOS" | "GDI";

export const DIRECT_RAW_LANGUAGES: Array<{ value: DirectRawLanguage | "driver"; label: string }> = [
  { value: "driver", label: "Detectar automaticamente" },
  { value: "ZPL", label: "ZPL — Zebra" },
  { value: "EPL", label: "EPL — Zebra/Eltron/Argox compatível" },
  { value: "PPLA", label: "PPLA — Argox" },
  { value: "PPLB", label: "PPLB — Argox" },
  { value: "TSPL", label: "TSPL — TSC/Elgin/4BARCODE" },
  { value: "ESCPOS", label: "ESC/POS — cupom/texto" },
  { value: "GDI", label: "Windows GDI/texto — fallback técnico" },
];

const FIELD_LABELS: Record<string, string> = {
  product_name: "Produto",
  brand: "Marca",
  internal_code: "Codigo",
  sku: "SKU",
  ean: "EAN",
  ingredients: "Ingredientes",
  allergens: "Alergenicos",
  gluten: "Gluten",
  lactose: "Lactose",
  preservation: "Conservacao",
  preparation: "Preparo",
  legal_notes: "Obs. legais",
  observations: "Obs.",
  nutrition_notes: "Obs.",
  lot: "Lote",
  manufacture_date: "Fab.",
  expiry: "Val.",
  weight: "Peso",
  price: "Preco",
  regular_price: "Preco",
  promotional_price: "Oferta",
  previous_price: "De",
  wholesale_price: "Atacado",
  wholesale_min_quantity: "Qtd. min.",
  promotion_name: "Promocao",
  promotion_rules: "Regras",
  sale_unit: "Unidade",
};

function asText(value: unknown): string {
  if (value == null) return "";
  if (typeof value === "string") return value;
  if (typeof value === "number" || typeof value === "boolean") return String(value);
  return JSON.stringify(value);
}

export function sanitizeRawText(value: unknown, max = 180): string {
  return asText(value)
    .normalize("NFKD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[\x00-\x08\x0b\x0c\x0e-\x1f\x7f]/g, " ")
    .replace(/\s+/g, " ")
    .trim()
    .slice(0, max);
}

export function zplText(value: unknown): string {
  return sanitizeRawText(value).replace(/[\\^~]/g, " ");
}

export function quotedText(value: unknown): string {
  return sanitizeRawText(value).replace(/"/g, "'");
}

export function resolveElementText(el: Record<string, unknown>, label: Record<string, unknown>): string {
  const type = String(el.element_type ?? "");
  if (type === "fixed_text") return sanitizeRawText(el.fixed_text ?? "Texto");
  if (type === "custom_field") return sanitizeRawText(label[String(el.bound_field ?? "")] ?? el.bound_field ?? "");
  if (type === "nutrition_facts") return "INFORMACAO NUTRICIONAL";
  if (type === "qrcode") return sanitizeRawText(label.qr_payload ?? label.barcode_value ?? "QR");
  if (type === "barcode") return sanitizeRawText(label.barcode_value ?? label.ean ?? label.internal_code ?? "0000000000000");
  const value = label[type];
  if (value == null || value === "") return "";
  const prefix = FIELD_LABELS[type];
  const text = sanitizeRawText(value, type === "ingredients" ? 260 : 180);
  return prefix && !["product_name", "price", "regular_price", "promotional_price"].includes(type)
    ? `${prefix}: ${text}`
    : text;
}

export function elementMm(el: Record<string, unknown>, key: "x" | "y" | "width" | "height"): number {
  const dbKey = key === "x" ? "pos_x" : key === "y" ? "pos_y" : key;
  const value = el[key] ?? el[dbKey] ?? 0;
  const n = Number(value);
  return Number.isFinite(n) ? n : 0;
}

function haystack(...parts: Array<string | null | undefined>): string {
  return parts.filter(Boolean).join(" ").toLowerCase();
}

export function normalizeRawLanguage(
  rawLanguage?: string | null,
  driverName?: string | null,
  manufacturer?: string | null,
  model?: string | null,
): DirectRawLanguage | null {
  const raw = String(rawLanguage ?? "").trim().toUpperCase().replace(/[\s/_-]/g, "");
  if (raw === "ZPL") return "ZPL";
  if (raw === "EPL" || raw === "EPL2") return "EPL";
  if (raw === "PPLA") return "PPLA";
  if (raw === "PPLB") return "PPLB";
  if (raw === "TSPL" || raw === "TSPL2") return "TSPL";
  if (raw === "ESCPOS" || raw === "ESC/POS") return "ESCPOS";
  if (raw === "GDI" || raw === "WINDOWSGDI") return "GDI";

  const h = haystack(driverName, manufacturer, model);
  if (!h) return null;
  if (h.includes("zpl") || h.includes("zebra") || h.includes("zdesigner")) return "ZPL";
  if (h.includes("epl") || h.includes("eltron")) return "EPL";
  if (h.includes("ppla")) return "PPLA";
  if (h.includes("pplb")) return "PPLB";
  if (h.includes("argox")) return "PPLB";
  if (h.includes("tspl") || h.includes("tsc") || h.includes("elgin") || h.includes("4barcode")) return "TSPL";
  if (h.includes("esc/pos") || h.includes("escpos") || h.includes("epson tm")) return "ESCPOS";
  return null;
}

export function toDriverLanguage(language: DirectRawLanguage | null): DriverLanguage {
  if (language === "ZPL" || language === "EPL" || language === "PPLA" || language === "PPLB" || language === "TSPL") return language;
  return "driver";
}

export function buildSimpleTestRaw(language: DirectRawLanguage, printerName: string, now = new Date()): string {
  const lines = [
    "TESTE DE IMPRESSAO DIRETA",
    "Produto Teste",
    now.toLocaleString("pt-BR"),
    "Quantidade: 1",
    `Impressora: ${sanitizeRawText(printerName, 80)}`,
  ];
  switch (language) {
    case "ZPL":
      return [
        "^XA",
        "^CI28",
        "^PW812",
        "^LL406",
        ...lines.map((line, i) => `^FO40,${40 + i * 38}^A0N,28,28^FD${zplText(line)}^FS`),
        "^PQ1",
        "^XZ",
      ].join("\n");
    case "TSPL":
      return [
        "SIZE 100 mm,50 mm",
        "GAP 2 mm,0 mm",
        "DIRECTION 1",
        "CLS",
        ...lines.map((line, i) => `TEXT 35,${30 + i * 38},"3",0,1,1,"${quotedText(line)}"`),
        "PRINT 1,1",
      ].join("\n");
    case "EPL":
    case "PPLA":
    case "PPLB":
      return [
        "N",
        "q800",
        "Q400,24",
        ...lines.map((line, i) => `A35,${30 + i * 36},0,3,1,1,N,"${quotedText(line)}"`),
        "P1",
      ].join("\n");
    case "ESCPOS":
      return `\x1b@${lines.join("\r\n")}\r\n\x1dV\x00`;
    case "GDI":
    default:
      return `${lines.join("\r\n")}\r\n\f`;
  }
}

export function buildPlainTextRaw(ctx: AdapterContext): string {
  const title = sanitizeRawText(ctx.jobName ?? ctx.label.product_name ?? "Etiqueta", 80);
  const body = buildTextLinesFromElements(ctx)
    .filter((item) => item.text && item.type !== "box" && item.type !== "line")
    .map((item) => item.text)
    .slice(0, 18);
  const lines = [title, "", ...body];
  return `${lines.join("\r\n")}\r\n\f`;
}

export function rawSize(raw: string | null | undefined): number {
  return raw ? new Blob([raw]).size : 0;
}

export function buildTextLinesFromElements(ctx: AdapterContext): Array<{ type: string; text: string; x: number; y: number; w: number; h: number; font: number; bold: boolean }> {
  const elements = (ctx.dimensional.element_bounds ?? []).map((bounds) => {
    const source = (ctx.printer as any).__layout_elements?.find((el: any) => String(el.id) === String(bounds.element_id)) ?? null;
    return { bounds, source };
  });
  const fallbackElements = elements.length
    ? elements
    : ((ctx.printer as any).__layout_elements ?? []).map((source: any) => ({
        source,
        bounds: {
          element_id: source.id,
          x_mm: elementMm(source, "x"),
          y_mm: elementMm(source, "y"),
          width_mm: elementMm(source, "width"),
          height_mm: elementMm(source, "height"),
        },
      }));

  return (fallbackElements as any[])
    .map(({ bounds, source }: any) => {
      const type = String(source?.element_type ?? "text");
      const text = resolveElementText(source ?? { element_type: type }, ctx.label);
      return {
        type,
        text,
        x: Number(bounds.x_mm ?? 0),
        y: Number(bounds.y_mm ?? 0),
        w: Number(bounds.width_mm ?? 20),
        h: Number(bounds.height_mm ?? 6),
        font: Number(source?.font_size ?? 8),
        bold: !!source?.bold,
      };
    })
    .filter((item: { type: string; text: string }) => item.type === "box" || item.type === "line" || item.type === "barcode" || item.type === "qrcode" || item.text);
}