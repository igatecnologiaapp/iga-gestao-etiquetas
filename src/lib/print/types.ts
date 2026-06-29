// FASE 3/4 — Tipos compartilhados dos serviços de impressão.
// Tipagem mantida explícita aqui porque print_queue / printer_layout_compatibility /
// print_agent_pairings ainda não estão refletidas nos types gerados do Supabase.

export type PrinterType =
  | "termica"
  | "laser"
  | "inkjet"
  | "matricial"
  | "pdf"
  | "grafica_externa"
  | "bobina_continua"
  | "etiqueta_adesiva";

export type PrinterStatus = "ativo" | "inativo" | "arquivado";

export interface PrinterConfig {
  id: string;
  company_id: string;
  name: string;
  manufacturer: string | null;
  model: string | null;
  printer_type: PrinterType | null;
  location: string | null;
  max_width: number | null;
  max_height: number | null;
  dpi: number | null;
  paper_type: string | null;
  ribbon_type: string | null;
  connection_type: string | null;
  is_default: boolean;
  notes: string | null;
  status: PrinterStatus;
  // Campos da FASE 2:
  driver_name: string | null;
  agent_printer_id: string | null;
  raw_language: string | null;
  speed: number | null;
  rotation: number;
  auto_cut: boolean;
  label_advance: number | null;
  offset_x: number;
  offset_y: number;
  scale: number;
  margin_top: number;
  margin_right: number;
  margin_bottom: number;
  margin_left: number;
  created_at: string;
  updated_at: string;
}

export type PrinterInput = Partial<Omit<PrinterConfig, "id" | "created_at" | "updated_at">> & {
  name: string;
};

export type PrintJobStatus =
  | "pending"
  | "sent"
  | "printing"
  | "completed"
  | "failed"
  | "canceled";

export type PrintJobSource = "print_agent" | "pdf_fallback" | "manual";

export interface PrintQueueJob {
  id: string;
  company_id: string;
  branch_id: string | null;
  user_id: string | null;
  printer_id: string | null;
  layout_id: string | null;
  product_id: string | null;
  batch_id: string | null;
  quantity: number;
  status: PrintJobStatus;
  source: PrintJobSource;
  payload: Record<string, unknown>;
  agent_job_id: string | null;
  error_message: string | null;
  attempts: number;
  started_at: string | null;
  finished_at: string | null;
  created_at: string;
  updated_at: string;
}

export interface NewPrintJob {
  company_id: string;
  branch_id?: string | null;
  printer_id?: string | null;
  layout_id?: string | null;
  product_id?: string | null;
  batch_id?: string | null;
  quantity?: number;
  source?: PrintJobSource;
  payload?: Record<string, unknown>;
}

// ===== Print Agent (contrato local — FASE 4) =====

/**
 * Códigos de erro padronizados retornados pelo Print Agent.
 * Espelhados em docs/PRINT_AGENT_PROTOCOL.md.
 */
export type AgentErrorCode =
  | "AGENT_OFFLINE"
  | "TIMEOUT"
  | "UNAUTHORIZED"
  | "FORBIDDEN_ORIGIN"
  | "INVALID_TOKEN"
  | "MISSING_TOKEN"
  | "NOT_PAIRED"
  | "TOKEN_EXPIRED"
  | "COMPANY_ID_MISMATCH"
  | "DEVICE_ID_MISMATCH"
  | "PRINTER_NOT_FOUND"
  | "PRINTER_OFFLINE"
  | "INVALID_PAYLOAD"
  | "JOB_NOT_FOUND"
  | "JOB_NOT_CANCELABLE"
  | "INTERNAL_ERROR";


export interface AgentErrorBody {
  code: AgentErrorCode;
  message?: string;
  error?: string;
  details?: Record<string, unknown>;
}

export interface AgentHealth {
  ok: boolean;
  version?: string;
  status?: string;
  reachable: boolean;
  connected?: boolean;
  paired?: boolean;
  token_valid?: boolean | null;
  token_prefix?: string | null;
  token_length?: number | null;
  company_id?: string | null;
  device_id?: string | null;
  device_name?: string | null;
  port?: number;
  service?: Record<string, unknown>;
  profile?: Record<string, unknown>;
  error?: string;
  code?: AgentErrorCode;
}

export interface AgentTokenDiagnostic {
  present: boolean;
  prefix: string | null;
  suffix: string | null;
  length: number;
}

export interface AgentDiagnosticStep {
  key: string;
  label: string;
  ok: boolean;
  status?: string;
  message?: string;
  details?: Record<string, unknown>;
}

export interface AgentDiagnosticsReport {
  ok: boolean;
  generated_at: string;
  version?: string;
  base_url?: string;
  port?: number;
  health?: AgentHealth | null;
  agent_json?: Record<string, unknown> | null;
  service?: Record<string, unknown> | null;
  auth?: {
    token_found: AgentTokenDiagnostic;
    token_sent: AgentTokenDiagnostic;
    token_expected: AgentTokenDiagnostic;
    company_id_sent: string | null;
    company_id_expected: string | null;
    device_id_expected: string | null;
    validation_result: string;
    failure_reason: string | null;
    token_valid: boolean | null;
  };
  exchange?: Record<string, unknown> | null;
  printers_check?: {
    ok: boolean;
    status: number;
    code?: AgentErrorCode | string;
    message?: string;
    count?: number;
    printers?: AgentPrinter[];
    details?: Record<string, unknown>;
  };
  steps: AgentDiagnosticStep[];
}


export interface AgentPrinter {
  id: string;
  name: string;
  driver?: string;
  port?: string;
  default?: boolean;
  status?: "online" | "offline" | "unknown";
}

export interface AgentPrintRequest {
  printerId: string;
  copies: number;
  // Conteúdo bruto (ZPL/EPL/TSPL) OU PDF base64 — Agent decide pelo driver.
  raw?: string;
  pdfBase64?: string;
  jobName?: string;
  language?: string;
  metadata?: Record<string, unknown>;
}

export interface AgentPrintResponse {
  jobId: string;
  ok?: boolean;
  endpoint?: string;
  status?: string;
  printerId?: string;
  rawBytes?: number;
  language?: string | null;
  copies?: number;
  spooler?: Record<string, unknown>;
}

export interface AgentJobStatus {
  jobId: string;
  status: PrintJobStatus;
  error?: string;
  code?: AgentErrorCode;
}

export interface AgentCancelResponse {
  jobId: string;
  canceled: boolean;
  code?: AgentErrorCode;
  message?: string;
}

// ===== Pareamento (registro persistido — sem o token bruto) =====

export type PairingStatus = "active" | "revoked";

export interface PrintAgentPairing {
  id: string;
  company_id: string;
  label: string;
  token_prefix: string;
  status: PairingStatus;
  created_by: string | null;
  revoked_by: string | null;
  revoked_at: string | null;
  last_seen_at: string | null;
  last_seen_ip: string | null;
  created_at: string;
  updated_at: string;
}

/** Retorno único contendo o token bruto — exibido apenas uma vez. */
export interface PrintAgentPairingCreated {
  pairing: PrintAgentPairing;
  token: string;
}
