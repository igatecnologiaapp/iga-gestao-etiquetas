// FASE 13 — Adapter ZPL (Zebra).
// Maturity: "prepared" — gera um esqueleto ZPL válido com cabeçalho, geometria
// e placeholders por elemento. Não emite comandos avançados (fontes embutidas,
// gráficos de bitmap) — esses ficam para fases seguintes. O Print Agent pode
// optar por enviar o "raw" diretamente OU cair para fallback dimensional.

import type { DimensionalPayload } from "../layout-engine";
import type { AdapterContext, AdapterOutput, PrintDriver } from "./types";

function dotsPerMm(dim: DimensionalPayload): number {
  return dim.dpi / 25.4;
}

function asInt(v: number): number {
  return Math.max(0, Math.round(v));
}

export function buildZplPreview(ctx: AdapterContext): string {
  const d = ctx.dimensional;
  const dpmm = dotsPerMm(d);
  const widthDots = asInt(d.width_mm * dpmm);
  const heightDots = asInt(d.height_mm * dpmm);
  const lines: string[] = [];
  lines.push("CT~~CD,~CC^~CT~");
  lines.push(`^XA`);
  lines.push(`^PW${widthDots}`);
  lines.push(`^LL${heightDots}`);
  lines.push(`^LH${asInt(d.printable_area.x * dpmm)},${asInt(d.printable_area.y * dpmm)}`);
  if (d.rotation && [90, 180, 270].includes(d.rotation)) {
    lines.push(`^PO${d.rotation === 90 ? "I" : d.rotation === 180 ? "R" : "B"}`);
  }
  for (const el of d.element_bounds) {
    lines.push(
      `^FO${asInt(el.x_mm * dpmm)},${asInt(el.y_mm * dpmm)}^GB${asInt(el.width_mm * dpmm)},${asInt(el.height_mm * dpmm)},1^FS`,
    );
  }
  lines.push(`^PQ${Math.max(1, ctx.copies)}`);
  lines.push(`^XZ`);
  return lines.join("\n");
}

export const ZplDriver: PrintDriver = {
  language: "ZPL",
  maturity: "prepared",
  validate(ctx) {
    const errs: string[] = [];
    if (!ctx.dimensional.dpi || ctx.dimensional.dpi <= 0) errs.push("ZPL requer DPI > 0.");
    return errs;
  },
  render(ctx) {
    const raw = buildZplPreview(ctx);
    return {
      language: "ZPL",
      kind: "raw",
      raw,
      warnings: [
        "Adapter ZPL preparado: emite estrutura básica. Comandos avançados (fontes, bitmaps) ainda não são gerados.",
      ],
      maturity: "prepared",
      manufacturer: ctx.printer.manufacturer ?? "Zebra",
      model: ctx.printer.model ?? null,
    } satisfies AdapterOutput;
  },
};
