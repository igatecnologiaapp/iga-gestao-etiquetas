// FASE 8 — Motor de Layout e Padronização Dimensional.
//
// Centraliza conversões de unidade, validações dimensionais e construção
// do payload físico enviado ao Print Agent. NÃO altera preview/PDF: é
// um módulo puro, consumido pelo orquestrador `direct-print.ts`.
//
// Princípios:
//   - Escala default 100% (sem redimensionamento oculto).
//   - Conversões centralizadas (cm/mm/px/pt) — nada espalhado.
//   - Validações duras antes da impressão direta; PDF segue como fallback
//     APENAS para falhas operacionais, nunca para mascarar layout inválido.

import type { LayoutSnapshot } from "./direct-print";
import type { PrinterConfig } from "./types";

// ===== Conversões =====

/** 1 polegada = 25.4 mm (padrão ISO). */
export const MM_PER_INCH = 25.4;
/** 1 ponto PDF = 1/72 polegada. */
export const PT_PER_INCH = 72;

export type LengthUnit = "mm" | "cm" | "in" | "px" | "pt";

export function toMm(value: number, unit: LengthUnit | string, dpi?: number): number {
  switch (unit) {
    case "mm":
      return value;
    case "cm":
      return value * 10;
    case "in":
      return value * MM_PER_INCH;
    case "pt":
      return (value / PT_PER_INCH) * MM_PER_INCH;
    case "px": {
      if (!dpi || dpi <= 0) throw new Error("Conversão px→mm requer DPI > 0.");
      return (value / dpi) * MM_PER_INCH;
    }
    default:
      throw new Error(`Unidade desconhecida: ${unit}`);
  }
}

export function mmToCm(mm: number): number {
  return mm / 10;
}

export function mmToPx(mm: number, dpi: number): number {
  if (!dpi || dpi <= 0) throw new Error("Conversão mm→px requer DPI > 0.");
  return (mm / MM_PER_INCH) * dpi;
}

export function mmToPt(mm: number): number {
  return (mm / MM_PER_INCH) * PT_PER_INCH;
}

// ===== Formatos prioritários =====

export type StandardLabelType = "nutricional_10x10" | "nutricional_10x15" | "gondola_10x3";

export interface StandardFormat {
  key: StandardLabelType;
  width_mm: number;
  height_mm: number;
  tolerance_mm: number;
}

export const STANDARD_FORMATS: Record<StandardLabelType, StandardFormat> = {
  nutricional_10x10: { key: "nutricional_10x10", width_mm: 100, height_mm: 100, tolerance_mm: 1 },
  nutricional_10x15: { key: "nutricional_10x15", width_mm: 100, height_mm: 150, tolerance_mm: 1 },
  gondola_10x3: { key: "gondola_10x3", width_mm: 100, height_mm: 30, tolerance_mm: 1 },
};

export function detectStandardFormat(widthMm: number, heightMm: number): StandardLabelType | null {
  for (const f of Object.values(STANDARD_FORMATS)) {
    if (
      Math.abs(widthMm - f.width_mm) <= f.tolerance_mm &&
      Math.abs(heightMm - f.height_mm) <= f.tolerance_mm
    ) {
      return f.key;
    }
  }
  return null;
}

// ===== Geometria efetiva =====

export interface EffectiveGeometry {
  width_mm: number;
  height_mm: number;
  width_cm: number;
  height_cm: number;
  dpi: number;
  scale: number;
  rotation: 0 | 90 | 180 | 270;
  offset_x_mm: number;
  offset_y_mm: number;
  margins_mm: { top: number; right: number; bottom: number; left: number };
  printable_area_mm: { x: number; y: number; width: number; height: number };
  width_px: number;
  height_px: number;
  detected_format: StandardLabelType | null;
  unit_conversion_info: {
    source_unit: string;
    mm_per_inch: number;
    pt_per_inch: number;
  };
}

export interface ElementBoundsCheck {
  element_id: string;
  x_mm: number;
  y_mm: number;
  width_mm: number;
  height_mm: number;
  within_printable_area: boolean;
}

