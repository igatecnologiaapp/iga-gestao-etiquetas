// FASE 13 — Adapter TSPL (TSC / Elgin). Maturity: "prepared".

import type { AdapterContext, AdapterOutput, PrintDriver } from "./types";
import { buildTextLinesFromElements, quotedText } from "./raw-commands";

export function buildTsplPreview(ctx: AdapterContext): string {
  const d = ctx.dimensional;
  const lines: string[] = [];
  lines.push(`SIZE ${d.width_mm} mm, ${d.height_mm} mm`);
  lines.push("GAP 2 mm, 0 mm");
  lines.push("DIRECTION 1");
  lines.push("CLS");
  const dpmm = d.dpi / 25.4;
  for (const item of buildTextLinesFromElements(ctx)) {
    const x = Math.round(item.x * dpmm);
    const y = Math.round(item.y * dpmm);
    const x2 = Math.round((item.x + item.w) * dpmm);
    const y2 = Math.round((item.y + item.h) * dpmm);
    if (item.type === "box" || item.type === "line") {
      lines.push(`BOX ${x},${y},${x2},${y2},2`);
    } else if (item.type === "barcode") {
      lines.push(`BARCODE ${x},${y},"128",${Math.max(40, y2 - y)},1,0,2,2,"${quotedText(item.text)}"`);
    } else if (item.type === "qrcode") {
      lines.push(`QRCODE ${x},${y},L,4,A,0,"${quotedText(item.text)}"`);
    } else {
      lines.push(`TEXT ${x},${y},"3",0,1,1,"${quotedText(item.text)}"`);
    }
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
