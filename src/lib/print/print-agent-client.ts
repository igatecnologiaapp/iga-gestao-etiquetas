// FASE 4 — PrintAgentClient
// Contrato HTTP do Print Agent local (ver docs/PRINT_AGENT_PROTOCOL.md).
//
// Princípios:
//   - Por padrão tenta `http://127.0.0.1:17777`.
//   - Token de pareamento (por empresa) viaja em `Authorization: Bearer <token>` +
//     header opcional `X-Company-Id` para o agente validar o vínculo.
//   - Toda falha de rede/timeout é normalizada para `PrintAgentOfflineError`.
//   - Erros HTTP padronizados são convertidos em `PrintAgentError` com `code`.
//   - NÃO altera `label-pdf.ts` nem o fluxo PDF atual; o fallback continua sendo o PDF.

import type {
  AgentCancelResponse,
  AgentDiagnosticsReport,
  AgentErrorBody,
  AgentErrorCode,
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
  companyId?: string | null;
  timeoutMs?: number;
  transport?: AgentTransport;
}

const DEFAULT_BASE_URL = "http://127.0.0.1:17777";
const DEFAULT_TIMEOUT = 1500;

export class PrintAgentOfflineError extends Error {
  code: AgentErrorCode = "AGENT_OFFLINE";
  constructor(message = "Print Agent offline", code: AgentErrorCode = "AGENT_OFFLINE") {
    super(message);
    this.name = "PrintAgentOfflineError";
    this.code = code;
  }
}

export class PrintAgentError extends Error {
  code: AgentErrorCode;
  status: number;
  details?: Record<string, unknown>;
  constructor(code: AgentErrorCode, message: string, status = 500, details?: Record<string, unknown>) {
    super(message);
    this.name = "PrintAgentError";
    this.code = code;
    this.status = status;
    this.details = details;
  }
}

export class PrintAgentClient {
  private readonly baseUrl: string;
  private readonly token: string | null;
  private readonly companyId: string | null;
  private readonly timeoutMs: number;
  private readonly fetchImpl: typeof fetch;

  constructor(opts: PrintAgentClientOptions = {}) {
    this.baseUrl = (opts.baseUrl ?? DEFAULT_BASE_URL).replace(/\/$/, "");
    this.token = opts.token ?? null;
    this.companyId = opts.companyId ?? null;
    this.timeoutMs = opts.timeoutMs ?? DEFAULT_TIMEOUT;
    this.fetchImpl = opts.transport?.fetch ?? globalThis.fetch.bind(globalThis);
  }

  private headers(extra: Record<string, string> = {}): Record<string, string> {
    const base: Record<string, string> = { "content-type": "application/json", ...extra };
    if (this.token) base["authorization"] = `Bearer ${this.token}`;
    if (this.companyId) base["x-company-id"] = this.companyId;
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
        const body = (await res.json().catch(() => null)) as AgentErrorBody | null;
        const code = (body?.code ?? this.statusToCode(res.status)) as AgentErrorCode;
        const msg = body?.message ?? body?.error ?? `Agent ${res.status}: ${res.statusText}`;
        throw new PrintAgentError(code, msg, res.status, body?.details);
      }
      return (await res.json()) as T;
    } catch (e: unknown) {
      const err = e as { name?: string; message?: string };
      if (err?.name === "AbortError") throw new PrintAgentOfflineError("Tempo esgotado", "TIMEOUT");
      // Network error / DNS / connection refused → offline
      if (e instanceof TypeError) throw new PrintAgentOfflineError(err.message ?? "network", "AGENT_OFFLINE");
      throw e;
    } finally {
      clearTimeout(timer);
    }
  }

  private statusToCode(status: number): AgentErrorCode {
    if (status === 401) return "UNAUTHORIZED";
    if (status === 403) return "FORBIDDEN_ORIGIN";
    if (status === 404) return "JOB_NOT_FOUND";
    if (status === 409) return "JOB_NOT_CANCELABLE";
    if (status === 422) return "INVALID_PAYLOAD";
    return "INTERNAL_ERROR";
  }

  async health(): Promise<AgentHealth> {
    try {
      const data = await this.request<AgentHealth>("/health", { method: "GET" });
      return {
        ok: true,
        reachable: true,
        version: data.version,
        status: data.status,
        connected: data.connected ?? true,
        paired: data.paired,
        token_valid: data.token_valid ?? null,
        token_prefix: data.token_prefix ?? null,
        token_length: data.token_length ?? null,
        company_id: data.company_id ?? null,
        device_id: data.device_id ?? null,
        device_name: data.device_name ?? null,
        port: data.port,
        service: data.service,
        profile: data.profile,
      };
    } catch (e: unknown) {
      if (e instanceof PrintAgentOfflineError) {
        return { ok: false, reachable: false, error: e.message, code: e.code };
      }
      if (e instanceof PrintAgentError) {
        return { ok: false, reachable: true, error: e.message, code: e.code };
      }
      return { ok: false, reachable: true, error: (e as Error)?.message ?? "unknown", code: "INTERNAL_ERROR" };
    }
  }


  async listPrinters(): Promise<AgentPrinter[]> {
    return this.request<AgentPrinter[]>("/printers", { method: "GET" });
  }

  async authStatus(): Promise<AgentDiagnosticsReport> {
    return this.request<AgentDiagnosticsReport>("/auth/status", { method: "GET" });
  }

  async diagnostics(): Promise<AgentDiagnosticsReport> {
    return this.request<AgentDiagnosticsReport>("/diagnostics", { method: "GET" });
  }

  async testPrinter(printerId: string): Promise<{ ok: boolean }> {
    return this.request<{ ok: boolean }>(`/printers/${encodeURIComponent(printerId)}/test`, { method: "POST" });
  }

  async printTestPage(printerId: string): Promise<AgentPrintResponse> {
    return this.request<AgentPrintResponse>(`/printers/${encodeURIComponent(printerId)}/test-page`, {
      method: "POST",
    });
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

  async cancelJob(jobId: string): Promise<AgentCancelResponse> {
    return this.request<AgentCancelResponse>(`/jobs/${encodeURIComponent(jobId)}/cancel`, { method: "POST" });
  }
}