export interface LayoutValidationResult {
  ok: boolean;
  errors: string[];
  warnings: string[];
  geometry?: EffectiveGeometry;
  element_bounds?: ElementBoundsCheck[];
}

const ALLOWED_ROTATIONS = [0, 90, 180, 270] as const;

export function computeGeometry(
  layout: LayoutSnapshot,
  printer: PrinterConfig,
): EffectiveGeometry {
  const fmt = layout.format!;
  const unit = fmt.unit ?? "mm";
  const width_mm = toMm(fmt.width, unit);
  const height_mm = toMm(fmt.height, unit);
  const dpi = printer.dpi ?? 203;
  const scale = printer.scale ?? 100;

  const layoutMargins = {
    top: toMm(fmt.margin_top ?? 0, unit),
    right: toMm(fmt.margin_right ?? 0, unit),
    bottom: toMm(fmt.margin_bottom ?? 0, unit),
    left: toMm(fmt.margin_left ?? 0, unit),
  };
  const printerMargins = {
    top: printer.margin_top ?? 0,
    right: printer.margin_right ?? 0,
    bottom: printer.margin_bottom ?? 0,
    left: printer.margin_left ?? 0,
  };
  // Margens efetivas = max(layout, impressora) — segurança maior prevalece.
  const margins_mm = {
    top: Math.max(layoutMargins.top, printerMargins.top),
    right: Math.max(layoutMargins.right, printerMargins.right),
    bottom: Math.max(layoutMargins.bottom, printerMargins.bottom),
    left: Math.max(layoutMargins.left, printerMargins.left),
  };

  const printable_area_mm = {
    x: margins_mm.left,
    y: margins_mm.top,
    width: width_mm - margins_mm.left - margins_mm.right,
    height: height_mm - margins_mm.top - margins_mm.bottom,
  };

  const rotation = (printer.rotation ?? 0) as 0 | 90 | 180 | 270;

  return {
    width_mm,
    height_mm,
    width_cm: mmToCm(width_mm),
    height_cm: mmToCm(height_mm),
    dpi,
    scale,
    rotation,
    offset_x_mm: printer.offset_x ?? 0,
    offset_y_mm: printer.offset_y ?? 0,
    margins_mm,
    printable_area_mm,
    width_px: Math.round(mmToPx(width_mm, dpi)),
    height_px: Math.round(mmToPx(height_mm, dpi)),
    detected_format: detectStandardFormat(width_mm, height_mm),
    unit_conversion_info: { source_unit: unit, mm_per_inch: MM_PER_INCH, pt_per_inch: PT_PER_INCH },
  };
}

