// FASE 7 — Hook do Print Agent (status + token de pareamento por empresa).
// O token bruto é exibido apenas uma vez no momento da criação (ver FASE 4) e
// fica armazenado localmente no navegador da estação operadora. Aqui só lemos
// o que o usuário colou; jamais persistimos em servidor.

import { useEffect, useMemo, useState } from "react";
import { PrintAgentClient, createMockPrintAgent } from "./print-agent-client";
import type { AgentHealth } from "./types";

const KEY = (companyId: string) => `print_agent_token:${companyId}`;
const MOCK_KEY = (companyId: string) => `print_agent_mock:${companyId}`;

export function getStoredAgentToken(companyId: string | null | undefined): string | null {
  if (!companyId || typeof window === "undefined") return null;
  try {
    return window.localStorage.getItem(KEY(companyId));
  } catch {
    return null;
  }
}

export function setStoredAgentToken(companyId: string, token: string | null): void {
  if (typeof window === "undefined") return;
  try {
    if (!token) window.localStorage.removeItem(KEY(companyId));
    else window.localStorage.setItem(KEY(companyId), token);
  } catch {
    /* ignore */
  }
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
    token: getStoredAgentToken(companyId),
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
  const [token, setTokenState] = useState<string | null>(() => getStoredAgentToken(companyId));
  const [mock, setMockState] = useState<boolean>(() => isMockMode(companyId));
  const [health, setHealth] = useState<AgentHealth | null>(null);
  const [loading, setLoading] = useState<boolean>(true);
  const [tick, setTick] = useState(0);

  useEffect(() => {
    setTokenState(getStoredAgentToken(companyId));
    setMockState(isMockMode(companyId));
  }, [companyId]);

  const client = useMemo(() => buildAgentClient(companyId), [companyId, token, mock, tick]);

  useEffect(() => {
    let alive = true;
    setLoading(true);
    client
      .health()
      .then((h) => alive && setHealth(h))
      .catch((e) =>
        alive && setHealth({ ok: false, reachable: false, error: String(e?.message ?? e), code: "AGENT_OFFLINE" }),
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
      setStoredAgentToken(companyId, t);
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
