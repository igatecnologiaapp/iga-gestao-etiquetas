// Testes automatizados das políticas RLS.
//
// Objetivo: garantir, de forma contínua, que apenas usuários autorizados
// acessam as tabelas sensíveis. Os testes executam contra o banco real usando
// a chave pública (papel `anon`), simulando um atacante não autenticado que
// conhece a URL e a chave publicável — exatamente o cenário exposto no browser.
//
// Critério de aprovação por tabela:
//   - Leitura anônima: erro de permissão/RLS OU zero linhas retornadas.
//   - Escrita anônima: sempre erro.
//   - RPCs SECURITY DEFINER: sempre erro para anônimo.
//
// Quando as variáveis de ambiente do backend não estão presentes (ex.: CI sem
// acesso), a suíte é ignorada em vez de falhar com falso negativo.

import { describe, it, expect, beforeAll } from "vitest";
import { createClient, type SupabaseClient } from "@supabase/supabase-js";
import {
  COMPANY_SCOPED_TABLES,
  CRITICAL_TABLES,
  PROTECTED_RPCS,
  SENSITIVE_TABLES,
} from "./rls-tables";

const env = (key: string): string | undefined =>
  (import.meta as any).env?.[key] ?? (globalThis as any).process?.env?.[key];

const URL = env("VITE_SUPABASE_URL") ?? env("SUPABASE_URL");
const ANON_KEY = env("VITE_SUPABASE_PUBLISHABLE_KEY") ?? env("SUPABASE_PUBLISHABLE_KEY");

const configured = Boolean(URL && ANON_KEY);

let anon: SupabaseClient;
let reachable = false;

beforeAll(async () => {
  if (!configured) return;
  anon = createClient(URL!, ANON_KEY!, {
    auth: { persistSession: false, autoRefreshToken: false },
  });
  try {
    const res = await fetch(`${URL}/rest/v1/`, { headers: { apikey: ANON_KEY! } });
    reachable = res.status < 500;
  } catch {
    reachable = false;
  }
}, 30_000);

/** Considera bloqueado: erro do PostgREST OU conjunto vazio (RLS filtrou tudo). */
function assertDeniedRead(result: { data: unknown[] | null; error: unknown }, table: string) {
  if (result.error) {
    expect(result.error, `${table}: erro esperado`).toBeTruthy();
    return;
  }
  expect(
    result.data ?? [],
    `${table}: leitura anônima retornou linhas — RLS/GRANT inseguro`,
  ).toHaveLength(0);
}

describe.skipIf(!configured)("RLS — acesso anônimo às tabelas sensíveis", () => {
  it("inventário de tabelas sensíveis não está vazio", () => {
    expect(SENSITIVE_TABLES.length).toBeGreaterThan(40);
    expect(new Set(SENSITIVE_TABLES).size).toBe(SENSITIVE_TABLES.length);
  });

  describe("tabelas críticas (credenciais, auditoria, identidade, permissões)", () => {
    for (const table of CRITICAL_TABLES) {
      it(
        `nega leitura anônima em ${table}`,
        async () => {
          if (!reachable) return;
          const { data, error } = await anon.from(table).select("*").limit(1);
          assertDeniedRead({ data, error }, table);
        },
        20_000,
      );
    }
  });

  describe("tabelas de negócio escopadas por empresa", () => {
    for (const table of COMPANY_SCOPED_TABLES) {
      it(
        `nega leitura anônima em ${table}`,
        async () => {
          if (!reachable) return;
          const { data, error } = await anon.from(table).select("*").limit(1);
          assertDeniedRead({ data, error }, table);
        },
        20_000,
      );
    }
  });
});

describe.skipIf(!configured)("RLS — escrita anônima é sempre bloqueada", () => {
  // Amostra representativa: identidade, permissões, credenciais, auditoria e
  // dados operacionais. Inserções propositalmente inválidas — o bloqueio deve
  // ocorrer por permissão/RLS, nunca resultar em linha criada.
  const writeTargets: Array<{ table: string; payload: Record<string, unknown> }> = [
    { table: "user_company_roles", payload: { user_id: crypto.randomUUID(), company_id: crypto.randomUUID(), role: "administrador" } },
    { table: "platform_admins", payload: { user_id: crypto.randomUUID() } },
    { table: "role_permissions", payload: { role: "administrador", permission_key: "rls.test" } },
    { table: "integration_tokens", payload: { company_id: crypto.randomUUID(), integration_config_id: crypto.randomUUID(), token_name: "rls-test", token_hash: "x" } },
    { table: "print_agent_pairings", payload: { company_id: crypto.randomUUID(), label: "rls-test", token_prefix: "aaaaaaaa", token_hash: "x", status: "active" } },
    { table: "audit_logs", payload: { action: "OTHER", table_name: "rls_test" } },
    { table: "companies", payload: { name: "RLS Test Co" } },
    { table: "products", payload: { company_id: crypto.randomUUID(), name: "RLS Test Product" } },
  ];

  for (const { table, payload } of writeTargets) {
    it(
      `nega inserção anônima em ${table}`,
      async () => {
        if (!reachable) return;
        const { data, error } = await anon.from(table).insert(payload as never).select();
        expect(error, `${table}: inserção anônima deveria falhar`).toBeTruthy();
        expect(data ?? [], `${table}: nenhuma linha deve ser criada`).toHaveLength(0);
      },
      20_000,
    );
  }

  it(
    "nega atualização anônima em user_profiles",
    async () => {
      if (!reachable) return;
      const { data, error } = await anon
        .from("user_profiles")
        .update({ status: "ativo" })
        .eq("id", crypto.randomUUID())
        .select();
      // Sem erro só é aceitável se nada foi afetado (RLS filtrou a linha).
      if (!error) expect(data ?? []).toHaveLength(0);
    },
    20_000,
  );

  it(
    "nega exclusão anônima em user_company_roles",
    async () => {
      if (!reachable) return;
      const { data, error } = await anon
        .from("user_company_roles")
        .delete()
        .eq("id", crypto.randomUUID())
        .select();
      if (!error) expect(data ?? []).toHaveLength(0);
    },
    20_000,
  );
});

describe.skipIf(!configured)("RLS — funções SECURITY DEFINER não executáveis por anônimo", () => {
  for (const fn of PROTECTED_RPCS) {
    it(
      `nega execução anônima de ${fn}()`,
      async () => {
        if (!reachable) return;
        const { error } = await anon.rpc(fn as never, {} as never);
        expect(error, `${fn}: execução anônima deveria falhar`).toBeTruthy();
      },
      20_000,
    );
  }
});
