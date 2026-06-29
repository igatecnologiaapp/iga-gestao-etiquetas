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

import { renderWithAdapter } from "./drivers";
import { normalizeRawLanguage, rawSize, toDriverLanguage } from "./drivers/raw-commands";
import { buildDimensionalPayload, validateLayoutDimensions } from "./layout-engine";
import { PrintAgentError, PrintAgentOfflineError, type PrintAgentClient } from "./print-agent-client";
import { PrintQueueService } from "./print-queue-service";
import { validateTechnicalConfig } from "./printer-config-validation";
import { guardPrintPayload, sanitizeErrorMessage, sanitizePayload } from "./security";
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
  endpoint?: string;
  status?: number;
  printerIdSent?: string;
  rawBytes?: number;
  language?: string | null;
  copies?: number;
  debug?: Record<string, unknown>;
  queueJob?: PrintQueueJob | null;
}

export function getEffectiveAgentPrinterId(printer: PrinterConfig): string {
  return (printer.agent_printer_id ?? "").trim();
}

export function validateDirectPrint(input: DirectPrintInput): ValidationResult {
  const errors: string[] = [];
  if (!input.companyId) errors.push("Empresa não selecionada.");
  if (!input.productId) errors.push("Produto não selecionado.");
  if (!input.printer) errors.push("Impressora não selecionada.");
  else {
    if (input.printer.status !== "ativo") errors.push("Impressora selecionada está inativa.");
    if (!getEffectiveAgentPrinterId(input.printer)) {
      errors.push(
        "Esta impressora ainda não foi vinculada ao agente local (agent_printer_id). Acesse Configurações → Impressoras → Assistente de Configuração para detectar e vincular a impressora instalada.",
      );
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
  const language = normalizeRawLanguage(p.raw_language, p.driver_name, p.manufacturer, p.model);
  const adapterPrinter = {
    ...input.printer,
    raw_language: toDriverLanguage(language),
    __layout_elements: input.layout.elements,
  } as PrinterConfig;
  const dimensional = buildDimensionalPayload(input.layout, adapterPrinter);
  // FASE 13 — seleciona adapter por linguagem/fabricante e gera saída controlada.
  const adapter = renderWithAdapter(adapterPrinter, {
    printer: adapterPrinter,
    dimensional,
    label: input.labelData,
    copies: input.quantity,
    jobName: input.layout.name,
  });
  const effectiveRaw = adapter.output.raw ?? null;
  return {
    company_id: input.companyId,
    branch_id: input.branchId ?? null,
    product_id: input.productId,
    layout_id: input.layout.id,
    printer_id: p.id,
    printer: {
      name: p.name,
      manufacturer: p.manufacturer ?? null,
      model: p.model ?? null,
      driver: p.driver_name ?? null,
      agent_printer_id: p.agent_printer_id ?? null,
      raw_language: p.raw_language ?? "driver",
      effective_raw_language: language ?? adapter.selection.effective,
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
    dimensional,
    adapter: {
      requested_language: adapter.selection.requested,
      effective_language: adapter.selection.effective,
      normalized_language: language,
      fallback_used: adapter.selection.fallbackUsed,
      reason: adapter.selection.reason ?? null,
      maturity: adapter.output.maturity,
      kind: adapter.output.kind,
      warnings: adapter.output.warnings,
      errors: adapter.errors,
    },
    raw: effectiveRaw,
    raw_summary: {
      present: !!effectiveRaw,
      bytes: rawSize(effectiveRaw),
      language: language ?? adapter.selection.effective,
      starts_with: effectiveRaw ? effectiveRaw.slice(0, 24) : null,
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

export function buildAgentSubmitRequest(input: DirectPrintInput, payload = buildAgentPayload(input)) {
  const printerId = getEffectiveAgentPrinterId(input.printer);
  const raw = (payload as any).raw as string | null | undefined;
  const language = ((payload as any).adapter?.normalized_language ?? (payload as any).adapter?.effective_language ?? null) as string | null;
  return {
    endpoint: "/print",
    request: {
      printerId,
      copies: input.quantity,
      jobName: `${input.layout.name} (${input.quantity})`,
      raw: raw ?? undefined,
      language: language ?? undefined,
      metadata: {
        company_id: input.companyId,
        layout_id: input.layout.id,
        printer_config_id: input.printer.id,
        agent_printer_id: printerId,
        raw_bytes: rawSize(raw),
        language,
        adapter: (payload as any).adapter,
      },
    },
    debug: {
      endpoint: "/print",
      printerIdSent: printerId,
      rawBytes: rawSize(raw),
      language,
      copies: input.quantity,
      jobName: `${input.layout.name} (${input.quantity})`,
      rawPresent: !!raw,
      rawPreview: raw ? raw.slice(0, 120) : null,
    },
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
      debug: { validation_errors: validation.errors },
    };
  }
  const rawPayload = buildAgentPayload(input);
  const submitSpec = buildAgentSubmitRequest(input, rawPayload);
  if (!submitSpec.request.raw || submitSpec.debug.rawBytes === 0) {
    return {
      ok: false,
      fallback: false,
      errorCode: "VALIDATION",
      errorMessage: "Comando RAW não foi gerado. Selecione a linguagem da impressora (ZPL, EPL, PPLA, PPLB, TSPL, ESC/POS ou Windows GDI/texto) e teste novamente.",
      ...submitSpec.debug,
      debug: submitSpec.debug,
    } as DirectPrintResult;
  }
  // FASE 14 — hardening: guard duro antes de qualquer side-effect.
  const guardErrors = guardPrintPayload({
    company_id: input.companyId,
    printer_id: input.printer.id,
    layout_id: input.layout.id,
    product_id: input.productId,
    quantity: input.quantity,
    dimensional: (rawPayload as any).dimensional,
  });
  if (guardErrors.length > 0) {
    return {
      ok: false,
      fallback: false,
      errorCode: "VALIDATION",
      errorMessage: guardErrors.join(" "),
    };
  }
  // Sanitiza payload antes de persistir (defesa em profundidade — nunca grava token/segredo).
  const queuePayload = sanitizePayload({
    ...rawPayload,
    raw: undefined,
    direct_print_request: {
      endpoint: submitSpec.endpoint,
      printerId: submitSpec.request.printerId,
      copies: submitSpec.request.copies,
      jobName: submitSpec.request.jobName,
      language: submitSpec.request.language ?? null,
      rawBytes: submitSpec.debug.rawBytes,
      rawPreview: submitSpec.debug.rawPreview,
    },
  });

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
      payload: queuePayload,
    });
  } catch (e: any) {
    return {
      ok: false,
      fallback: true,
      fallbackReason: "Não foi possível registrar o job de impressão.",
      errorCode: "ENQUEUE_FAILED",
      errorMessage: sanitizeErrorMessage(e),
      ...submitSpec.debug,
      debug: { ...submitSpec.debug, enqueue_error: sanitizeErrorMessage(e) },
    };
  }

  // 2. Submete ao agente
  try {
    const res = await client.submit({
      ...submitSpec.request,
      metadata: { ...submitSpec.request.metadata, queue_id: job.id },
    });
    await PrintQueueService.markSent(job.id, res.jobId);
    // O agente já confirmou o envio. Marcamos como completed para o caso síncrono;
    // implementações reais podem fazer polling em /jobs/{id} (fora do escopo desta fase).
    await PrintQueueService.updateStatus(job.id, "completed", { agent_job_id: res.jobId } as any);
    return { ok: true, jobId: job.id, agentJobId: res.jobId, queueJob: job, ...submitSpec.debug, debug: { ...submitSpec.debug, response: res } };
  } catch (e: any) {
    const offline = e instanceof PrintAgentOfflineError;
    const agentErr = e instanceof PrintAgentError ? e : null;
    const code = (agentErr?.code ?? (offline ? e.code : "INTERNAL_ERROR")) as AgentErrorCode;
    const msg = sanitizeErrorMessage(e?.message ?? "Falha de impressão direta");
    const status = agentErr?.status;
    const details = sanitizePayload(agentErr?.details ?? {});
    const detailed = `endpoint=${submitSpec.endpoint}; status=${status ?? "network"}; code=${code}; printerId=${submitSpec.request.printerId}; rawBytes=${submitSpec.debug.rawBytes}; language=${submitSpec.debug.language ?? "—"}; copies=${submitSpec.debug.copies}; message=${msg}`;
    await PrintQueueService.recordFailure(job.id, detailed).catch(() => undefined);
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
      errorMessage: detailed,
      endpoint: submitSpec.endpoint,
      status,
      printerIdSent: submitSpec.request.printerId,
      rawBytes: submitSpec.debug.rawBytes,
      language: submitSpec.debug.language as string | null,
      copies: submitSpec.debug.copies as number,
      debug: { ...submitSpec.debug, status, code, message: msg, details, stack: e?.stack ? sanitizeErrorMessage(e.stack, 1000) : null },
      queueJob: job,
    };
  }
}
