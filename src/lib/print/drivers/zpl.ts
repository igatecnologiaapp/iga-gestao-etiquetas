// FASE 13 — Adapter ZPL (Zebra).
// Maturity: "prepared" — gera um esqueleto ZPL válido com cabeçalho, geometria
// e placeholders por elemento. Não emite comandos avançados (fontes embutidas,
// gráficos de bitmap) — esses ficam para fases seguintes. O Print Agent pode
// optar por enviar o "raw" diretamente OU cair para fallback dimensional.

import type { DimensionalPayload } from "../layout-engine";
import type { AdapterContext, AdapterOutput, PrintDriver } from "./types";
import { buildTextLinesFromElements, zplText } from "./raw-commands";

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
  for (const item of buildTextLinesFromElements(ctx)) {
    const x = asInt(item.x * dpmm);
    const y = asInt(item.y * dpmm);
    const w = asInt(Math.max(item.w, 2) * dpmm);
    const h = asInt(Math.max(item.h, 2) * dpmm);
    if (item.type === "box" || item.type === "line") {
      lines.push(`^FO${x},${y}^GB${w},${Math.max(1, h)},1^FS`);
    } else if (item.type === "barcode") {
      lines.push(`^FO${x},${y}^BY2,2,${Math.max(40, h)}^BCN,${Math.max(40, h)},Y,N,N^FD${zplText(item.text)}^FS`);
    } else if (item.type === "qrcode") {
      lines.push(`^FO${x},${y}^BQN,2,4^FDLA,${zplText(item.text)}^FS`);
    } else {
      const fontDots = asInt(Math.max(12, item.font * dpmm * 0.9));
      lines.push(`^FO${x},${y}^A0N,${fontDots},${fontDots}^FB${Math.max(40, w)},3,2,L,0^FD${zplText(item.text)}^FS`);
    }
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
