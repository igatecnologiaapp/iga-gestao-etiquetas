import type { AdapterContext, AdapterOutput, PrintDriver } from "./types";
import { buildTextLinesFromElements, sanitizeRawText } from "./raw-commands";

export const EscposDriver: PrintDriver = {
  language: "ESCPOS",
  maturity: "fallback",
  validate(_ctx) {
    return [];
  },
  render(ctx: AdapterContext): AdapterOutput {
    const title = sanitizeRawText(ctx.jobName ?? ctx.label.product_name ?? "Etiqueta", 80);
    const body = buildTextLinesFromElements(ctx)
      .filter((item) => item.text && item.type !== "box" && item.type !== "line")
      .map((item) => item.text)
      .slice(0, 18);
    const lines = [title, "", ...body];
    return {
      language: "ESCPOS",
      kind: "raw",
      raw: `\x1b@${lines.join("\r\n")}\r\n\x1dV\x00`,
      dimensional: ctx.dimensional,
      warnings: ["ESC/POS é indicado para impressoras de cupom/texto; layouts de etiqueta podem perder posicionamento."],
      maturity: "fallback",
      manufacturer: ctx.printer.manufacturer ?? null,
      model: ctx.printer.model ?? null,
    };
  },
};
