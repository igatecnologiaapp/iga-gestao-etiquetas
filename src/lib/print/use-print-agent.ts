// FASE 1 (C-03) — token do Print Agent removido do localStorage.
//
// Antes: `print_agent_token:<companyId>` era persistido em localStorage. XSS
// no navegador poderia extrair o token. Mesmo com o comentário indicando uso
// "apenas legado/diagnóstico", o token estava reversível a partir da máquina
// do operador — risco desnecessário.
//
// Agora: mantemos o token apenas em MEMÓRIA (state React) pelo tempo da aba.
// A autenticação operacional entre o navegador e o Print Agent local continua
// funcionando: o agente lê agent.json a cada requisição e valida `X-Company-Id`.
// O token bruto exibido em pareamento serve para o usuário digitar no CLI/GUI
// do agente (`pair-ui`), não para armazenamento no navegador.
//
// Migração: na primeira carga do hook removemos QUALQUER chave legada
// `print_agent_token:*` do localStorage para não deixar segredos antigos.

import { useEffect, useMemo, useState } from "react";
import { PrintAgentClient, createMockPrintAgent } from "./print-agent-client";
import type { AgentHealth } from "./types";

const MOCK_KEY = (companyId: string) => `print_agent_mock:${companyId}`;
const LEGACY_TOKEN_KEY_PREFIX = "print_agent_token:";

// Guardado em memória por aba (sobrevive re-renders, some ao fechar a aba).
// Chave por companyId permite alternar de empresa sem misturar.
const IN_MEMORY_TOKENS: Map<string, string> = new Map();

function purgeLegacyTokens(): void {
  if (typeof window === "undefined") return;
  try {
    const keys: string[] = [];
    for (let i = 0; i < window.localStorage.length; i++) {
      const k = window.localStorage.key(i);
      if (k && k.startsWith(LEGACY_TOKEN_KEY_PREFIX)) keys.push(k);
    }
    for (const k of keys) window.localStorage.removeItem(k);
  } catch {
    /* ignore */
  }
}

/**
 * Compatibilidade retroativa: componentes de diagnóstico chamam esta função
 * para exibir prefixo do token guardado. Agora sempre retorna null (token
 * não é mais persistido) — o diagnóstico continua exibindo os campos como
 * "vazio", o que é o comportamento correto.
 */
export function getStoredAgentToken(_companyId: string | null | undefined): string | null {
  return null;
}

/** Somente para uso interno; não persiste em disco. */
function setInMemoryAgentToken(companyId: string, token: string | null): void {
  if (!token) IN_MEMORY_TOKENS.delete(companyId);
  else IN_MEMORY_TOKENS.set(companyId, token);
}

export function isMockMode(companyId: string | null | undefined): boolean {
  if (!companyId || typeof window === "undefined") return false;
  try {
    return window.localStorage.getItem(MOCK_KEY(companyId)) === "1";
  } catch {
    return false;
  }
}

export function setMockMode(companyId: string, enabled: boolean): void {
  if (typeof window === "undefined") return;
  try {
    if (enabled) window.localStorage.setItem(MOCK_KEY(companyId), "1");
    else window.localStorage.removeItem(MOCK_KEY(companyId));
  } catch {
    /* ignore */
  }
}

export function buildAgentClient(companyId: string | null | undefined): PrintAgentClient {
  if (isMockMode(companyId)) {
    return createMockPrintAgent({ online: true });
  }
  return new PrintAgentClient({
    // Autenticação operacional usa agent.json + X-Company-Id;
    // não enviamos token bruto do navegador (removido do localStorage — C-03).
    token: null,
    companyId: companyId ?? null,
  });
}

export interface UsePrintAgentResult {
  health: AgentHealth | null;
  loading: boolean;
  token: string | null;
  hasToken: boolean;
  mock: boolean;
  client: PrintAgentClient;
  setToken: (t: string | null) => void;
  setMock: (enabled: boolean) => void;
  refresh: () => Promise<void>;
}

export function usePrintAgent(companyId: string | null | undefined): UsePrintAgentResult {
  // Purga chaves legadas assim que o hook é montado no navegador.
  useEffect(() => {
    purgeLegacyTokens();
  }, []);

  const [token, setTokenState] = useState<string | null>(() =>
    companyId ? IN_MEMORY_TOKENS.get(companyId) ?? null : null,
  );
  const [mock, setMockState] = useState<boolean>(() => isMockMode(companyId));
  const [health, setHealth] = useState<AgentHealth | null>(null);
  const [loading, setLoading] = useState<boolean>(true);
  const [tick, setTick] = useState(0);

  useEffect(() => {
    setTokenState(companyId ? IN_MEMORY_TOKENS.get(companyId) ?? null : null);
    setMockState(isMockMode(companyId));
  }, [companyId]);

  const client = useMemo(() => buildAgentClient(companyId), [companyId, token, mock, tick]);

  useEffect(() => {
    let alive = true;
    setLoading(true);
    client
      .health()
      .then((h) => alive && setHealth(h))
      .catch(
        (e) =>
          alive &&
          setHealth({ ok: false, reachable: false, error: String(e?.message ?? e), code: "AGENT_OFFLINE" }),
      )
      .finally(() => alive && setLoading(false));
    return () => {
      alive = false;
    };
  }, [client]);

  return {
    health,
    loading,
    token,
    hasToken: !!token,
    mock,
    client,
    setToken: (t) => {
      if (!companyId) return;
      setInMemoryAgentToken(companyId, t);
      setTokenState(t);
      setTick((n) => n + 1);
    },
    setMock: (enabled) => {
      if (!companyId) return;
      setMockMode(companyId, enabled);
      setMockState(enabled);
      setTick((n) => n + 1);
    },
    refresh: async () => {
      setTick((n) => n + 1);
    },
  };
}

// Exportado apenas para testes; NÃO usar em UI.
export const __internal = {
  IN_MEMORY_TOKENS,
  purgeLegacyTokens,
};
