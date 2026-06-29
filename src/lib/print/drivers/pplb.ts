// FASE 13 — Adapter PPLB (Argox). Maturity: "prepared".

import type { AdapterContext, AdapterOutput, PrintDriver } from "./types";
import { buildTextLinesFromElements, quotedText } from "./raw-commands";

export function buildPplbPreview(ctx: AdapterContext): string {
  const d = ctx.dimensional;
  const dpmm = d.dpi / 25.4;
  const lines: string[] = [];
  lines.push(`Q${Math.round(d.height_mm * dpmm)},24`);
  lines.push(`q${Math.round(d.width_mm * dpmm)}`);
  lines.push("N");
  for (const item of buildTextLinesFromElements(ctx)) {
    const x = Math.round(item.x * dpmm);
    const y = Math.round(item.y * dpmm);
    const w = Math.round(Math.max(item.w, 1) * dpmm);
    const h = Math.round(Math.max(item.h, 1) * dpmm);
    if (item.type === "box" || item.type === "line") {
      lines.push(`LO${x},${y},${w},${h}`);
    } else if (item.type === "barcode") {
      lines.push(`B${x},${y},0,1,2,4,${Math.max(40, h)},B,"${quotedText(item.text)}"`);
    } else {
      lines.push(`A${x},${y},0,3,1,1,N,"${quotedText(item.text)}"`);
    }
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
