// FASE 5 — Fábrica do PrintAgentClient.
// Centraliza a criação do client para a UI, permitindo alternar entre o
// agente real (default http://127.0.0.1:17777) e o mock controlado descrito
// em src/lib/print/print-agent-client.ts.
//
// Não altera contratos das fases anteriores.

import {
  PrintAgentClient,
  createMockPrintAgent,
  type MockAgentOptions,
} from "./print-agent-client";

export interface AgentFactoryOptions {
  companyId?: string | null;
  token?: string | null;
  useMock?: boolean;
  mock?: MockAgentOptions;
}

export function buildPrintAgent(opts: AgentFactoryOptions = {}): PrintAgentClient {
  if (opts.useMock) {
    return createMockPrintAgent(opts.mock ?? { online: true });
  }
  return new PrintAgentClient({
    companyId: opts.companyId ?? null,
    token: opts.token ?? null,
  });
}
