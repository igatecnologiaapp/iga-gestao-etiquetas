// FASE 2 (item 2.1) — alias do driver do SO com rótulo "GDI".
// Windows GDI/texto compartilha a mesma renderização passthrough do
// DefaultDriver; a diferença é apenas semântica (linguagem declarada pela
// impressora) e o aviso operacional exibido nos payloads.

import { createOsPassthroughDriver } from "./os-passthrough";

export const GdiDriver = createOsPassthroughDriver({
  language: "GDI",
  maturity: "fallback",
  warnings: [
    "Windows GDI/texto usa o driver do Windows e pode não preservar posicionamento térmico avançado.",
  ],
});
