// FASE 16 — Pareamento por código curto (6 dígitos).
// Fluxo:
//  1. Administrador clica em "Gerar código" no painel → recebe um código de 6 dígitos
//     com validade de 10 minutos.
//  2. Operador digita o código no Print Agent instalado na estação.
//  3. Agente troca o código por um token permanente via /api/public/print-agent/exchange.
//
// O código é uso único, expira automaticamente e nunca é reexibido.

import { createServerFn } from "@tanstack/react-start";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { z } from "zod";
import { randomInt } from "node:crypto";
import { assertCompanyAdmin } from "./company-admin";

export interface PairingCode {
  id: string;
  code: string;
  label: string;
  company_id: string;
  expires_at: string;
  consumed_at: string | null;
  created_at: string;
}

function generateCode(): string {
  // Códigos numéricos de 6 dígitos, evitando combinações triviais.
  for (let attempt = 0; attempt < 5; attempt++) {
    const n = randomInt(100000, 1000000).toString();
    if (!/^(\d)\1{5}$/.test(n) && !["123456", "654321", "000000"].includes(n)) return n;
  }
  return randomInt(100000, 1000000).toString();
}

export const createPairingCode = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data: { companyId: string; label: string }) =>
    z.object({
      companyId: z.string().uuid(),
      label: z.string().trim().min(1).max(120),
    }).parse(data),
  )
  .handler(async ({ data, context }): Promise<PairingCode> => {
    await assertCompanyAdmin(context.supabase, context.userId, data.companyId);

    // Invalida códigos pendentes antigos da mesma empresa para evitar acúmulo.
    await context.supabase
      .from("print_agent_pairing_codes" as never)
      .update({ consumed_at: new Date().toISOString() } as never)
      .eq("company_id", data.companyId)
      .is("consumed_at", null);

    // Tenta inserir até obter um código único (a constraint parcial garante unicidade entre ativos).
    let lastError: unknown = null;
    for (let attempt = 0; attempt < 6; attempt++) {
      const code = generateCode();
      const { data: row, error } = await context.supabase
        .from("print_agent_pairing_codes" as never)
        .insert({
          company_id: data.companyId,
          code,
          label: data.label,
          created_by: context.userId,
        } as never)
        .select("id,code,label,company_id,expires_at,consumed_at,created_at")
        .single();
      if (!error && row) return row as unknown as PairingCode;
      lastError = error;
    }
    throw new Error(`Falha ao gerar código de pareamento: ${String(lastError)}`);
  });

export const listActivePairingCodes = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data: { companyId: string }) =>
    z.object({ companyId: z.string().uuid() }).parse(data),
  )
  .handler(async ({ data, context }): Promise<PairingCode[]> => {
    await assertCompanyAdmin(context.supabase, context.userId, data.companyId);
    const { data: rows, error } = await context.supabase
      .from("print_agent_pairing_codes" as never)
      .select("id,code,label,company_id,expires_at,consumed_at,created_at")
      .eq("company_id", data.companyId)
      .is("consumed_at", null)
      .gt("expires_at", new Date().toISOString())
      .order("created_at", { ascending: false });
    if (error) throw error;
    return (rows ?? []) as unknown as PairingCode[];
  });
