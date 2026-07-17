import { describe, it, expect } from "vitest";
import {
  createMockPrintAgent,
  createMockAgentTransport,
  PrintAgentClient,
  PrintAgentError,
} from "./print-agent-client";

describe("PrintAgentClient (FASE 4)", () => {
  it("health: ok quando o agente está online", async () => {
    const agent = createMockPrintAgent({ online: true });
    const h = await agent.health();
    expect(h.ok).toBe(true);
    expect(h.reachable).toBe(true);
    expect(h.version).toBe("mock-0.0.1");
  });

  it("health: offline com code=AGENT_OFFLINE (sem lançar erro)", async () => {
    const agent = createMockPrintAgent({ online: false });
    const h = await agent.health();
    expect(h.ok).toBe(false);
    expect(h.reachable).toBe(false);
    expect(h.code).toBe("AGENT_OFFLINE");
  });

  it("listPrinters: retorna lista mockada", async () => {
    const agent = createMockPrintAgent();
    const list = await agent.listPrinters();
    expect(list.length).toBeGreaterThan(0);
    expect(list[0]).toHaveProperty("id");
  });

  it("submit + getJob: cria job e consulta status", async () => {
    const agent = createMockPrintAgent();
    const { jobId } = await agent.submit({ printerId: "MOCK-001", copies: 1, raw: "^XA^XZ" });
    expect(jobId).toMatch(/^mock-/);
    const status = await agent.getJob(jobId);
    expect(status.status).toBe("completed");
  });

  it("submit: propaga falha padronizada do agente", async () => {
    const agent = new PrintAgentClient({
      transport: createMockAgentTransport({ failSubmit: true }),
      timeoutMs: 500,
    });
    await expect(agent.submit({ printerId: "X", copies: 1 })).rejects.toMatchObject({
      name: "PrintAgentError",
      code: "INTERNAL_ERROR",
      status: 500,
    });
  });

  it("token ausente → MISSING_TOKEN", async () => {
    const agent = new PrintAgentClient({
      transport: createMockAgentTransport({ requireToken: "good-token" }),
      timeoutMs: 500,
      token: null,
    });
    await expect(agent.listPrinters()).rejects.toMatchObject({ code: "MISSING_TOKEN", status: 401 });
  });

  it("token inválido → INVALID_TOKEN", async () => {
    const agent = new PrintAgentClient({
      transport: createMockAgentTransport({ requireToken: "good-token" }),
      timeoutMs: 500,
      token: "wrong",
    });
    await expect(agent.listPrinters()).rejects.toMatchObject({ code: "INVALID_TOKEN", status: 401 });
  });

  it("token válido autentica corretamente", async () => {
    const agent = createMockPrintAgent({ requireToken: "good-token" });
    const list = await agent.listPrinters();
    expect(list.length).toBeGreaterThan(0);
  });

  it("timeout → PrintAgentOfflineError com code=TIMEOUT", async () => {
    const slow: typeof fetch = ((_url: RequestInfo | URL, init?: RequestInit) =>
      new Promise((_resolve, reject) => {
        init?.signal?.addEventListener("abort", () => {
          const err = new Error("aborted");
          err.name = "AbortError";
          reject(err);
        });
      })) as typeof fetch;
    const agent = new PrintAgentClient({ transport: { fetch: slow }, timeoutMs: 30 });
    const h = await agent.health();
    expect(h.code).toBe("TIMEOUT");
    expect(h.reachable).toBe(false);
  });

  it("cancelJob: cancela com sucesso", async () => {
    const agent = createMockPrintAgent();
    // FASE 2 (2.9): submit exige comando raw — antes o mock aceitava payload
    // vazio, o que mascarava o contrato real do endpoint /print.
    const { jobId } = await agent.submit({ printerId: "MOCK-001", copies: 1, raw: "^XA^XZ", language: "ZPL" });
    const res = await agent.cancelJob(jobId);
    expect(res.canceled).toBe(true);
    const status = await agent.getJob(jobId);
    expect(status.status).toBe("canceled");
  });

  it("cancelJob: JOB_NOT_FOUND para id inexistente", async () => {
    const agent = createMockPrintAgent();
    await expect(agent.cancelJob("nao-existe")).rejects.toMatchObject({
      code: "JOB_NOT_FOUND",
      status: 404,
    });
  });

  it("cancelJob: JOB_NOT_CANCELABLE quando agente bloqueia", async () => {
    const agent = createMockPrintAgent({ cancelable: false });
    const { jobId } = await agent.submit({ printerId: "MOCK-001", copies: 1, raw: "^XA^XZ", language: "ZPL" });
    await expect(agent.cancelJob(jobId)).rejects.toMatchObject({
      code: "JOB_NOT_CANCELABLE",
      status: 409,
    });
  });

  it("testConnection: false quando offline (fallback PDF preservado)", async () => {
    const agent = createMockPrintAgent({ online: false });
    expect(await agent.testConnection()).toBe(false);
  });

  it("PrintAgentError carrega code, status e mensagem padronizada", async () => {
    const agent = createMockPrintAgent({ requireToken: "x", invalidToken: true });
    try {
      await agent.listPrinters();
      throw new Error("expected throw");
    } catch (e) {
      expect(e).toBeInstanceOf(PrintAgentError);
      const err = e as PrintAgentError;
      expect(err.code).toBe("INVALID_TOKEN");
      expect(err.status).toBe(401);
    }
  });
});
