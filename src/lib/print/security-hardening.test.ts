// FASE 1 — Testes unitários das correções de segurança do módulo de impressão.
//
// Cobre:
//  - C-01: allowlist de origens do Print Agent (função pura extraída).
//  - C-03: use-print-agent não persiste mais token em localStorage.
//  - C-02/C-04: contrato das RPCs é testado pela integração (fora deste arquivo).

import { describe, expect, it, beforeEach, vi } from "vitest";

// ---------------- C-01: allowlist de origens ----------------

// Reimplementação idêntica da função do agente (print-agent/src/index.js).
// Duplicada aqui para poder ser exercitada em Node/Vitest sem mockar Express.
function makeIsOriginAllowed({ dev = false, profileOrigins = [] as string[] } = {}) {
  const STATIC_ALLOWED = ["https://iga-gestao-etiquetas.lovable.app"];
  const PATTERNS = [
    /^https:\/\/id-preview--[a-z0-9-]+\.lovable\.app$/i,
    /^https:\/\/[a-z0-9-]+\.lovable\.app$/i,
    /^https:\/\/project--[a-z0-9-]+(?:-dev)?\.lovable\.app$/i,
  ];
  return (origin: string | null | undefined): boolean => {
    if (!origin) return true;
    if (STATIC_ALLOWED.includes(origin)) return true;
    if (PATTERNS.some((re) => re.test(origin))) return true;
    if (profileOrigins.includes(origin)) return true;
    if (dev) {
      if (/^https?:\/\/localhost(?::\d+)?$/i.test(origin)) return true;
      if (/^https?:\/\/127\.0\.0\.1(?::\d+)?$/i.test(origin)) return true;
    }
    return false;
  };
}

describe("Fase 1 — C-01 CORS allowlist", () => {
  const allowed = makeIsOriginAllowed();
  const allowedDev = makeIsOriginAllowed({ dev: true });

  it("aceita produção oficial", () => {
    expect(allowed("https://iga-gestao-etiquetas.lovable.app")).toBe(true);
  });

  it("aceita preview id-preview--<uuid>.lovable.app", () => {
    expect(allowed("https://id-preview--c43457fb-4e63-49d9-9d16-56fffee03149.lovable.app")).toBe(true);
  });

  it("aceita project--<id> estáveis (prod e dev)", () => {
    expect(allowed("https://project--c43457fb-4e63-49d9-9d16-56fffee03149.lovable.app")).toBe(true);
    expect(allowed("https://project--c43457fb-4e63-49d9-9d16-56fffee03149-dev.lovable.app")).toBe(true);
  });

  it("aceita quando não há Origin (chamadas server-side / CLI locais)", () => {
    expect(allowed(null)).toBe(true);
    expect(allowed("")).toBe(true);
    expect(allowed(undefined)).toBe(true);
  });

  it("rejeita origens arbitrárias", () => {
    expect(allowed("https://evil.example.com")).toBe(false);
    expect(allowed("http://phishing.lovable.app.evil.com")).toBe(false);
    expect(allowed("https://lovable.app.evil.com")).toBe(false);
    expect(allowed("null")).toBe(false);
  });

  it("rejeita localhost por padrão", () => {
    expect(allowed("http://localhost:5173")).toBe(false);
    expect(allowed("http://127.0.0.1:8080")).toBe(false);
  });

  it("aceita localhost APENAS quando DEV_MODE=true", () => {
    expect(allowedDev("http://localhost:5173")).toBe(true);
    expect(allowedDev("http://127.0.0.1:8080")).toBe(true);
    expect(allowedDev("https://localhost")).toBe(true);
  });

  it("aceita custom-domain listado no profile", () => {
    const withProfile = makeIsOriginAllowed({ profileOrigins: ["https://etiquetas.minha-empresa.com"] });
    expect(withProfile("https://etiquetas.minha-empresa.com")).toBe(true);
    expect(withProfile("https://outra.minha-empresa.com")).toBe(false);
  });
});

// ---------------- C-03: token não persistido em localStorage ----------------

// Vitest jsdom: window/localStorage disponíveis
import { __internal, usePrintAgent, getStoredAgentToken } from "./use-print-agent";
import { renderHook, act } from "@testing-library/react";

// Mock do PrintAgentClient para não sair da rede
vi.mock("./print-agent-client", async () => {
  const actual = await vi.importActual<typeof import("./print-agent-client")>("./print-agent-client");
  return {
    ...actual,
    PrintAgentClient: class MockClient {
      async health() {
        return { ok: false, reachable: false, error: "mock offline", code: "AGENT_OFFLINE" };
      }
    },
    createMockPrintAgent: () => ({ health: async () => ({ ok: true, reachable: true }) }),
  };
});

describe("Fase 1 — C-03 token nunca em localStorage", () => {
  const COMPANY = "c1";

  beforeEach(() => {
    window.localStorage.clear();
    __internal.IN_MEMORY_TOKENS.clear();
  });

  it("getStoredAgentToken sempre retorna null (compat legada)", () => {
    expect(getStoredAgentToken(COMPANY)).toBeNull();
    expect(getStoredAgentToken(null)).toBeNull();
  });

  it("purgeLegacyTokens remove qualquer chave print_agent_token:* pré-existente", () => {
    window.localStorage.setItem("print_agent_token:c1", "pat_leaked_from_old_version");
    window.localStorage.setItem("print_agent_token:c2", "pat_other");
    window.localStorage.setItem("outra_chave", "valor");
    __internal.purgeLegacyTokens();
    expect(window.localStorage.getItem("print_agent_token:c1")).toBeNull();
    expect(window.localStorage.getItem("print_agent_token:c2")).toBeNull();
    expect(window.localStorage.getItem("outra_chave")).toBe("valor");
  });

  it("setToken não grava em localStorage — apenas em memória", async () => {
    const { result } = renderHook(() => usePrintAgent(COMPANY));
    await act(async () => {
      result.current.setToken("pat_new_token_from_pairing");
    });
    expect(result.current.token).toBe("pat_new_token_from_pairing");
    // Nada persistido em localStorage
    for (let i = 0; i < window.localStorage.length; i++) {
      const k = window.localStorage.key(i)!;
      expect(k.startsWith("print_agent_token:")).toBe(false);
    }
    // Presente na store em memória
    expect(__internal.IN_MEMORY_TOKENS.get(COMPANY)).toBe("pat_new_token_from_pairing");
  });

  it("setToken(null) limpa a memória", async () => {
    const { result } = renderHook(() => usePrintAgent(COMPANY));
    await act(async () => {
      result.current.setToken("pat_x");
    });
    await act(async () => {
      result.current.setToken(null);
    });
    expect(result.current.token).toBeNull();
    expect(__internal.IN_MEMORY_TOKENS.has(COMPANY)).toBe(false);
  });

  it("montar o hook remove tokens legados do localStorage automaticamente", async () => {
    window.localStorage.setItem("print_agent_token:c1", "pat_leaked");
    renderHook(() => usePrintAgent(COMPANY));
    // useEffect roda após render — aguarda um tick
    await act(async () => {
      await Promise.resolve();
    });
    expect(window.localStorage.getItem("print_agent_token:c1")).toBeNull();
  });
});
