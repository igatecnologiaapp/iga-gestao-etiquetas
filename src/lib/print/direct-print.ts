// FASE 7 — Orquestrador de impressão direta.
// Responsável por:
//   1. Validar entradas (impressora, layout, compatibilidade, config técnica)
//   2. Montar payload completo conforme contrato (FASE 4)
//   3. Criar registro em print_queue
//   4. Enviar ao PrintAgentClient e refletir o status no banco
//   5. Sinalizar fallback quando o agente estiver offline / sem token / falhar
//
// NÃO altera label-pdf.ts nem o fluxo PDF. O caller pode invocar PDF como
// fallback quando `result.fallback === true`.

import { buildDimensionalPayload, validateLayoutDimensions } from "./layout-engine";
import { PrintAgentError, PrintAgentOfflineError, type PrintAgentClient } from "./print-agent-client";
import { PrintQueueService } from "./print-queue-service";
import { validateTechnicalConfig } from "./printer-config-validation";
import type { AgentErrorCode, PrinterConfig, PrintQueueJob } from "./types";

export type LayoutSnapshot = {
  id: string;
  name: string;
  status: string;
  label_type?: string | null;
  format: {
    id?: string;
    width: number;
    height: number;
    unit: string;
    margin_top: number;
    margin_right: number;
    margin_bottom: number;
    margin_left: number;
    orientation?: string;
  } | null;
  elements: Array<{ id: string; element_type: string; x: number; y: number; width: number; height: number } & Record<string, unknown>>;
};

export interface DirectPrintInput {
  companyId: string;
  branchId?: string | null;
  productId: string;
  layout: LayoutSnapshot;
  printer: PrinterConfig;
  quantity: number;
  /** Lista de IDs de layouts compatíveis com a impressora — string vazia/array vazio = sem restrição. */
  compatibleLayoutIds?: string[];
  /** Dados da etiqueta já resolvidos (mesmo objeto usado no preview/PDF). */
  labelData: Record<string, unknown>;
  /** Origem (default = print_agent). */
  source?: "print_agent" | "pdf_fallback";
  /** Identificador opcional do print_batch ao qual o job pertence. */
  batchId?: string | null;
}

export interface ValidationResult {
  ok: boolean;
  errors: string[];
}

export interface DirectPrintResult {
  ok: boolean;
  jobId?: string;
  agentJobId?: string;
  fallback?: boolean;
  fallbackReason?: string;
  errorCode?: AgentErrorCode | "VALIDATION" | "ENQUEUE_FAILED" | "UNKNOWN";
  errorMessage?: string;
  queueJob?: PrintQueueJob | null;
}

export function validateDirectPrint(input: DirectPrintInput): ValidationResult {
  const errors: string[] = [];
  if (!input.companyId) errors.push("Empresa não selecionada.");
  if (!input.productId) errors.push("Produto não selecionado.");
  if (!input.printer) errors.push("Impressora não selecionada.");
  else {
    if (input.printer.status !== "ativo") errors.push("Impressora selecionada está inativa.");
    if (!input.printer.agent_printer_id) {
      errors.push("Impressora sem identificador do agente (agent_printer_id). Configure em Impressoras.");
    }
    errors.push(
      ...validateTechnicalConfig({
        dpi: input.printer.dpi,
        speed: input.printer.speed,
        scale: input.printer.scale,
        margin_top: input.printer.margin_top,
        margin_right: input.printer.margin_right,
        margin_bottom: input.printer.margin_bottom,
        margin_left: input.printer.margin_left,
        rotation: input.printer.rotation,
        auto_cut: input.printer.auto_cut,
        label_advance: input.printer.label_advance,
        offset_x: input.printer.offset_x,
        offset_y: input.printer.offset_y,
        raw_language: (input.printer.raw_language as any) ?? null,
      }),
    );
  }
  if (!input.layout) {
    errors.push("Layout não selecionado.");
  } else {
    if (input.layout.status !== "ativo") errors.push("Layout selecionado está inativo.");
    if (input.printer) {
      const dim = validateLayoutDimensions(input.layout, input.printer);
      errors.push(...dim.errors);
    }
  }
  if (input.printer && input.layout && (input.compatibleLayoutIds?.length ?? 0) > 0) {
    if (!input.compatibleLayoutIds!.includes(input.layout.id)) {
      errors.push("Layout não é compatível com a impressora selecionada.");
    }
  }
  if (!Number.isFinite(input.quantity) || input.quantity <= 0 || input.quantity > 5000) {
    errors.push("Quantidade inválida (1 a 5000).");
  }
  return { ok: errors.length === 0, errors };
}

