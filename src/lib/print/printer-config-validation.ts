// FASE 6 — Validações de configurações técnicas de impressora.
// Espelham as CHECK constraints do banco para feedback imediato no front.

export type RawLanguage = "driver" | "ZPL" | "EPL" | "PPLA" | "PPLB" | "TSPL" | "ESCPOS" | "GDI";
export const RAW_LANGUAGES: RawLanguage[] = ["driver", "ZPL", "EPL", "PPLA", "PPLB", "TSPL", "ESCPOS", "GDI"];
export const ROTATION_VALUES = [0, 90, 180, 270] as const;

export interface PrinterTechnicalConfig {
  dpi: number | null;
  speed: number | null;
  scale: number;
  margin_top: number;
  margin_right: number;
  margin_bottom: number;
  margin_left: number;
  rotation: number;
  auto_cut: boolean;
  label_advance: number | null;
  offset_x: number;
  offset_y: number;
  raw_language: RawLanguage | null;
}

export function validateTechnicalConfig(cfg: Partial<PrinterTechnicalConfig>): string[] {
  const errs: string[] = [];
  if (cfg.dpi != null && (cfg.dpi <= 0 || cfg.dpi > 2400)) errs.push("DPI deve estar entre 1 e 2400.");
  if (cfg.speed != null && (cfg.speed < 0 || cfg.speed > 600)) errs.push("Velocidade deve estar entre 0 e 600.");
  if (cfg.scale != null && (cfg.scale < 10 || cfg.scale > 400)) errs.push("Escala deve estar entre 10% e 400%.");
  for (const k of ["margin_top", "margin_right", "margin_bottom", "margin_left"] as const) {
    const v = cfg[k];
    if (v != null && (v < 0 || v > 200)) errs.push(`Margem ${k.replace("margin_", "")} deve estar entre 0 e 200 mm.`);
  }
  if (cfg.offset_x != null && (cfg.offset_x < -200 || cfg.offset_x > 200)) errs.push("Offset horizontal deve estar entre -200 e 200.");
  if (cfg.offset_y != null && (cfg.offset_y < -200 || cfg.offset_y > 200)) errs.push("Offset vertical deve estar entre -200 e 200.");
  if (cfg.rotation != null && !ROTATION_VALUES.includes(cfg.rotation as any))
    errs.push("Rotação deve ser 0, 90, 180 ou 270.");
  if (cfg.label_advance != null && (cfg.label_advance < 0 || cfg.label_advance > 200))
    errs.push("Avanço da etiqueta deve estar entre 0 e 200 mm.");
  if (cfg.raw_language && !RAW_LANGUAGES.includes(cfg.raw_language))
    errs.push("Linguagem bruta inválida.");
  return errs;
}
