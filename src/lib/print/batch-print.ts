// FASE 12 — Orquestrador de Impressão em Lote.
//
// Responsabilidades:
//   1. Receber uma lista de itens (produto + layout + impressora + quantidade).
//   2. Validar individualmente cada item (reusa validateDirectPrint).
//   3. Atribuir um batch_group_id (UUID) compartilhado, registrado no payload
//      de cada job na print_queue para permitir agrupamento auditável.
//   4. Enviar sequencialmente ao Print Agent (sem paralelismo, evitando race
//      no dispositivo físico).
//   5. Para itens que falharem com o agente offline/inacessível, sinalizar
//      fallback PDF — o caller decide se gera PDF item-a-item ou em pacote.
//   6. NÃO altera label-pdf.ts nem o fluxo PDF; não duplica services.
//
// Reusa: runDirectPrint, validateDirectPrint, PrintQueueService, PrintAgentClient.

import {
  runDirectPrint,
  validateDirectPrint,
  type DirectPrintInput,
  type DirectPrintResult,
  type LayoutSnapshot,
} from "./direct-print";
import type { PrintAgentClient } from "./print-agent-client";
import type { PrinterConfig } from "./types";

export type BatchItemStatus =
  | "pending"
  | "validating"
  | "invalid"
  | "ready"
  | "sending"
  | "sent"
  | "failed"
  | "fallback_pdf"
  | "canceled";

export interface BatchPrintItem {
  /** Identificador local estável (uuid client). */
  id: string;
  companyId: string;
  branchId?: string | null;
  productId: string;
  productName?: string;
  printer: PrinterConfig;
  layout: LayoutSnapshot;
  quantity: number;
  compatibleLayoutIds?: string[];
  labelData: Record<string, unknown>;
  notes?: string | null;
}

export interface BatchItemState extends BatchPrintItem {
  status: BatchItemStatus;
  validationErrors: string[];
  result?: DirectPrintResult;
}

export interface BatchPrintProgress {
  total: number;
  done: number;
  itemId: string;
  state: BatchItemState;
}

export interface RunBatchPrintOptions {
  /** Identificador único do lote (UUID). Será propagado em payload.batch_group_id. */
  batchGroupId?: string;
  /** Callback de progresso (item-a-item). */
  onProgress?: (p: BatchPrintProgress) => void;
  /** Se true, interrompe o lote ao primeiro erro fatal (default: false — segue adiante). */
  stopOnError?: boolean;
}

export interface BatchPrintSummary {
  batchGroupId: string;
  total: number;
  validated: number;
  sent: number;
  failed: number;
  fallback: number;
  invalid: number;
  items: BatchItemState[];
}

function makeId(): string {
  if (typeof globalThis.crypto?.randomUUID === "function") return globalThis.crypto.randomUUID();
  return `batch-${Date.now()}-${Math.random().toString(36).slice(2, 10)}`;
}

export function newBatchItem(partial: Partial<BatchPrintItem>): BatchPrintItem {
  return {
    id: partial.id ?? makeId(),
    companyId: partial.companyId ?? "",
    branchId: partial.branchId ?? null,
    productId: partial.productId ?? "",
    productName: partial.productName,
    printer: partial.printer as PrinterConfig,
    layout: partial.layout as LayoutSnapshot,
    quantity: partial.quantity ?? 1,
    compatibleLayoutIds: partial.compatibleLayoutIds ?? [],
    labelData: partial.labelData ?? {},
    notes: partial.notes ?? null,
  };
}

/** Validação individual (sem efeitos colaterais). */
export function validateBatchItem(item: BatchPrintItem): { ok: boolean; errors: string[] } {
  if (!item.printer || !item.layout) {
    return { ok: false, errors: ["Item incompleto (impressora/layout)."] };
  }
  const input: DirectPrintInput = {
    companyId: item.companyId,
    branchId: item.branchId ?? null,
    productId: item.productId,
    printer: item.printer,
    layout: item.layout,
    quantity: item.quantity,
    compatibleLayoutIds: item.compatibleLayoutIds,
    labelData: item.labelData,
  };
  return validateDirectPrint(input);
}

/** Valida todos os itens. Retorna estados (status invalid/ready). */
export function validateBatch(items: BatchPrintItem[]): BatchItemState[] {
  return items.map((it) => {
    const v = validateBatchItem(it);
    return {
      ...it,
      status: v.ok ? "ready" : "invalid",
      validationErrors: v.errors,
    };
  });
}

/**
 * Executa o lote: envia cada item ready ao Print Agent, sequencialmente.
 * Itens invalid permanecem invalid; o caller exibe motivos.
 */
export async function runBatchPrint(
  client: PrintAgentClient,
  items: BatchPrintItem[],
  opts: RunBatchPrintOptions = {},
): Promise<BatchPrintSummary> {
  const batchGroupId = opts.batchGroupId ?? makeId();
  const states = validateBatch(items);
  const total = states.length;
  let done = 0;

  for (let i = 0; i < states.length; i++) {
    const state = states[i];
    if (state.status !== "ready") {
      done++;
      opts.onProgress?.({ total, done, itemId: state.id, state });
      continue;
    }
    state.status = "sending";
    opts.onProgress?.({ total, done, itemId: state.id, state });

    const input: DirectPrintInput = {
      companyId: state.companyId,
      branchId: state.branchId ?? null,
      productId: state.productId,
      printer: state.printer,
      layout: state.layout,
      quantity: state.quantity,
      compatibleLayoutIds: state.compatibleLayoutIds,
      labelData: { ...state.labelData, batch_group_id: batchGroupId, batch_item_id: state.id },
    };

    let res: DirectPrintResult;
    try {
      res = await runDirectPrint(client, input);
    } catch (e: any) {
      res = {
        ok: false,
        fallback: true,
        errorCode: "UNKNOWN",
        errorMessage: e?.message ?? String(e),
      };
    }
    state.result = res;
    if (res.ok) state.status = "sent";
    else if (res.fallback) state.status = "fallback_pdf";
    else state.status = "failed";

    done++;
    opts.onProgress?.({ total, done, itemId: state.id, state });

    if (opts.stopOnError && state.status === "failed") break;
  }

  const summary: BatchPrintSummary = {
    batchGroupId,
    total,
    validated: states.filter((s) => s.status !== "invalid").length,
    sent: states.filter((s) => s.status === "sent").length,
    failed: states.filter((s) => s.status === "failed").length,
    fallback: states.filter((s) => s.status === "fallback_pdf").length,
    invalid: states.filter((s) => s.status === "invalid").length,
    items: states,
  };
  return summary;
}

/** Retorna apenas itens com falha/fallback — para botão "Reimprimir falhos". */
export function failedItems(summary: BatchPrintSummary): BatchItemState[] {
  return summary.items.filter((s) => s.status === "failed" || s.status === "fallback_pdf");
}
