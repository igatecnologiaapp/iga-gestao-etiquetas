// FASE 5 — Testes do fluxo de gerenciamento de impressoras via PrintAgentClient.
// Cobertura: agente online (listagem, teste de conexão, página de teste),
// agente offline (PrintAgentOfflineError sem quebrar telas) e erro padronizado
// vindo do agente. Não exercita a UI (React); valida o contrato consumido por ela.

import { describe, it, expect } from "vitest";
import { buildPrintAgent } from "./agent-factory";
import {
  createMockPrintAgent,
  PrintAgentError,
  PrintAgentOfflineError,
} from "./print-agent-client";

describe("FASE 5 — fluxo de gerenciamento de impressoras", () => {
  it("buildPrintAgent(useMock) produz client funcional", async () => {
    const agent = buildPrintAgent({ useMock: true });
    expect((await agent.health()).ok).toBe(true);
  });

  it("agente online: lista impressoras detectadas", async () => {
    const agent = createMockPrintAgent({
      online: true,
      printers: [
        { id: "ZD220-001", name: "Zebra ZD220", driver: "ZPL", default: true, status: "online" },
        { id: "TSC-TE200", name: "TSC TE200", driver: "TSPL", default: false, status: "online" },
      ],
    });
    const list = await agent.listPrinters();
    expect(list.map((p) => p.id)).toEqual(["ZD220-001", "TSC-TE200"]);
  });

  it("agente online: testar conexão e imprimir página de teste", async () => {
    const agent = createMockPrintAgent({ online: true });
    expect((await agent.testPrinter("MOCK-001")).ok).toBe(true);
    const job = await agent.printTestPage("MOCK-001");
    expect(job.jobId).toMatch(/^mock-test-/);
    const status = await agent.getJob(job.jobId);
    expect(status.status).toBe("completed");
  });

  it("agente offline: health não lança e listPrinters lança PrintAgentOfflineError", async () => {
    const agent = createMockPrintAgent({ online: false });
    const h = await agent.health();
    expect(h.ok).toBe(false);
    expect(h.code).toBe("AGENT_OFFLINE");
    await expect(agent.listPrinters()).rejects.toBeInstanceOf(PrintAgentOfflineError);
  });

  it("erro padronizado: token inválido vira PrintAgentError com code", async () => {
    const agent = createMockPrintAgent({ invalidToken: true });
    try {
      await agent.testPrinter("MOCK-001");
      throw new Error("deveria ter lançado");
    } catch (e) {
      expect(e).toBeInstanceOf(PrintAgentError);
      expect((e as PrintAgentError).code).toBe("INVALID_TOKEN");
      expect((e as PrintAgentError).status).toBe(401);
    }
  });
});