// ===== Mock controlado =====
// Útil para testes/desenvolvimento enquanto o binário oficial não existe.
export interface MockAgentOptions {
  online?: boolean;
  printers?: AgentPrinter[];
  failSubmit?: boolean;
  requireToken?: string;       // se setado, exige Authorization Bearer = requireToken
  invalidToken?: boolean;      // força resposta 401 INVALID_TOKEN
  cancelable?: boolean;        // controla se cancelJob aceita (default: true)
}

export function createMockAgentTransport(opts: MockAgentOptions = {}): AgentTransport {
  const online = opts.online ?? true;
  const printers = opts.printers ?? [
    { id: "MOCK-001", name: "Mock Zebra ZD220", driver: "ZPL", default: true, status: "online" },
  ];
  const jobs = new Map<string, AgentJobStatus>();
  const cancelable = opts.cancelable ?? true;

  const json = (body: unknown, status = 200): Response =>
    new Response(JSON.stringify(body), { status, headers: { "content-type": "application/json" } });

  const err = (status: number, code: AgentErrorCode, message: string) =>
    json({ code, message } satisfies AgentErrorBody, status);

  return {
    fetch: (async (input: RequestInfo | URL, init?: RequestInit) => {
      if (!online) throw new TypeError("ECONNREFUSED (mock offline)");
      const url = typeof input === "string" ? input : input.toString();
      const path = new URL(url).pathname;
      const method = (init?.method ?? "GET").toUpperCase();
      const headers = new Headers(init?.headers as HeadersInit | undefined);
      const auth = headers.get("authorization");

      if (opts.invalidToken) return err(401, "INVALID_TOKEN", "token inválido");
      if (opts.requireToken) {
        if (!auth) return err(401, "MISSING_TOKEN", "token de pareamento ausente");
        if (auth !== `Bearer ${opts.requireToken}`) return err(401, "INVALID_TOKEN", "token inválido");
      }

      if (path === "/health") return json({ version: "mock-0.0.1", status: "ok", paired: true, token_valid: true });
      if (path === "/auth/status" || path === "/diagnostics") return json({
        ok: true,
        generated_at: new Date().toISOString(),
        version: "mock-0.0.1",
        port: 17777,
        health: { ok: true, reachable: true, connected: true, paired: true, token_valid: true },
        agent_json: { exists: true, paired: true, token_present: true },
        service: { running: true, mock: true },
        auth: {
          token_found: { present: true, prefix: "mock", suffix: "oken", length: 10 },
          token_sent: { present: !!auth, prefix: auth?.slice(7, 19) ?? null, suffix: auth?.slice(-6) ?? null, length: auth ? auth.length - 7 : 0 },
          token_expected: { present: true, prefix: "mock", suffix: "oken", length: 10 },
          company_id_sent: headers.get("x-company-id"),
          company_id_expected: null,
          device_id_expected: "mock-device",
          validation_result: "valid",
          failure_reason: null,
          token_valid: true,
        },
        exchange: null,
        printers_check: { ok: true, status: 200, count: printers.length, printers },
        steps: [
          { key: "agent", label: "Verificar instalação do agente", ok: true },
          { key: "printers", label: "Verificar GET /printers", ok: true },
        ],
      } satisfies AgentDiagnosticsReport);
      if (path === "/printers") return json(printers);
      if (path.match(/^\/printers\/[^/]+\/test$/) && method === "POST") return json({ ok: true });
      if (path.match(/^\/printers\/[^/]+\/test-page$/) && method === "POST") {
        const jobId = `mock-test-${Date.now()}`;
        jobs.set(jobId, { jobId, status: "completed" });
        return json({ jobId });
      }
      if (path === "/print" && method === "POST") {
        if (opts.failSubmit) return err(500, "INTERNAL_ERROR", "mock failure");
        const jobId = `mock-${Date.now()}`;
        jobs.set(jobId, { jobId, status: "completed" });
        return json({ jobId });
      }
      if (path.match(/^\/jobs\/[^/]+\/cancel$/) && method === "POST") {
        const jobId = decodeURIComponent(path.split("/")[2]);
        if (!jobs.has(jobId)) return err(404, "JOB_NOT_FOUND", "job não encontrado");
        if (!cancelable) return err(409, "JOB_NOT_CANCELABLE", "job não pode ser cancelado");
        jobs.set(jobId, { jobId, status: "canceled" });
        return json({ jobId, canceled: true } satisfies AgentCancelResponse);
      }
      if (path.startsWith("/jobs/") && method === "GET") {
        const jobId = decodeURIComponent(path.slice("/jobs/".length));
        const job = jobs.get(jobId);
        if (!job) return err(404, "JOB_NOT_FOUND", "job não encontrado");
        return json(job);
      }
      return err(404, "JOB_NOT_FOUND", "rota não encontrada");
    }) as typeof fetch,
  };
}

export function createMockPrintAgent(opts: MockAgentOptions = {}): PrintAgentClient {
  return new PrintAgentClient({
    transport: createMockAgentTransport(opts),
    timeoutMs: 500,
    token: opts.requireToken ?? null,
  });
}
