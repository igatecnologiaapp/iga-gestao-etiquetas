import { supabase } from "@/integrations/supabase/client";
import jsPDF from "jspdf";

export type ExportColumn<T> = { key: keyof T | string; label: string; format?: (v: any, row: T) => string };

function escapeCsv(v: any): string {
  if (v == null) return "";
  const s = String(v);
  if (/[",\n;]/.test(s)) return `"${s.replace(/"/g, '""')}"`;
  return s;
}

export function downloadBlob(blob: Blob, filename: string) {
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url; a.download = filename; document.body.appendChild(a);
  a.click(); a.remove(); URL.revokeObjectURL(url);
}

export function exportCsv<T>(rows: T[], cols: ExportColumn<T>[], filename: string) {
  const header = cols.map((c) => escapeCsv(c.label)).join(",");
  const body = rows.map((r) =>
    cols.map((c) => {
      const raw = (r as any)[c.key as string];
      const v = c.format ? c.format(raw, r) : raw;
      return escapeCsv(v);
    }).join(","),
  ).join("\n");
  const blob = new Blob(["\ufeff" + header + "\n" + body], { type: "text/csv;charset=utf-8" });
  downloadBlob(blob, filename.endsWith(".csv") ? filename : `${filename}.csv`);
}

export function exportPdf<T>(title: string, rows: T[], cols: ExportColumn<T>[], filename: string) {
  const doc = new jsPDF({ unit: "mm", format: "a4", orientation: "landscape" });
  const pageW = doc.internal.pageSize.getWidth();
  const pageH = doc.internal.pageSize.getHeight();
  const margin = 10;
  doc.setFont("helvetica", "bold"); doc.setFontSize(14);
  doc.text(title, margin, margin + 4);
  doc.setFontSize(8); doc.setFont("helvetica", "normal");
  doc.text(`Gerado em ${new Date().toLocaleString("pt-BR")}`, margin, margin + 9);

  const startY = margin + 14;
  const colW = (pageW - margin * 2) / cols.length;
  let y = startY;
  doc.setFont("helvetica", "bold"); doc.setFontSize(8);
  doc.setFillColor(240, 240, 240);
  doc.rect(margin, y, pageW - margin * 2, 6, "F");
  cols.forEach((c, i) => doc.text(c.label, margin + i * colW + 1, y + 4));
  y += 6;
  doc.setFont("helvetica", "normal");

  rows.forEach((r) => {
    if (y > pageH - margin - 6) { doc.addPage(); y = margin; }
    cols.forEach((c, i) => {
      const raw = (r as any)[c.key as string];
      const v = c.format ? c.format(raw, r) : raw ?? "";
      const text = String(v).slice(0, Math.floor(colW / 1.6));
      doc.text(text, margin + i * colW + 1, y + 4);
    });
    y += 5;
  });

  doc.save(filename.endsWith(".pdf") ? filename : `${filename}.pdf`);
}

export async function logExport(params: {
  companyId: string;
  reportName: string;
  format: "csv" | "pdf";
  rowCount: number;
  filters?: Record<string, unknown>;
}) {
  try {
    await supabase.rpc("log_audit", {
      _action: "UPDATE",
      _table_name: "report_export",
      _record_id: params.reportName,
      _company_id: params.companyId,
      _branch_id: null as any,
      _old: null,
      _new: { report: params.reportName, format: params.format, rows: params.rowCount, filters: params.filters ?? {} } as any,
      _reason: `Export ${params.format.toUpperCase()} (${params.rowCount} linhas)`,
    });
  } catch {
    // best-effort
  }
}
