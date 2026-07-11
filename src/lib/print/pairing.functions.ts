// FASE 4 — Server functions para gerenciar pareamento do Print Agent.
// Regras:
//  - Apenas administradores globais ou administradores da empresa podem criar/listar/revogar.
//  - O token bruto é retornado apenas no momento da criação; o banco guarda só o hash SHA-256.
//  - Toda mutação é auditada via trigger tg_audit_row em print_agent_pairings.

import { createServerFn } from "@tanstack/react-start";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { z } from "zod";
import { createHash, randomBytes } from "node:crypto";
import type { SupabaseClient } from "@supabase/supabase-js";
import type { PrintAgentPairing, PrintAgentPairingCreated } from "./types";

function sha256Hex(input: string): string {
  return createHash("sha256").update(input, "utf8").digest("hex");
}

function generateToken(): { token: string; prefix: string; hash: string } {
  const raw = `pat_${randomBytes(32).toString("hex")}`;
  return { token: raw, prefix: raw.slice(0, 12), hash: sha256Hex(raw) };
}

async function assertCompanyAdmin(
  supabase: SupabaseClient,
  userId: string,
  companyId: string,
): Promise<void> {
  const { data: isGlobal } = await supabase.rpc("is_global_admin", { _user_id: userId });
  if (isGlobal) return;
  const { data: isAdmin } = await supabase.rpc("has_role", {
    _user_id: userId,
    _company_id: companyId,
    _role: "administrador",
  });
  if (!isAdmin) throw new Error("Forbidden: requires administrator role");
}

export const listPairings = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data: { companyId: string }) => z.object({ companyId: z.string().uuid() }).parse(data))
  .handler(async ({ data, context }): Promise<PrintAgentPairing[]> => {
    await assertCompanyAdmin(context.supabase, context.userId, data.companyId);
    const { data: rows, error } = await context.supabase
      .from("print_agent_pairings" as never)
      .select("*")
      .eq("company_id", data.companyId)
      .order("created_at", { ascending: false });
    if (error) throw error;
    return (rows ?? []) as unknown as PrintAgentPairing[];
  });

export const createPairing = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data: { companyId: string; label: string }) =>
    z.object({ companyId: z.string().uuid(), label: z.string().trim().min(1).max(120) }).parse(data),
  )
  .handler(async ({ data, context }): Promise<PrintAgentPairingCreated> => {
    await assertCompanyAdmin(context.supabase, context.userId, data.companyId);
    const { token, prefix, hash } = generateToken();
    const { data: row, error } = await context.supabase
      .from("print_agent_pairings" as never)
      .insert({
        company_id: data.companyId,
        label: data.label,
        token_prefix: prefix,
        token_hash: hash,
        created_by: context.userId,
        status: "active",
      } as never)
      .select("*")
      .single();
    if (error) throw error;
    return { pairing: row as unknown as PrintAgentPairing, token };
  });

export const revokePairing = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data: { pairingId: string }) => z.object({ pairingId: z.string().uuid() }).parse(data))
  .handler(async ({ data, context }): Promise<PrintAgentPairing> => {
    // Carrega para validar a empresa antes de mutar
    const { data: existing, error: loadErr } = await context.supabase
      .from("print_agent_pairings" as never)
      .select("*")
      .eq("id", data.pairingId)
      .maybeSingle();
    if (loadErr) throw loadErr;
    if (!existing) throw new Error("Pareamento não encontrado");
    const current = existing as unknown as PrintAgentPairing;
    await assertCompanyAdmin(context.supabase, context.userId, current.company_id);

    const { data: row, error } = await context.supabase
      .from("print_agent_pairings" as never)
      .update({
        status: "revoked",
        revoked_by: context.userId,
        revoked_at: new Date().toISOString(),
      } as never)
      .eq("id", data.pairingId)
      .select("*")
      .single();
    if (error) throw error;
    return row as unknown as PrintAgentPairing;
  });

// FASE 1 (C-04) — rotação atômica.
// Toda a rotação (criar novo + revogar antigo) executa em UMA transação
// via RPC public.rotate_print_agent_pairing. Se qualquer etapa falhar,
// rollback total é aplicado e a estação continua com o pareamento anterior
// intacto — nunca fica sem token válido.
export const rotatePairing = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data: { pairingId: string }) => z.object({ pairingId: z.string().uuid() }).parse(data))
  .handler(async ({ data, context }): Promise<PrintAgentPairingCreated> => {
    const { token, prefix, hash } = generateToken();

    const { data: newId, error: rpcErr } = await context.supabase.rpc(
      "rotate_print_agent_pairing" as never,
      { _pairing_id: data.pairingId, _new_prefix: prefix, _new_hash: hash } as never,
    );
    if (rpcErr) {
      // Erros da RPC: pairing_not_found | forbidden | not_authenticated
      throw new Error(rpcErr.message || "Falha ao rotacionar pareamento");
    }
    if (!newId) throw new Error("Rotação não retornou id do novo pareamento");

    // Carrega o novo registro para devolver ao chamador (RLS já permite ao admin da empresa).
    const { data: row, error } = await context.supabase
      .from("print_agent_pairings" as never)
      .select("*")
      .eq("id", newId as string)
      .single();
    if (error) throw error;
    return { pairing: row as unknown as PrintAgentPairing, token };
  });