export function buildAgentPayload(input: DirectPrintInput) {
  const p = input.printer;
  const fmt = input.layout.format!;
  return {
    company_id: input.companyId,
    branch_id: input.branchId ?? null,
    product_id: input.productId,
    layout_id: input.layout.id,
    printer_id: p.id,
    printer: {
      name: p.name,
      driver: p.driver_name ?? null,
      agent_printer_id: p.agent_printer_id ?? null,
      raw_language: p.raw_language ?? "driver",
      dpi: p.dpi ?? null,
      speed: p.speed ?? null,
      auto_cut: p.auto_cut,
      label_advance: p.label_advance ?? null,
    },
    quantity: input.quantity,
    geometry: {
      width: fmt.width,
      height: fmt.height,
      unit: fmt.unit,
      orientation: fmt.orientation ?? "portrait",
      scale: p.scale,
      rotation: p.rotation,
      offset_x: p.offset_x,
      offset_y: p.offset_y,
      margins: {
        top: p.margin_top,
        right: p.margin_right,
        bottom: p.margin_bottom,
        left: p.margin_left,
      },
    },
    label: input.labelData,
    layout: {
      id: input.layout.id,
      name: input.layout.name,
      label_type: input.layout.label_type ?? null,
      elements: input.layout.elements,
    },
    origin: "lovable.print-labels",
    source: input.source ?? "print_agent",
    batch_id: input.batchId ?? null,
  };
}

export async function runDirectPrint(
  client: PrintAgentClient,
  input: DirectPrintInput,
): Promise<DirectPrintResult> {
  const validation = validateDirectPrint(input);
  if (!validation.ok) {
    return {
      ok: false,
      fallback: false,
      errorCode: "VALIDATION",
      errorMessage: validation.errors.join(" "),
    };
  }
  const payload = buildAgentPayload(input);

  // 1. Enfileira (cria registro auditável antes mesmo do envio)
  let job: PrintQueueJob;
  try {
    job = await PrintQueueService.enqueue({
      company_id: input.companyId,
      branch_id: input.branchId ?? null,
      printer_id: input.printer.id,
      layout_id: input.layout.id,
      product_id: input.productId,
      batch_id: input.batchId ?? null,
      quantity: input.quantity,
      source: "print_agent",
      payload,
    });
  } catch (e: any) {
    return {
      ok: false,
      fallback: true,
      fallbackReason: "Não foi possível registrar o job de impressão.",
      errorCode: "ENQUEUE_FAILED",
      errorMessage: e?.message ?? String(e),
    };
  }

  // 2. Submete ao agente
  try {
    const res = await client.submit({
      printerId: input.printer.agent_printer_id ?? input.printer.id,
      copies: input.quantity,
      jobName: `${input.layout.name} (${input.quantity})`,
      metadata: { queue_id: job.id, company_id: input.companyId },
    });
    await PrintQueueService.markSent(job.id, res.jobId);
    // O agente já confirmou o envio. Marcamos como completed para o caso síncrono;
    // implementações reais podem fazer polling em /jobs/{id} (fora do escopo desta fase).
    await PrintQueueService.updateStatus(job.id, "completed", { agent_job_id: res.jobId } as any);
    return { ok: true, jobId: job.id, agentJobId: res.jobId, queueJob: job };
  } catch (e: any) {
    const offline = e instanceof PrintAgentOfflineError;
    const agentErr = e instanceof PrintAgentError ? e : null;
    const code = (agentErr?.code ?? (offline ? e.code : "INTERNAL_ERROR")) as AgentErrorCode;
    const msg = e?.message ?? "Falha de impressão direta";
    await PrintQueueService.recordFailure(job.id, `[${code}] ${msg}`).catch(() => undefined);
    return {
      ok: false,
      jobId: job.id,
      fallback: true,
      fallbackReason: offline
        ? "Print Agent offline ou inacessível."
        : code === "UNAUTHORIZED" || code === "INVALID_TOKEN" || code === "MISSING_TOKEN"
          ? "Token de pareamento ausente ou inválido."
          : "Falha ao enviar para o Print Agent.",
      errorCode: code,
      errorMessage: msg,
      queueJob: job,
    };
  }
}