export function validateLayoutDimensions(
  layout: LayoutSnapshot,
  printer: PrinterConfig,
): LayoutValidationResult {
  const errors: string[] = [];
  const warnings: string[] = [];

  if (!layout) return { ok: false, errors: ["Layout ausente."], warnings };
  if (!layout.format) return { ok: false, errors: ["Layout sem formato (dimensões) definido."], warnings };
  const fmt = layout.format;
  if (!(fmt.width > 0 && fmt.height > 0)) {
    return { ok: false, errors: ["Dimensões do layout inválidas (largura/altura ≤ 0)."], warnings };
  }
  if (!layout.elements || layout.elements.length === 0) {
    errors.push("Layout sem elementos cadastrados.");
  }

  const geometry = computeGeometry(layout, printer);

  if (geometry.printable_area_mm.width <= 0 || geometry.printable_area_mm.height <= 0) {
    errors.push("Margens reduziram a área útil a zero ou valor inválido.");
  }

  if (!Number.isFinite(geometry.dpi) || geometry.dpi <= 0) {
    errors.push("DPI inválido para impressão direta.");
  }
  if (!Number.isFinite(geometry.scale) || geometry.scale < 10 || geometry.scale > 400) {
    errors.push("Escala fora do intervalo permitido (10–400%).");
  }
  if (geometry.scale !== 100) {
    warnings.push(`Escala diferente de 100% (${geometry.scale}%) — será aplicada explicitamente.`);
  }
  if (!(ALLOWED_ROTATIONS as readonly number[]).includes(geometry.rotation)) {
    errors.push("Rotação inválida (use 0, 90, 180 ou 270).");
  }

  // Limites de largura/altura da impressora
  if (printer.max_width && geometry.width_mm > printer.max_width) {
    errors.push(`Largura do layout (${geometry.width_mm}mm) excede a impressora (${printer.max_width}mm).`);
  }
  if (printer.max_height && geometry.height_mm > printer.max_height) {
    errors.push(`Altura do layout (${geometry.height_mm}mm) excede a impressora (${printer.max_height}mm).`);
  }

  // Validação por elemento
  const unit = fmt.unit ?? "mm";
  const element_bounds: ElementBoundsCheck[] = (layout.elements ?? []).map((e) => {
    const x_mm = toMm(e.x ?? 0, unit);
    const y_mm = toMm(e.y ?? 0, unit);
    const w_mm = toMm(e.width ?? 0, unit);
    const h_mm = toMm(e.height ?? 0, unit);
    const pa = geometry.printable_area_mm;
    const within =
      x_mm >= pa.x - 0.01 &&
      y_mm >= pa.y - 0.01 &&
      x_mm + w_mm <= pa.x + pa.width + 0.01 &&
      y_mm + h_mm <= pa.y + pa.height + 0.01;
    return { element_id: e.id, x_mm, y_mm, width_mm: w_mm, height_mm: h_mm, within_printable_area: within };
  });
  const outside = element_bounds.filter((b) => !b.within_printable_area);
  if (outside.length > 0) {
    errors.push(`Layout possui ${outside.length} elemento(s) fora da área útil.`);
  }

  // Aviso de tipo divergente
  const lt = layout.label_type ?? "";
  const std = geometry.detected_format;
  if (lt && std) {
    const expectShelf = lt.includes("gondola") || lt.includes("gôndola");
    const isShelfFmt = std === "gondola_10x3";
    if (expectShelf !== isShelfFmt) {
      warnings.push(`Tipo do layout ("${lt}") difere do formato físico detectado (${std}).`);
    }
  }

  return { ok: errors.length === 0, errors, warnings, geometry, element_bounds };
}

// ===== Payload dimensional =====

export interface DimensionalPayload {
  width_mm: number;
  height_mm: number;
  width_cm: number;
  height_cm: number;
  width_px: number;
  height_px: number;
  dpi: number;
  scale: number;
  rotation: number;
  offset_x: number;
  offset_y: number;
  margins: { top: number; right: number; bottom: number; left: number };
  printable_area: { x: number; y: number; width: number; height: number };
  layout_type: string | null;
  detected_format: StandardLabelType | null;
  element_bounds: ElementBoundsCheck[];
  raw_language: string;
  unit_conversion_info: EffectiveGeometry["unit_conversion_info"];
}

export function buildDimensionalPayload(
  layout: LayoutSnapshot,
  printer: PrinterConfig,
  validation?: LayoutValidationResult,
): DimensionalPayload {
  const v = validation ?? validateLayoutDimensions(layout, printer);
  const g = v.geometry ?? computeGeometry(layout, printer);
  return {
    width_mm: g.width_mm,
    height_mm: g.height_mm,
    width_cm: g.width_cm,
    height_cm: g.height_cm,
    width_px: g.width_px,
    height_px: g.height_px,
    dpi: g.dpi,
    scale: g.scale,
    rotation: g.rotation,
    offset_x: g.offset_x_mm,
    offset_y: g.offset_y_mm,
    margins: g.margins_mm,
    printable_area: g.printable_area_mm,
    layout_type: layout.label_type ?? null,
    detected_format: g.detected_format,
    element_bounds: v.element_bounds ?? [],
    raw_language: (printer.raw_language ?? "driver") as string,
    unit_conversion_info: g.unit_conversion_info,
  };
}
