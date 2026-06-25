// FASE 3 — PrinterService
// CRUD/consulta de impressoras (printer_configs).
// Toda chamada passa pelo cliente Supabase autenticado → RLS aplica
// (policies já existentes: pc select members / insert|update admin sup / delete admin).
//
// Não duplica a UI existente em src/routes/app.printers.tsx; é um wrapper reutilizável
// para o restante do módulo de impressão (Print Agent, Queue, Telas futuras).

import { supabase } from "@/integrations/supabase/client";
import type { PrinterConfig, PrinterInput, PrinterStatus } from "./types";

type Row = PrinterConfig;
// O cliente tipado ainda não possui as novas colunas; usamos cast pontual
// (mesmo padrão de src/routes/app.printers.tsx).
const table = () => (supabase.from("printer_configs" as any) as any);

export interface ListPrintersOptions {
  status?: PrinterStatus | "all";
  includeAgentOnly?: boolean; // filtra por agent_printer_id IS NOT NULL
}

export const PrinterService = {
  async list(companyId: string, opts: ListPrintersOptions = {}): Promise<Row[]> {
    let q = table().select("*").eq("company_id", companyId).order("name");
    if (opts.status && opts.status !== "all") q = q.eq("status", opts.status);
    if (opts.includeAgentOnly) q = q.not("agent_printer_id", "is", null);
    const { data, error } = await q;
    if (error) throw new Error(error.message);
    return (data ?? []) as Row[];
  },

  async getById(id: string): Promise<Row | null> {
    const { data, error } = await table().select("*").eq("id", id).maybeSingle();
    if (error) throw new Error(error.message);
    return (data ?? null) as Row | null;
  },

  async getDefault(companyId: string): Promise<Row | null> {
    const { data, error } = await table()
      .select("*")
      .eq("company_id", companyId)
      .eq("is_default", true)
      .eq("status", "ativo")
      .maybeSingle();
    if (error) throw new Error(error.message);
    return (data ?? null) as Row | null;
  },

  async create(input: PrinterInput & { company_id: string }): Promise<Row> {
    const { data, error } = await table().insert(input).select("*").single();
    if (error) throw new Error(error.message);
    return data as Row;
  },

  async update(id: string, patch: Partial<PrinterInput>): Promise<Row> {
    const { data, error } = await table().update(patch).eq("id", id).select("*").single();
    if (error) throw new Error(error.message);
    return data as Row;
  },

  async setStatus(id: string, status: PrinterStatus): Promise<void> {
    const { error } = await table().update({ status }).eq("id", id);
    if (error) throw new Error(error.message);
  },

  async setDefault(id: string, companyId: string): Promise<void> {
    // Desmarca os demais primeiro para garantir unicidade lógica.
    const off = await table()
      .update({ is_default: false })
      .eq("company_id", companyId)
      .eq("is_default", true);
    if (off.error) throw new Error(off.error.message);
    const { error } = await table().update({ is_default: true }).eq("id", id);
    if (error) throw new Error(error.message);
  },

  async remove(id: string): Promise<void> {
    const { error } = await table().delete().eq("id", id);
    if (error) throw new Error(error.message);
  },
};

export type { PrinterConfig, PrinterInput };
