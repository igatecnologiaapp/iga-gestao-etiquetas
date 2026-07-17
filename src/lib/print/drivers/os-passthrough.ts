// FASE 2 (item 2.1) — implementação compartilhada entre DefaultDriver
// (linguagem "driver") e GdiDriver (linguagem "GDI"). Ambos produzem a mesma
// saída raw dimensional (texto puro delegado ao driver do SO); a única
// diferença é o rótulo de linguagem, a maturidade e o aviso apresentado.
//
// Preserva o contrato público: DefaultDriver e GdiDriver continuam exportados
// e registrados no DRIVER_REGISTRY sob suas chaves originais ("driver"/"GDI"),
// mantendo compatibilidade com impressoras já cadastradas.

import type { AdapterContext, AdapterOutput, DriverLanguage, PrintDriver } from "./types";
import { buildPlainTextRaw } from "./raw-commands";

export interface OsDriverOptions {
  language: DriverLanguage;
  maturity: "stable" | "prepared" | "fallback";
  warnings?: string[];
}

/**
 * Constrói um driver que delega a renderização ao driver do sistema
 * operacional (fluxo dimensional + texto puro). Usado por DefaultDriver
 * ("driver" — sempre disponível) e GdiDriver ("GDI" — Windows Spooler).
 */
export function createOsPassthroughDriver(opts: OsDriverOptions): PrintDriver {
  const warnings = opts.warnings ?? [];
  return {
    language: opts.language,
    maturity: opts.maturity,
    validate(_ctx) {
      return [];
    },
    render(ctx: AdapterContext): AdapterOutput {
      return {
        language: opts.language,
        kind: "raw",
        raw: buildPlainTextRaw(ctx),
        dimensional: ctx.dimensional,
        warnings: [...warnings],
        maturity: opts.maturity,
        manufacturer: ctx.printer.manufacturer ?? null,
        model: ctx.printer.model ?? null,
      };
    },
  };
}
