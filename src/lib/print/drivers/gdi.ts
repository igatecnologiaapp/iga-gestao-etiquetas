import type { AdapterContext, AdapterOutput, PrintDriver } from "./types";
import { buildPlainTextRaw } from "./raw-commands";

export const GdiDriver: PrintDriver = {
  language: "GDI",
  maturity: "fallback",
  validate(_ctx) {
    return [];
  },
  render(ctx: AdapterContext): AdapterOutput {
    return {
      language: "GDI",
      kind: "raw",
      raw: buildPlainTextRaw(ctx),
      dimensional: ctx.dimensional,
      warnings: ["Windows GDI/texto usa o driver do Windows e pode não preservar posicionamento térmico avançado."],
      maturity: "fallback",
      manufacturer: ctx.printer.manufacturer ?? null,
      model: ctx.printer.model ?? null,
    };
  },
};
