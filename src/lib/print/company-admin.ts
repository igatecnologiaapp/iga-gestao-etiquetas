// FASE 2 (item 2.2) — helper único para validar administrador de empresa.
// Consolida a implementação antes duplicada em pairing.functions.ts e
// pairing-codes.functions.ts. Mantém contrato idêntico (mesmos RPCs,
// mesmos códigos de erro) para não alterar segurança nem permissões.

import type { SupabaseClient } from "@supabase/supabase-js";

/**
 * Garante que o usuário atual seja administrador global OU administrador da
 * empresa alvo. Lança "Forbidden: requires administrator role" caso contrário.
 *
 * Uso restrito a server functions do módulo de impressão. Não expõe roles;
 * apenas dispara o erro que já era usado nas versões anteriores.
 */
export async function assertCompanyAdmin(
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
