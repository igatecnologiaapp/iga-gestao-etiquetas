// FASE 13 — Adapter PPLB (Argox). Maturity: "prepared".

import type { AdapterContext, AdapterOutput, PrintDriver } from "./types";

export function buildPplbPreview(ctx: AdapterContext): string {
  const d = ctx.dimensional;
  const dpmm = d.dpi / 25.4;
  const lines: string[] = [];
  lines.push(`Q${Math.round(d.height_mm * dpmm)},24`);
  lines.push(`q${Math.round(d.width_mm * dpmm)}`);
  lines.push("N");
  for (const el of d.element_bounds) {
    lines.push(
      `LO${Math.round(el.x_mm * dpmm)},${Math.round(el.y_mm * dpmm)},${Math.round(el.width_mm * dpmm)},${Math.round(el.height_mm * dpmm)}`,
    );
  }
  lines.push(`P${Math.max(1, ctx.copies)}`);
  return lines.join("\n");
}

export const PplbDriver: PrintDriver = {
  language: "PPLB",
  maturity: "prepared",
  validate(ctx) {
    return ctx.dimensional.dpi > 0 ? [] : ["PPLB requer DPI > 0."];
  },
  render(ctx) {
    return {
      language: "PPLB",
      kind: "raw",
      raw: buildPplbPreview(ctx),
      warnings: ["Adapter PPLB preparado: emite estrutura básica."],
      maturity: "prepared",
      manufacturer: ctx.printer.manufacturer ?? "Argox",
      model: ctx.printer.model ?? null,
    } satisfies AdapterOutput;
  },
};
