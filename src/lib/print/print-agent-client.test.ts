import { describe, it, expect } from "vitest";
import { createMockPrintAgent, PrintAgentClient, createMockAgentTransport } from "./print-agent-client";

describe("PrintAgentClient (mock)", () => {
  it("health: ok quando o agente está online", async () => {
    const agent = createMockPrintAgent({ online: true });
    const h = await agent.health();
    expect(h.ok).toBe(true);
    expect(h.reachable).toBe(true);
    expect(h.version).toBe("mock-0.0.1");
  });

  it("health: marca offline (reachable=false) sem lançar erro", async () => {
    const agent = createMockPrintAgent({ online: false });
    const h = await agent.health();
    expect(h.ok).toBe(false);
    expect(h.reachable).toBe(false);
    expect(h.error).toBeTruthy();
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

  it("submit: propaga falha do agente", async () => {
    const agent = new PrintAgentClient({
      transport: createMockAgentTransport({ failSubmit: true }),
      timeoutMs: 500,
    });
    await expect(agent.submit({ printerId: "X", copies: 1 })).rejects.toThrow(/Agent 500/);
  });

  it("testConnection: false quando offline", async () => {
    const agent = createMockPrintAgent({ online: false });
    expect(await agent.testConnection()).toBe(false);
  });
});
