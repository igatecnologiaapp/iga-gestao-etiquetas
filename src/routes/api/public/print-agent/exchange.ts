// FASE 1 — Endpoint público de troca de código por token (hardening).
//
// Segurança:
//  - Rate limit por IP (RPC check_pairing_ip_rate_limit): 20 falhas em 15 min => 429.
//  - Consumo atômico do código via RPC consume_pairing_code:
//      valida existência + expiração + tentativas em uma única transação;
//      cria pareamento e marca o código como consumido no mesmo commit;
//      código de 6 dígitos é uso único e não reutilizável.
//  - Após 5 tentativas erradas no MESMO código, o código é automaticamente invalidado.
//  - Resposta genérica ("Código inválido ou expirado") não revela existência do código.
//  - Payload validado com Zod.
//  - Token bruto retornado somente aqui; banco guarda apenas SHA-256.
//  - CORS aberto por método (POST/OPTIONS) porque quem chama é o Print Agent local,
//    não o navegador; o browser não precisa consumir esse endpoint.

import { createFileRoute } from "@tanstack/react-router";
import { createHash, randomBytes } from "node:crypto";
import { z } from "zod";

const BodySchema = z.object({
  code: z.string().regex(/^\d{6}$/),
  device_id: z.string().trim().min(1).max(80).optional(),
  device_name: z.string().trim().min(1).max(120).optional(),
  agent_version: z.string().trim().max(40).optional(),
});

const CORS_HEADERS = {
  "access-control-allow-origin": "*",
  "access-control-allow-methods": "POST, OPTIONS",
  "access-control-allow-headers": "content-type",
  "access-control-max-age": "86400",
} as const;

function jsonError(message: string, status: number, code?: string) {
  return new Response(JSON.stringify({ ok: false, error: message, code }), {
    status,
    headers: { "content-type": "application/json", ...CORS_HEADERS },
  });
}

function extractIp(request: Request): string {
  const h = request.headers;
  const fwd = h.get("x-forwarded-for") || h.get("cf-connecting-ip") || h.get("x-real-ip") || "";
  if (fwd) return fwd.split(",")[0]!.trim().slice(0, 64);
  return "unknown";
}

// Log seguro (nunca expõe token completo, apenas prefixo + IP mascarado)
function maskIp(ip: string): string {
  const parts = ip.split(".");
  if (parts.length === 4) return `${parts[0]}.${parts[1]}.***.***`;
  return ip.slice(0, 8) + "***";
}

export const Route = createFileRoute("/api/public/print-agent/exchange")({
  server: {
    handlers: {
      POST: async ({ request }) => {
        const ip = extractIp(request);

        let parsed: z.infer<typeof BodySchema>;
        try {
          const body = await request.json();
          parsed = BodySchema.parse(body);
        } catch {
          return jsonError("Payload inválido", 400, "INVALID_PAYLOAD");
        }

        const { supabaseAdmin } = await import("@/integrations/supabase/client.server");

        // 1) Rate limit por IP (pré-verifica antes de consultar o código).
        //    Registra a tentativa como "não sucesso" — se tudo der certo depois,
        //    registramos outra entrada de sucesso para reset progressivo.
        const { data: allowed, error: rlErr } = await supabaseAdmin.rpc(
          "check_pairing_ip_rate_limit" as never,
          { _ip: ip, _code: parsed.code, _success: false } as never,
        );
        if (rlErr) {
          console.warn("[pairing.exchange] rate_limit_rpc_error", maskIp(ip));
          return jsonError("Erro interno", 500, "INTERNAL");
        }
        if (allowed === false) {
          console.warn("[pairing.exchange] blocked_by_rate_limit", maskIp(ip));
          return jsonError(
            "Muitas tentativas. Aguarde alguns minutos antes de tentar novamente.",
            429,
            "RATE_LIMITED",
          );
        }

        // 2) Consumo atômico do código (RPC transaciona tudo).
        const raw = `pat_${randomBytes(32).toString("hex")}`;
        const prefix = raw.slice(0, 12);
        const hash = createHash("sha256").update(raw, "utf8").digest("hex");

        const { data: consumeRes, error: consumeErr } = await supabaseAdmin.rpc(
          "consume_pairing_code" as never,
          {
            _code: parsed.code,
            _device_id: parsed.device_id ?? null,
            _device_name: parsed.device_name ?? null,
            _agent_version: parsed.agent_version ?? null,
            _token_prefix: prefix,
            _token_hash: hash,
          } as never,
        );

        if (consumeErr) {
          console.warn("[pairing.exchange] consume_rpc_error", maskIp(ip));
          return jsonError("Erro interno", 500, "INTERNAL");
        }

        const consumed = consumeRes as unknown as
          | { ok: true; pairing_id: string; company_id: string; label: string }
          | { ok: false; code: string };

        if (!consumed?.ok) {
          // Incrementa contador do código (torna o código inutilizável após 5 falhas)
          await supabaseAdmin.rpc("register_pairing_code_failure" as never, {
            _code: parsed.code,
          } as never);
          console.warn(
            "[pairing.exchange] invalid_code_from",
            maskIp(ip),
            "prefix",
            parsed.code.slice(0, 2) + "****",
          );
          return jsonError("Código inválido ou expirado", 404, "INVALID_CODE");
        }

        // 3) Registra sucesso (para auditoria; o rate limit por IP considera só falhas)
        await supabaseAdmin.rpc("check_pairing_ip_rate_limit" as never, {
          _ip: ip,
          _code: parsed.code,
          _success: true,
        } as never);

        console.info(
          "[pairing.exchange] success",
          "company",
          consumed.company_id,
          "pairing",
          consumed.pairing_id,
          "prefix",
          prefix,
          "ip",
          maskIp(ip),
        );

        return new Response(
          JSON.stringify({
            ok: true,
            token: raw,
            token_prefix: prefix,
            token_length: raw.length,
            paired: true,
            pairing: {
              id: consumed.pairing_id,
              company_id: consumed.company_id,
              label: consumed.label,
              token_prefix: prefix,
              device_id: parsed.device_id ?? null,
              device_name: parsed.device_name ?? null,
              agent_version: parsed.agent_version ?? null,
              created_at: new Date().toISOString(),
            },
            company_id: consumed.company_id,
          }),
          { status: 200, headers: { "content-type": "application/json", ...CORS_HEADERS } },
        );
      },

      OPTIONS: async () => new Response(null, { status: 204, headers: CORS_HEADERS }),
    },
  },
});
