import { createFileRoute, Link } from "@tanstack/react-router";
import { useMemo, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useActiveCompany } from "@/hooks/use-active-company";
import { PageHeader } from "@/components/page-header";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { LABEL_TYPES } from "@/lib/label-emission";
import { Button } from "@/components/ui/button";
import { FileDown } from "lucide-react";
import { buildLabelsPdf, buildFormatFromSnapshot, buildLabelDataFromSnapshot, downloadBlob } from "@/lib/label-pdf";
import { toast } from "sonner";

export const Route = createFileRoute("/app/print-history")({ component: Page });

function Page() {
  const { companyId } = useActiveCompany();
  const [from, setFrom] = useState("");

  async function downloadBatchPdf(batchId: string) {
    try {
      const { data: labels } = await (supabase.from("printed_labels" as any) as any)
        .select("*").eq("print_batch_id", batchId).order("sequential_number");
      const first = (labels as any[])?.find((l) => l.status !== "cancelled");
      if (!first) { toast.error("Lote sem etiquetas válidas"); return; }
      const { data: snap } = await (supabase.from("label_snapshots" as any) as any)
        .select("*").eq("printed_label_id", first.id).maybeSingle();
      if (!snap) { toast.error("Snapshot indisponível"); return; }
      const fmt = buildFormatFromSnapshot(snap.layout_snapshot);
      const elements = (snap.layout_snapshot?.elements ?? []) as any[];
      if (!fmt) { toast.error("Snapshot sem formato"); return; }
      const labelData = (labels as any[]).filter((l) => l.status !== "cancelled").map((l) =>
        buildLabelDataFromSnapshot(snap, { unique_label_code: l.unique_label_code, sequential: l.sequential_number }),
      );
      const blob = await buildLabelsPdf({ format: fmt as any, elements, labels: labelData });
      const fname = `lote-${batchId.slice(0, 8)}.pdf`;
      downloadBlob(blob, fname);
      const { data: u } = await supabase.auth.getUser();
      await (supabase.from("print_events" as any) as any).insert({
        company_id: snap.company_id, branch_id: snap.branch_id, print_batch_id: batchId,
        event_type: "pdf_downloaded", event_notes: `${labelData.length} etiqueta(s)`,
        metadata: { filename: fname }, created_by: u.user?.id ?? null,
      });
    } catch (e: any) { toast.error(e.message); }
  }

  const [to, setTo] = useState("");
  const [labelType, setLabelType] = useState<string>("");
  const [status, setStatus] = useState<string>("");
  const [productQ, setProductQ] = useState("");
  const [batchQ, setBatchQ] = useState("");

  const { data, isLoading } = useQuery({
    queryKey: ["print-batches", companyId, from, to, labelType, status, productQ, batchQ],
    enabled: !!companyId,
    queryFn: async () => {
      let q = (supabase.from("print_batches" as any) as any)
        .select("id, created_at, label_type, quantity, status, batch_code, label_layout_id, product_id, products(name, internal_code), label_layouts(name)")
        .eq("company_id", companyId!)
        .order("created_at", { ascending: false })
        .limit(200);
      if (from) q = q.gte("created_at", from);
      if (to) q = q.lte("created_at", to + "T23:59:59");
      if (labelType) q = q.eq("label_type", labelType);
      if (status) q = q.eq("status", status);
      if (batchQ) q = q.ilike("batch_code", `%${batchQ}%`);
      const { data, error } = await q;
      if (error) throw error;
      return data as any[];
    },
  });

  const rows = useMemo(() => {
    if (!data) return [];
    if (!productQ) return data;
    const s = productQ.toLowerCase();
    return data.filter((r) => r.products?.name?.toLowerCase().includes(s) || r.products?.internal_code?.toLowerCase().includes(s));
  }, [data, productQ]);

  return (
    <div className="space-y-6">
      <PageHeader
        title="Histórico de Emissões"
        description="Consulta de lotes emitidos, filtros, snapshots e reimpressão."
        actions={<Button asChild><Link to="/app/print-labels">Nova emissão</Link></Button>}
      />

      <Card className="p-4 grid md:grid-cols-6 gap-3">
        <div><Label>De</Label><Input type="date" value={from} onChange={(e) => setFrom(e.target.value)} /></div>
        <div><Label>Até</Label><Input type="date" value={to} onChange={(e) => setTo(e.target.value)} /></div>
        <div>
          <Label>Tipo</Label>
          <Select value={labelType || "all"} onValueChange={(v) => setLabelType(v === "all" ? "" : v)}>
            <SelectTrigger><SelectValue /></SelectTrigger>
            <SelectContent>
              <SelectItem value="all">Todos</SelectItem>
              {LABEL_TYPES.map((t) => <SelectItem key={t.value} value={t.value}>{t.label}</SelectItem>)}
            </SelectContent>
          </Select>
        </div>
        <div>
          <Label>Status</Label>
          <Select value={status || "all"} onValueChange={(v) => setStatus(v === "all" ? "" : v)}>
            <SelectTrigger><SelectValue /></SelectTrigger>
            <SelectContent>
              <SelectItem value="all">Todos</SelectItem>
              <SelectItem value="generated">Gerado</SelectItem>
              <SelectItem value="cancelled">Cancelado</SelectItem>
              <SelectItem value="reprinted">Reimpresso</SelectItem>
              <SelectItem value="draft">Rascunho</SelectItem>
            </SelectContent>
          </Select>
        </div>
        <div><Label>Produto</Label><Input value={productQ} onChange={(e) => setProductQ(e.target.value)} placeholder="Nome ou código" /></div>
        <div><Label>Lote</Label><Input value={batchQ} onChange={(e) => setBatchQ(e.target.value)} /></div>
      </Card>

      <Card className="p-0 overflow-hidden">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Data</TableHead>
              <TableHead>Produto</TableHead>
              <TableHead>Tipo</TableHead>
              <TableHead>Layout</TableHead>
              <TableHead>Lote</TableHead>
              <TableHead className="text-right">Qtd</TableHead>
              <TableHead>Status</TableHead>
              <TableHead></TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {isLoading && <TableRow><TableCell colSpan={8}>Carregando...</TableCell></TableRow>}
            {!isLoading && rows.length === 0 && <TableRow><TableCell colSpan={8} className="text-center text-muted-foreground py-8">Nenhum lote encontrado.</TableCell></TableRow>}
            {rows.map((r) => (
              <TableRow key={r.id}>
                <TableCell className="whitespace-nowrap">{new Date(r.created_at).toLocaleString("pt-BR")}</TableCell>
                <TableCell>{r.products?.name ?? "—"}<div className="text-xs text-muted-foreground">{r.products?.internal_code}</div></TableCell>
                <TableCell><Badge variant="secondary">{r.label_type}</Badge></TableCell>
                <TableCell>{r.label_layouts?.name ?? "—"}</TableCell>
                <TableCell>{r.batch_code ?? "—"}</TableCell>
                <TableCell className="text-right">{r.quantity}</TableCell>
                <TableCell><Badge variant={r.status === "generated" ? "default" : r.status === "cancelled" ? "destructive" : "outline"}>{r.status}</Badge></TableCell>
                <TableCell className="text-right space-x-1">
                  <Button variant="ghost" size="sm" onClick={() => downloadBatchPdf(r.id)} title="Baixar PDF do lote"><FileDown className="size-4" /></Button>
                  <Button asChild variant="outline" size="sm"><Link to="/app/print-history/$id" params={{ id: r.id }}>Detalhes</Link></Button>
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </Card>
    </div>
  );
}
