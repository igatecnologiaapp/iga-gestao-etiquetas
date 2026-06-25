// FASE 3 — PrintAgentClient
// Contrato HTTP do Print Agent local (ver .lovable/plan.md e docs/PRINT_AGENT_PROTOCOL.md).
//
// Comportamento desta fase:
//   - Por padrão tenta `http://127.0.0.1:17777`.
//   - Se o agente não responder em <timeout>, considera offline e retorna shape padronizado.
//   - Permite injetar um transport mock para testes/UX sem dependência real.
//   - NÃO envia trabalhos reais a impressoras físicas: o backend (binário Print Agent)
//     ainda não existe; este client está pronto para falar com ele assim que for empacotado.

import type {
  AgentHealth,
  AgentJobStatus,
  AgentPrinter,
  AgentPrintRequest,
  AgentPrintResponse,
} from "./types";

export interface AgentTransport {
  fetch: typeof fetch;
}

export interface PrintAgentClientOptions {
  baseUrl?: string;
  token?: string | null;
  timeoutMs?: number;
  transport?: AgentTransport;
}

const DEFAULT_BASE_URL = "http://127.0.0.1:17777";
const DEFAULT_TIMEOUT = 1500;

export class PrintAgentOfflineError extends Error {
  constructor(message = "Print Agent offline") {
    super(message);
    this.name = "PrintAgentOfflineError";
  }
}

export class PrintAgentClient {
  private readonly baseUrl: string;
  private readonly token: string | null;
  private readonly timeoutMs: number;
  private readonly fetchImpl: typeof fetch;

  constructor(opts: PrintAgentClientOptions = {}) {
    this.baseUrl = (opts.baseUrl ?? DEFAULT_BASE_URL).replace(/\/$/, "");
    this.token = opts.token ?? null;
    this.timeoutMs = opts.timeoutMs ?? DEFAULT_TIMEOUT;
    this.fetchImpl = opts.transport?.fetch ?? globalThis.fetch.bind(globalThis);
  }

  private headers(extra: Record<string, string> = {}): Record<string, string> {
    const base: Record<string, string> = { "content-type": "application/json", ...extra };
    if (this.token) base["authorization"] = `Bearer ${this.token}`;
    return base;
  }

  private async request<T>(path: string, init: RequestInit = {}): Promise<T> {
    const ctrl = new AbortController();
    const timer = setTimeout(() => ctrl.abort(), this.timeoutMs);
    try {
      const res = await this.fetchImpl(`${this.baseUrl}${path}`, {
        ...init,
        headers: this.headers((init.headers as Record<string, string>) ?? {}),
        signal: ctrl.signal,
      });
      if (!res.ok) {
        const body = await res.text().catch(() => "");
        throw new Error(`Agent ${res.status}: ${body || res.statusText}`);
      }
      return (await res.json()) as T;
    } catch (e: any) {
      if (e?.name === "AbortError") throw new PrintAgentOfflineError("Tempo esgotado");
      // Network error / DNS / connection refused → offline
      if (e instanceof TypeError) throw new PrintAgentOfflineError(e.message);
      throw e;
    } finally {
      clearTimeout(timer);
    }
  }

  async health(): Promise<AgentHealth> {
    try {
      const data = await this.request<{ version?: string; status?: string }>("/health", { method: "GET" });
      return { ok: true, reachable: true, version: data.version, status: data.status };
    } catch (e: any) {
      if (e instanceof PrintAgentOfflineError) {
        return { ok: false, reachable: false, error: e.message };
      }
      return { ok: false, reachable: true, error: e?.message ?? "unknown" };
    }
  }

  async listPrinters(): Promise<AgentPrinter[]> {
    return this.request<AgentPrinter[]>("/printers", { method: "GET" });
  }

  async testConnection(): Promise<boolean> {
    const h = await this.health();
    return h.ok;
  }

  async submit(req: AgentPrintRequest): Promise<AgentPrintResponse> {
    return this.request<AgentPrintResponse>("/print", {
      method: "POST",
      body: JSON.stringify(req),
    });
  }

  async getJob(jobId: string): Promise<AgentJobStatus> {
    return this.request<AgentJobStatus>(`/jobs/${encodeURIComponent(jobId)}`, { method: "GET" });
  }
}

// ===== Mock controlado =====
// Útil para testes/desenvolvimento enquanto o binário oficial não existe.
export interface MockAgentOptions {
  online?: boolean;
  printers?: AgentPrinter[];
  failSubmit?: boolean;
}

export function createMockAgentTransport(opts: MockAgentOptions = {}): AgentTransport {
  const online = opts.online ?? true;
  const printers = opts.printers ?? [
    { id: "MOCK-001", name: "Mock Zebra ZD220", driver: "ZPL", default: true },
  ];
  const jobs = new Map<string, AgentJobStatus>();

  const json = (body: unknown, status = 200): Response =>
    new Response(JSON.stringify(body), { status, headers: { "content-type": "application/json" } });

  return {
    fetch: (async (input: RequestInfo | URL, init?: RequestInit) => {
      if (!online) throw new TypeError("ECONNREFUSED (mock offline)");
      const url = typeof input === "string" ? input : input.toString();
      const path = new URL(url).pathname;
      const method = (init?.method ?? "GET").toUpperCase();

      if (path === "/health") return json({ version: "mock-0.0.1", status: "ok" });
      if (path === "/printers") return json(printers);
      if (path === "/print" && method === "POST") {
        if (opts.failSubmit) return json({ error: "mock failure" }, 500);
        const jobId = `mock-${Date.now()}`;
        jobs.set(jobId, { jobId, status: "completed" });
        return json({ jobId });
      }
      if (path.startsWith("/jobs/") && method === "GET") {
        const jobId = decodeURIComponent(path.slice("/jobs/".length));
        return json(jobs.get(jobId) ?? { jobId, status: "failed", error: "unknown job" });
      }
      return json({ error: "not found" }, 404);
    }) as typeof fetch,
  };
}

export function createMockPrintAgent(opts: MockAgentOptions = {}): PrintAgentClient {
  return new PrintAgentClient({ transport: createMockAgentTransport(opts), timeoutMs: 500 });
}
