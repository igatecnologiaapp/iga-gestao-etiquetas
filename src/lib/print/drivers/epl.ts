// FASE 13 — Adapter EPL (Zebra/Eltron legado). Maturity: "prepared".

import type { AdapterContext, AdapterOutput, PrintDriver } from "./types";

export function buildEplPreview(ctx: AdapterContext): string {
  const d = ctx.dimensional;
  const dpmm = d.dpi / 25.4;
  const lines: string[] = [];
  lines.push("N"); // limpa buffer
  lines.push(`q${Math.round(d.width_mm * dpmm)}`);
  lines.push(`Q${Math.round(d.height_mm * dpmm)},24`);
  for (const el of d.element_bounds) {
    lines.push(
      `X${Math.round(el.x_mm * dpmm)},${Math.round(el.y_mm * dpmm)},1,${Math.round((el.x_mm + el.width_mm) * dpmm)},${Math.round((el.y_mm + el.height_mm) * dpmm)}`,
    );
  }
  lines.push(`P${Math.max(1, ctx.copies)}`);
  return lines.join("\n");
}

export const EplDriver: PrintDriver = {
  language: "EPL",
  maturity: "prepared",
  validate(ctx) {
    return ctx.dimensional.dpi > 0 ? [] : ["EPL requer DPI > 0."];
  },
  render(ctx) {
    return {
      language: "EPL",
      kind: "raw",
      raw: buildEplPreview(ctx),
      warnings: ["Adapter EPL preparado: emite estrutura básica."],
      maturity: "prepared",
      manufacturer: ctx.printer.manufacturer ?? "Zebra/Eltron",
      model: ctx.printer.model ?? null,
    } satisfies AdapterOutput;
  },
};
