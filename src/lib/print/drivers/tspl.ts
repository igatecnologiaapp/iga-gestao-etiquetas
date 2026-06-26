// FASE 13 — Adapter TSPL (TSC / Elgin). Maturity: "prepared".

import type { AdapterContext, AdapterOutput, PrintDriver } from "./types";

export function buildTsplPreview(ctx: AdapterContext): string {
  const d = ctx.dimensional;
  const lines: string[] = [];
  lines.push(`SIZE ${d.width_mm} mm, ${d.height_mm} mm`);
  lines.push("GAP 2 mm, 0 mm");
  lines.push("DIRECTION 1");
  lines.push("CLS");
  const dpmm = d.dpi / 25.4;
  for (const el of d.element_bounds) {
    lines.push(
      `BOX ${Math.round(el.x_mm * dpmm)},${Math.round(el.y_mm * dpmm)},${Math.round((el.x_mm + el.width_mm) * dpmm)},${Math.round((el.y_mm + el.height_mm) * dpmm)},2`,
    );
  }
  lines.push(`PRINT ${Math.max(1, ctx.copies)},1`);
  return lines.join("\n");
}

export const TsplDriver: PrintDriver = {
  language: "TSPL",
  maturity: "prepared",
  validate(ctx) {
    return ctx.dimensional.dpi > 0 ? [] : ["TSPL requer DPI > 0."];
  },
  render(ctx) {
    return {
      language: "TSPL",
      kind: "raw",
      raw: buildTsplPreview(ctx),
      warnings: ["Adapter TSPL preparado: emite estrutura básica."],
      maturity: "prepared",
      manufacturer: ctx.printer.manufacturer ?? "TSC",
      model: ctx.printer.model ?? null,
    } satisfies AdapterOutput;
  },
};
