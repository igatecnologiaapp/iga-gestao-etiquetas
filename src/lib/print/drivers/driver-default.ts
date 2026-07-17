// FASE 13 — Driver padrão (sistema operacional).
// FASE 2 (item 2.1) — implementação compartilhada em os-passthrough.ts.
//
// Saída dimensional já produzida pelo Layout Engine — o Print Agent repassa
// ao driver nativo instalado no SO. Sempre disponível como fallback final.

import { createOsPassthroughDriver } from "./os-passthrough";

export const DefaultDriver = createOsPassthroughDriver({
  language: "driver",
  maturity: "stable",
});
