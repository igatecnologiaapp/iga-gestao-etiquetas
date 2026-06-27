// FASE 16 — Endpoint público de troca: o Print Agent envia o código de 6 dígitos
// digitado pelo operador e recebe de volta um token permanente.
//
// Segurança:
//  - Endpoint público (sem auth) porque o agente ainda não tem credenciais —
//    a proteção é o próprio código (6 dígitos, uso único, validade 10 min).
//  - Validação rigorosa de entrada (Zod) e rate limit implícito via expiração.
//  - O token bruto é retornado UMA ÚNICA VEZ; o banco guarda apenas o hash SHA-256.
//  - Usa supabaseAdmin (service role) porque o consumo precisa contornar RLS,
//    já que o agente não está autenticado como usuário.

import { createFileRoute } from "@tanstack/react-router";
import { createHash, randomBytes } from "node:crypto";
import { z } from "zod";

const BodySchema = z.object({
  code: z.string().regex(/^\d{6}$/),
  device_id: z.string().trim().min(1).max(80).optional(),
  device_name: z.string().trim().min(1).max(120).optional(),
  agent_version: z.string().trim().max(40).optional(),
});

function jsonError(message: string, status: number, code?: string) {
  return new Response(JSON.stringify({ ok: false, error: message, code }), {
    status,
    headers: { "content-type": "application/json" },
  });
}

export const Route = createFileRoute("/api/public/print-agent/exchange")({
  server: {
    handlers: {
      POST: async ({ request }) => {
        let parsed: z.infer<typeof BodySchema>;
        try {
          const body = await request.json();
          parsed = BodySchema.parse(body);
        } catch {
          return jsonError("Payload inválido", 400, "INVALID_PAYLOAD");
        }

        const { supabaseAdmin } = await import("@/integrations/supabase/client.server");

        // 1) Busca código ativo
        const { data: codeRow, error: codeErr } = await supabaseAdmin
          .from("print_agent_pairing_codes" as never)
          .select("id,company_id,label,expires_at,consumed_at")
          .eq("code", parsed.code)
          .is("consumed_at", null)
          .gt("expires_at", new Date().toISOString())
          .maybeSingle();

        if (codeErr) return jsonError("Erro interno", 500, "INTERNAL");
        if (!codeRow) return jsonError("Código inválido ou expirado", 404, "INVALID_CODE");

        const row = codeRow as unknown as {
          id: string;
          company_id: string;
          label: string;
          expires_at: string;
        };

        // 2) Gera token permanente
        const raw = `pat_${randomBytes(32).toString("hex")}`;
        const prefix = raw.slice(0, 12);
        const hash = createHash("sha256").update(raw, "utf8").digest("hex");
        const finalLabel = parsed.device_name
          ? `${row.label} — ${parsed.device_name}`
          : row.label;

        // 3) Cria pareamento
        const { data: pairing, error: pairErr } = await supabaseAdmin
          .from("print_agent_pairings" as never)
          .insert({
            company_id: row.company_id,
            label: finalLabel.slice(0, 200),
            token_prefix: prefix,
            token_hash: hash,
            device_id: parsed.device_id ?? null,
            device_name: parsed.device_name ?? null,
            agent_version: parsed.agent_version ?? null,
            status: "active",
          } as never)
          .select("id,company_id,label,token_prefix,device_id,device_name,agent_version,created_at")
          .single();

        if (pairErr || !pairing) return jsonError("Falha ao registrar pareamento", 500, "PAIRING_FAILED");

        // 4) Marca código como consumido (uso único)
        await supabaseAdmin
          .from("print_agent_pairing_codes" as never)
          .update({
            consumed_at: new Date().toISOString(),
            pairing_id: (pairing as { id: string }).id,
          } as never)
          .eq("id", row.id);

        return Response.json({
          ok: true,
          token: raw,
          token_prefix: prefix,
          token_length: raw.length,
          paired: true,
          pairing,
          company_id: row.company_id,
        });
      },

      OPTIONS: async () =>
        new Response(null, {
          status: 204,
          headers: {
            "access-control-allow-origin": "*",
            "access-control-allow-methods": "POST, OPTIONS",
            "access-control-allow-headers": "content-type",
          },
        }),
    },
  },
});
