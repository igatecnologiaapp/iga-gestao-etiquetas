// FASE 13 — Tipos da camada de drivers/adapters de impressão.
//
// Cada adapter recebe o payload dimensional já normalizado pelo Layout Engine
// (FASE 8) + a config técnica da impressora, e produz a saída adequada para o
// Print Agent. NÃO altera PDF, preview, layouts cadastrados ou fila.

import type { DimensionalPayload } from "../layout-engine";
import type { PrinterConfig } from "../types";

export type DriverLanguage =
  | "driver" // driver nativo do SO (default — saída dimensional/estruturada)
  | "ZPL"   // Zebra
  | "EPL"   // Zebra/Eltron legado
  | "PPLB"  // Argox
  | "TSPL"  // TSC, Elgin (linha térmica)
  | "DPL"   // Datamax (preparado, ainda não funcional)
  | "PCL"   // laser/inkjet de uso geral (preparado, ainda não funcional)
  | "ESCP"; // Epson matricial (preparado, ainda não funcional)

/** Status de maturidade de cada adapter — exibido na documentação e no log. */
export type DriverMaturity = "stable" | "prepared" | "fallback";

export type AdapterOutputKind = "raw" | "dimensional" | "pdf-passthrough";

export interface AdapterContext {
  printer: PrinterConfig;
  dimensional: DimensionalPayload;
  label: Record<string, unknown>;
  copies: number;
  jobName?: string;
}

export interface AdapterOutput {
  /** Linguagem efetivamente usada (após fallback). */
  language: DriverLanguage;
  /** Tipo de saída produzido. */
  kind: AdapterOutputKind;
  /** Conteúdo bruto (ZPL/EPL/…) — preenchido quando kind = 'raw'. */
  raw?: string;
  /** Payload dimensional repassado ao driver nativo do SO. */
  dimensional?: DimensionalPayload;
  /** Avisos não-fatais. */
  warnings: string[];
  /** Status do adapter usado. */
  maturity: DriverMaturity;
  /** Fabricante/modelo detectado, quando aplicável. */
  manufacturer?: string | null;
  model?: string | null;
}

export interface PrintDriver {
  readonly language: DriverLanguage;
  readonly maturity: DriverMaturity;
  /** Curtas verificações específicas do adapter — geometria/DPI/rotação… */
  validate(ctx: AdapterContext): string[];
  /** Gera a saída do adapter. */
  render(ctx: AdapterContext): AdapterOutput;
}
