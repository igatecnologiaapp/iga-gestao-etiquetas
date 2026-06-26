// FASE 13 — Driver padrão (sistema operacional).
// Saída dimensional já produzida pelo Layout Engine — o Print Agent repassa
// ao driver nativo instalado no SO. Sempre disponível como fallback final.

import type { AdapterContext, AdapterOutput, PrintDriver } from "./types";

export const DefaultDriver: PrintDriver = {
  language: "driver",
  maturity: "stable",
  validate(_ctx) {
    return [];
  },
  render(ctx: AdapterContext): AdapterOutput {
    return {
      language: "driver",
      kind: "dimensional",
      dimensional: ctx.dimensional,
      warnings: [],
      maturity: "stable",
      manufacturer: ctx.printer.manufacturer ?? null,
      model: ctx.printer.model ?? null,
    };
  },
};
