// FASE 6 — Compatibilidade impressora x layout
// Wrapper sobre printer_layout_compatibility respeitando RLS.

import { supabase } from "@/integrations/supabase/client";

export interface CompatibilityRow {
  id: string;
  company_id: string;
  printer_id: string;
  layout_id: string | null;
  format_id: string | null;
  notes: string | null;
  created_at: string;
  updated_at: string;
}

export interface CompatibilityWithLayout extends CompatibilityRow {
  layout?: {
    id: string;
    name: string;
    label_type: string | null;
    format_id: string | null;
    status: string;
  } | null;
}

const table = () => (supabase.from("printer_layout_compatibility" as any) as any);

export const PrinterCompatibilityService = {
  async listByPrinter(printerId: string): Promise<CompatibilityWithLayout[]> {
    const { data, error } = await table()
      .select("*, layout:label_layouts(id,name,label_type,format_id,status)")
      .eq("printer_id", printerId)
      .order("created_at", { ascending: false });
    if (error) throw new Error(error.message);
    return (data ?? []) as CompatibilityWithLayout[];
  },

  async listByLayout(layoutId: string): Promise<CompatibilityRow[]> {
    const { data, error } = await table()
      .select("*")
      .eq("layout_id", layoutId)
      .order("created_at", { ascending: false });
    if (error) throw new Error(error.message);
    return (data ?? []) as CompatibilityRow[];
  },

  async link(input: {
    company_id: string;
    printer_id: string;
    layout_id?: string | null;
    format_id?: string | null;
    notes?: string | null;
  }): Promise<CompatibilityRow> {
    const { data, error } = await table()
      .insert({
        company_id: input.company_id,
        printer_id: input.printer_id,
        layout_id: input.layout_id ?? null,
        format_id: input.format_id ?? null,
        notes: input.notes ?? null,
      })
      .select("*")
      .single();
    if (error) throw new Error(error.message);
    return data as CompatibilityRow;
  },

  async unlink(id: string): Promise<void> {
    const { error } = await table().delete().eq("id", id);
    if (error) throw new Error(error.message);
  },
};
