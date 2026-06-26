// FASE 14 — Sanitização de payloads, mensagens e estruturas exportadas do
// módulo de impressão.
//
// Defesa em profundidade: as RLS já isolam dados por empresa e o token de
// pareamento nunca é persistido em claro. Estas utilidades garantem que,
// mesmo se um caller inadvertidamente injetar credenciais no payload ou em
// uma mensagem de erro, nada vaza para o banco, para a UI ou para o CSV.

/** Chaves cujo conteúdo NUNCA pode ser persistido/exibido em claro. */
const SENSITIVE_KEYS = new Set<string>([
  "token",
  "access_token",
  "authorization",
  "Authorization",
  "bearer",
  "secret",
  "password",
  "api_key",
  "apiKey",
  "service_role_key",
  "token_hash",
  "x-company-id-token",
]);

const TOKEN_PATTERN = /\b(pat_[A-Za-z0-9]{8,})\b/g;
const BEARER_PATTERN = /Bearer\s+[A-Za-z0-9._-]+/gi;
const JWT_PATTERN = /\beyJ[A-Za-z0-9_-]{10,}\.[A-Za-z0-9_-]{10,}\.[A-Za-z0-9_-]{10,}\b/g;

/** Aplica máscara genérica em strings que aparentem conter segredos. */
export function maskSecretsInString(input: string): string {
  if (!input) return input;
  return input
    .replace(BEARER_PATTERN, "Bearer ***")
    .replace(TOKEN_PATTERN, (m) => `${m.slice(0, 8)}***`)
    .replace(JWT_PATTERN, "***");
}

/** Mensagem de erro segura para registrar/exibir. Truncada a 500 chars. */
export function sanitizeErrorMessage(msg: unknown, max = 500): string {
  const raw = typeof msg === "string" ? msg : msg instanceof Error ? msg.message : String(msg ?? "");
  return maskSecretsInString(raw).slice(0, max);
}

/**
 * Remove recursivamente quaisquer chaves sensíveis e mascara segredos
 * embutidos em strings. Retorna uma cópia — não muta o input.
 *
 * Profundidade limitada para evitar payloads patológicos.
 */
export function sanitizePayload<T>(value: T, depth = 0): T {
  if (depth > 8) return null as unknown as T;
  if (value == null) return value;
  if (typeof value === "string") return maskSecretsInString(value) as unknown as T;
  if (typeof value !== "object") return value;
  if (Array.isArray(value)) return value.map((v) => sanitizePayload(v, depth + 1)) as unknown as T;
  const out: Record<string, unknown> = {};
  for (const [k, v] of Object.entries(value as Record<string, unknown>)) {
    if (SENSITIVE_KEYS.has(k)) continue;
    if (k.toLowerCase().includes("token") || k.toLowerCase().includes("secret")) continue;
    out[k] = sanitizePayload(v, depth + 1);
  }
  return out as unknown as T;
}

/** Validações duras de payload antes de persistir/enviar ao agente. */
export interface PayloadGuardInput {
  company_id?: unknown;
  user_id?: unknown;
  printer_id?: unknown;
  layout_id?: unknown;
  product_id?: unknown;
  quantity?: unknown;
  dimensional?: { dpi?: unknown; width_mm?: unknown; height_mm?: unknown; rotation?: unknown } | null;
}

const UUID_REGEX = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const ALLOWED_ROTATIONS = new Set([0, 90, 180, 270]);

export function guardPrintPayload(input: PayloadGuardInput): string[] {
  const errs: string[] = [];
  // IDs aceitam qualquer string não vazia — a unicidade/escopo é garantida por RLS.
  // UUIDs malformados ainda são detectados pela coerção do Postgres.
  const idOk = (v: unknown) => typeof v === "string" && v.trim().length > 0;
  if (!idOk(input.company_id)) errs.push("company_id obrigatório.");
  if (input.user_id != null && !idOk(input.user_id)) errs.push("user_id inválido.");
  if (input.printer_id != null && !idOk(input.printer_id)) errs.push("printer_id inválido.");
  if (input.layout_id != null && !idOk(input.layout_id)) errs.push("layout_id inválido.");
  if (input.product_id != null && !idOk(input.product_id)) errs.push("product_id inválido.");
  const q = Number(input.quantity);
  if (!Number.isFinite(q) || q <= 0 || q > 5000) errs.push("Quantidade inválida (1–5000).");
  const dim = input.dimensional ?? null;
  if (dim) {
    const dpi = Number(dim.dpi);
    if (!Number.isFinite(dpi) || dpi <= 0 || dpi > 2400) errs.push("DPI inválido (1–2400).");
    const w = Number(dim.width_mm), h = Number(dim.height_mm);
    if (!Number.isFinite(w) || w <= 0 || w > 5000) errs.push("Largura física inválida.");
    if (!Number.isFinite(h) || h <= 0 || h > 5000) errs.push("Altura física inválida.");
    const rot = Number(dim.rotation);
    if (!ALLOWED_ROTATIONS.has(rot)) errs.push("Rotação inválida (0,90,180,270).");
  }
  return errs;
}
