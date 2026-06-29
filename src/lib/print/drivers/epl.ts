// FASE 13 — Adapter EPL (Zebra/Eltron legado). Maturity: "prepared".

import type { AdapterContext, AdapterOutput, PrintDriver } from "./types";
import { buildTextLinesFromElements, quotedText } from "./raw-commands";

export function buildEplPreview(ctx: AdapterContext): string {
  const d = ctx.dimensional;
  const dpmm = d.dpi / 25.4;
  const lines: string[] = [];
  lines.push("N"); // limpa buffer
  lines.push(`q${Math.round(d.width_mm * dpmm)}`);
  lines.push(`Q${Math.round(d.height_mm * dpmm)},24`);
  for (const item of buildTextLinesFromElements(ctx)) {
    const x = Math.round(item.x * dpmm);
    const y = Math.round(item.y * dpmm);
    const x2 = Math.round((item.x + item.w) * dpmm);
    const y2 = Math.round((item.y + item.h) * dpmm);
    if (item.type === "box" || item.type === "line") {
      lines.push(`X${x},${y},1,${x2},${y2}`);
    } else if (item.type === "barcode") {
      lines.push(`B${x},${y},0,1,2,4,${Math.max(40, Math.round(item.h * dpmm))},B,"${quotedText(item.text)}"`);
    } else {
      lines.push(`A${x},${y},0,3,1,1,N,"${quotedText(item.text)}"`);
    }
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
