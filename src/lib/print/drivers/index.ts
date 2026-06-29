// FASE 13 — Registry e seleção de adapters por linguagem/fabricante.
//
// Fluxo de seleção:
//   1. Se printer.raw_language === "driver" → DefaultDriver.
//   2. Se raw_language ∈ registry → adapter correspondente.
//   3. Se raw_language não suportado mas fabricante mapeia → adapter sugerido.
//   4. Fallback final → DefaultDriver com aviso.

import { ROTATION_VALUES } from "../printer-config-validation";
import type { PrinterConfig } from "../types";
import { DefaultDriver } from "./driver-default";
import { EplDriver } from "./epl";
import { EscposDriver } from "./escpos";
import { GdiDriver } from "./gdi";
import { PplbDriver } from "./pplb";
import { TsplDriver } from "./tspl";
import { ZplDriver } from "./zpl";
import type {
  AdapterContext,
  AdapterOutput,
  DriverLanguage,
  PrintDriver,
} from "./types";

export const DRIVER_REGISTRY: Record<string, PrintDriver> = {
  driver: DefaultDriver,
  ZPL: ZplDriver,
  EPL: EplDriver,
  PPLA: PplbDriver,
  PPLB: PplbDriver,
  TSPL: TsplDriver,
  ESCPOS: EscposDriver,
  GDI: GdiDriver,
};

/** Maturidade declarada de cada linguagem — usada na documentação/UI. */
export const DRIVER_MATURITY: Record<DriverLanguage, "stable" | "prepared" | "fallback"> = {
  driver: "stable",
  ZPL: "prepared",
  EPL: "prepared",
  PPLA: "prepared",
  PPLB: "prepared",
  TSPL: "prepared",
  ESCPOS: "fallback",
  GDI: "fallback",
  DPL: "fallback",
  PCL: "fallback",
  ESCP: "fallback",
};

const MANUFACTURER_LANGUAGE: Array<{ match: RegExp; language: DriverLanguage }> = [
  { match: /zebra/i, language: "ZPL" },
  { match: /argox/i, language: "PPLB" },
  { match: /tsc/i, language: "TSPL" },
  { match: /elgin/i, language: "TSPL" },
  { match: /datamax/i, language: "DPL" },
  { match: /brother/i, language: "driver" },
  { match: /epson/i, language: "driver" },
];

export function suggestLanguageForManufacturer(manufacturer: string | null | undefined): DriverLanguage | null {
  if (!manufacturer) return null;
  const m = MANUFACTURER_LANGUAGE.find((r) => r.match.test(manufacturer));
  return m ? m.language : null;
}

export interface AdapterSelection {
  driver: PrintDriver;
  requested: DriverLanguage;
  effective: DriverLanguage;
  fallbackUsed: boolean;
  reason?: string;
}

export function selectAdapter(printer: PrinterConfig): AdapterSelection {
  const requested = ((printer.raw_language ?? "driver") as DriverLanguage) || "driver";
  const direct = DRIVER_REGISTRY[requested];
  if (direct) {
    return { driver: direct, requested, effective: requested, fallbackUsed: false };
  }
  // linguagem reconhecida mas ainda não funcional → fallback
  const suggestion = suggestLanguageForManufacturer(printer.manufacturer);
  if (suggestion && DRIVER_REGISTRY[suggestion]) {
    return {
      driver: DRIVER_REGISTRY[suggestion],
      requested,
      effective: suggestion,
      fallbackUsed: true,
      reason: `Linguagem "${requested}" sem adapter funcional. Usando "${suggestion}" sugerido por fabricante.`,
    };
  }
  return {
    driver: DefaultDriver,
    requested,
    effective: "driver",
    fallbackUsed: true,
    reason: `Linguagem "${requested}" sem adapter. Usando driver padrão do SO.`,
  };
}

/** Validações cruzadas adapter × layout × impressora. */
export function validateAdapterContext(driver: PrintDriver, ctx: AdapterContext): string[] {
  const errs: string[] = [];
  const d = ctx.dimensional;
  if (!d) {
    errs.push("Payload dimensional ausente.");
    return errs;
  }
  if (d.width_mm <= 0 || d.height_mm <= 0) errs.push("Dimensões do layout inválidas.");
  if (!d.dpi || d.dpi <= 0) errs.push("DPI inválido.");
  if (!(ROTATION_VALUES as readonly number[]).includes(d.rotation)) {
    errs.push("Rotação não suportada (use 0, 90, 180, 270).");
  }
  if (!d.element_bounds || d.element_bounds.length === 0) {
    errs.push("Layout sem elementos para renderizar.");
  }
  errs.push(...driver.validate(ctx));
  return errs;
}

export function renderWithAdapter(printer: PrinterConfig, ctx: AdapterContext): {
  selection: AdapterSelection;
  output: AdapterOutput;
  errors: string[];
} {
  const selection = selectAdapter(printer);
  const errors = validateAdapterContext(selection.driver, ctx);
  if (errors.length > 0) {
    return {
      selection,
      errors,
      output: {
        language: selection.effective,
        kind: "dimensional",
        dimensional: ctx.dimensional,
        warnings: [],
        maturity: selection.driver.maturity,
      },
    };
  }
  const output = selection.driver.render(ctx);
  if (selection.fallbackUsed && selection.reason) {
    output.warnings = [...output.warnings, selection.reason];
  }
  return { selection, output, errors: [] };
}

export type { AdapterContext, AdapterOutput, PrintDriver, DriverLanguage } from "./types";
export { DefaultDriver, ZplDriver, EplDriver, PplbDriver, TsplDriver, EscposDriver, GdiDriver };
