import { createFileRoute, Link } from "@tanstack/react-router";
import { useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useActiveCompany } from "@/hooks/use-active-company";
import { PageHeader } from "@/components/page-header";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { LabelPreview, type PreviewElement, type PreviewFormat } from "@/components/label-preview";
import { toast } from "sonner";
import { uniqueLabelCode } from "@/lib/label-emission";
import { ArrowLeft, RotateCcw, Ban, FileDown, Eye } from "lucide-react";
import {
  buildLabelsPdf, buildFormatFromSnapshot, buildLabelDataFromSnapshot,
  downloadBlob, openBlob,
} from "@/lib/label-pdf";

export const Route = createFileRoute("/app/print-history/$id")({ component: Page });

function Page() {
  const { id } = Route.useParams();
  const qc = useQueryClient();
  const { companyId, canWrite, canCreateProduct, isReadOnly } = useActiveCompany();
  const [reason, setReason] = useState("");
  const [reprintOpen, setReprintOpen] = useState(false);
  const [reprintQty, setReprintQty] = useState(1);

  const batch = useQuery({
    queryKey: ["pb", id],
    queryFn: async () => {
      const { data, error } = await (supabase.from("print_batches" as any) as any)
        .select("*, products(name, internal_code, ean), label_layouts(name), label_layout_versions(version), printer_configs(name)")
        .eq("id", id).maybeSingle();
      if (error) throw error;
      return data as any;
    },
  });

  const labels = useQuery({
    queryKey: ["pl", id],
    queryFn: async () => {
      const { data, error } = await (supabase.from("printed_labels" as any) as any)
        .select("*").eq("print_batch_id", id).order("sequential_number");
      if (error) throw error;
      return data as any[];
    },
  });

  const events = useQuery({
    queryKey: ["pe", id],
    queryFn: async () => {
      const { data, error } = await (supabase.from("print_events" as any) as any)
        .select("*").eq("print_batch_id", id).order("created_at");
      if (error) throw error;
      return data as any[];
    },
  });

  const snapshot = useQuery({
    queryKey: ["ls", id, labels.data?.[0]?.id],
    enabled: !!labels.data?.[0]?.id,
    queryFn: async () => {
      const { data, error } = await (supabase.from("label_snapshots" as any) as any)
        .select("*").eq("printed_label_id", labels.data![0].id).maybeSingle();
      if (error) throw error;
      return data as any;
    },
  });

  const previewFormat: PreviewFormat | null = (() => {
    const f = snapshot.data?.layout_snapshot?.format;
    if (!f) return null;
    return {
      width: Number(f.width), height: Number(f.height), unit: f.unit,
      margin_top: Number(f.margin_top), margin_bottom: Number(f.margin_bottom),
      margin_left: Number(f.margin_left), margin_right: Number(f.margin_right),
      orientation: f.orientation,
    };
  })();
  const previewElements: PreviewElement[] = snapshot.data?.layout_snapshot?.elements ?? [];

  async function generatePdf(action: "download" | "preview") {
    if (!snapshot.data || !batch.data || !labels.data) return;
    const fmt = buildFormatFromSnapshot(snapshot.data.layout_snapshot);
    const elements = (snapshot.data.layout_snapshot?.elements ?? []) as any[];
    if (!fmt) { toast.error("Snapshot sem formato"); return; }
    const labelData = labels.data.filter((l) => l.status !== "cancelled").map((l) =>
      buildLabelDataFromSnapshot(snapshot.data, { unique_label_code: l.unique_label_code, sequential: l.sequential_number }),
    );
    const blob = await buildLabelsPdf({ format: fmt as any, elements, labels: labelData });
    const fname = `lote-${batch.data.id.slice(0, 8)}.pdf`;
    if (action === "download") downloadBlob(blob, fname); else openBlob(blob);
    const { data: u } = await supabase.auth.getUser();
    await (supabase.from("print_events" as any) as any).insert({
      company_id: batch.data.company_id, branch_id: batch.data.branch_id,
      print_batch_id: batch.data.id,
      event_type: action === "download" ? "pdf_downloaded" : "pdf_generated",
      event_notes: `${labelData.length} etiqueta(s)`,
      metadata: { filename: fname }, created_by: u.user?.id ?? null,
    });
    qc.invalidateQueries({ queryKey: ["pe", id] });
  }


  const cancel = useMutation({
    mutationFn: async () => {
      if (!batch.data) return;
      const { data: u } = await supabase.auth.getUser();
      const { error } = await (supabase.from("print_batches" as any) as any)
        .update({ status: "cancelled" }).eq("id", id);
      if (error) throw error;
      await (supabase.from("printed_labels" as any) as any)
        .update({ status: "cancelled" }).eq("print_batch_id", id);
      await (supabase.from("print_events" as any) as any).insert({
        company_id: batch.data.company_id, branch_id: batch.data.branch_id,
        print_batch_id: id, event_type: "cancelled", event_notes: reason || "Cancelado",
        created_by: u.user?.id ?? null,
      });
    },
    onSuccess: () => {
      toast.success("Lote cancelado");
      qc.invalidateQueries({ queryKey: ["pb", id] });
      qc.invalidateQueries({ queryKey: ["pl", id] });
      qc.invalidateQueries({ queryKey: ["pe", id] });
    },
    onError: (e: any) => toast.error(e.message),
  });

  const reprint = useMutation({
    mutationFn: async () => {
      if (!batch.data || !snapshot.data) throw new Error("Sem snapshot disponível");
      const { data: u } = await supabase.auth.getUser();
      const userId = u.user?.id ?? null;
      const companyShort = (batch.data.company_id as string).slice(0, 4).toUpperCase();
      const batchShort = (batch.data.id as string).slice(0, 6).toUpperCase();
      const startSeq = (labels.data?.length ?? 0) + 1;

      const rows: any[] = [];
      for (let i = 0; i < reprintQty; i++) {
        const seq = startSeq + i;
        const code = uniqueLabelCode(companyShort, batchShort + "R", seq);
        rows.push({
          company_id: batch.data.company_id,
          branch_id: batch.data.branch_id,
          print_batch_id: batch.data.id,
          product_id: batch.data.product_id,
          label_layout_id: batch.data.label_layout_id,
          label_layout_version_id: batch.data.label_layout_version_id,
          unique_label_code: code,
          sequential_number: seq,
          qr_code_payload: { ...snapshot.data.emission_snapshot, id: code, reprint: true },
          barcode_value: batch.data.products?.ean || code,
          status: "generated",
          reprint_of: labels.data?.[0]?.id ?? null,
          created_by: userId,
        });
      }
      const { data: inserted, error } = await (supabase.from("printed_labels" as any) as any).insert(rows).select("id");
      if (error) throw error;

      // Reuse snapshot for each new label
      const snaps = (inserted as any[]).map((l) => ({
        company_id: batch.data.company_id,
        branch_id: batch.data.branch_id,
        printed_label_id: l.id,
        product_snapshot: snapshot.data.product_snapshot,
        nutrition_snapshot: snapshot.data.nutrition_snapshot,
        ingredients_snapshot: snapshot.data.ingredients_snapshot,
        allergens_snapshot: snapshot.data.allergens_snapshot,
        layout_snapshot: snapshot.data.layout_snapshot,
        printer_snapshot: snapshot.data.printer_snapshot,
        emission_snapshot: { ...snapshot.data.emission_snapshot, reprinted_at: new Date().toISOString(), reprint_reason: reason },
      }));
      await (supabase.from("label_snapshots" as any) as any).insert(snaps);

      await (supabase.from("print_events" as any) as any).insert({
        company_id: batch.data.company_id, branch_id: batch.data.branch_id,
        print_batch_id: batch.data.id, event_type: "reprinted",
        event_notes: reason || `Reimpressão de ${reprintQty} etiqueta(s)`,
        metadata: { quantity: reprintQty }, created_by: userId,
      });
      await (supabase.from("print_batches" as any) as any).update({ status: "reprinted" }).eq("id", id);
    },
    onSuccess: () => {
      toast.success("Reimpressão registrada");
      setReprintOpen(false); setReason(""); setReprintQty(1);
      qc.invalidateQueries({ queryKey: ["pb", id] });
      qc.invalidateQueries({ queryKey: ["pl", id] });
      qc.invalidateQueries({ queryKey: ["pe", id] });
    },
    onError: (e: any) => toast.error(e.message),
  });

  if (!batch.data) {
    return <div className="text-sm text-muted-foreground">Carregando...</div>;
  }

  const b = batch.data;
  const canReprint = !isReadOnly && (canWrite || canCreateProduct);

  return (
    <div className="space-y-6">
      <PageHeader
        title={`Lote ${b.id.slice(0, 8)}`}
        description={`Emitido em ${new Date(b.created_at).toLocaleString("pt-BR")}`}
        actions={
          <div className="flex gap-2">
            <Button asChild variant="outline"><Link to="/app/print-history"><ArrowLeft className="size-4 mr-1" />Voltar</Link></Button>
            {canReprint && b.status !== "cancelled" && (
              <Dialog open={reprintOpen} onOpenChange={setReprintOpen}>
                <DialogTrigger asChild><Button variant="outline"><RotateCcw className="size-4 mr-1" />Reimprimir</Button></DialogTrigger>
                <DialogContent>
                  <DialogHeader><DialogTitle>Reimprimir lote</DialogTitle></DialogHeader>
                  <div className="space-y-3">
                    <div><Label>Quantidade</Label><input type="number" min={1} value={reprintQty} onChange={(e) => setReprintQty(Number(e.target.value))} className="w-full border rounded px-2 py-1" /></div>
                    <div><Label>Motivo</Label><Textarea value={reason} onChange={(e) => setReason(e.target.value)} placeholder="Ex: dano na etiqueta original" /></div>
                  </div>
                  <DialogFooter>
                    <Button onClick={() => reprint.mutate()} disabled={reprint.isPending || !reason}>Confirmar</Button>
                  </DialogFooter>
                </DialogContent>
              </Dialog>
            )}
            {canWrite && b.status !== "cancelled" && (
              <Button variant="destructive" onClick={() => cancel.mutate()} disabled={cancel.isPending}>
                <Ban className="size-4 mr-1" />Cancelar lote
              </Button>
            )}
          </div>
        }
      />

      <div className="grid lg:grid-cols-3 gap-6">
        <Card className="p-5 lg:col-span-2 space-y-3">
          <div className="grid md:grid-cols-3 gap-3 text-sm">
            <div><div className="text-muted-foreground">Produto</div><div className="font-medium">{b.products?.name}</div><div className="text-xs">{b.products?.internal_code}</div></div>
            <div><div className="text-muted-foreground">Tipo</div><Badge>{b.label_type}</Badge></div>
            <div><div className="text-muted-foreground">Status</div><Badge variant={b.status === "generated" ? "default" : "outline"}>{b.status}</Badge></div>
            <div><div className="text-muted-foreground">Layout</div><div>{b.label_layouts?.name} v{b.label_layout_versions?.version}</div></div>
            <div><div className="text-muted-foreground">Impressora</div><div>{b.printer_configs?.name ?? "—"}</div></div>
            <div><div className="text-muted-foreground">Quantidade</div><div>{b.quantity}</div></div>
            <div><div className="text-muted-foreground">Lote</div><div>{b.batch_code ?? "—"}</div></div>
            <div><div className="text-muted-foreground">Fabricação</div><div>{b.manufacture_date ?? "—"}</div></div>
            <div><div className="text-muted-foreground">Validade</div><div>{b.expiration_date ?? "—"}</div></div>
            <div><div className="text-muted-foreground">Peso</div><div>{b.variable_weight ?? "—"}</div></div>
            <div><div className="text-muted-foreground">Sugestão</div><div>{b.layout_suggestion_source ?? "—"}{b.layout_overridden ? " (trocado)" : ""}</div></div>
          </div>
        </Card>

        <Card className="p-5 space-y-2">
          <div className="font-semibold">Pré-visualização (snapshot)</div>
          {previewFormat ? (
            <div className="overflow-auto"><LabelPreview format={previewFormat} elements={previewElements} zoom={2} /></div>
          ) : <div className="text-sm text-muted-foreground">Sem snapshot disponível.</div>}
        </Card>
      </div>

      <Card>
        <div className="p-4 font-semibold">Etiquetas geradas ({labels.data?.length ?? 0})</div>
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>#</TableHead>
              <TableHead>Código único</TableHead>
              <TableHead>Código de barras</TableHead>
              <TableHead>Status</TableHead>
              <TableHead>Reimpressão de</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {labels.data?.map((l) => (
              <TableRow key={l.id}>
                <TableCell>{l.sequential_number}</TableCell>
                <TableCell className="font-mono text-xs">{l.unique_label_code}</TableCell>
                <TableCell className="font-mono text-xs">{l.barcode_value}</TableCell>
                <TableCell><Badge variant={l.status === "generated" ? "default" : "outline"}>{l.status}</Badge></TableCell>
                <TableCell className="font-mono text-xs">{l.reprint_of ?? "—"}</TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </Card>

      <Card>
        <div className="p-4 font-semibold">Eventos</div>
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Data</TableHead>
              <TableHead>Tipo</TableHead>
              <TableHead>Notas</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {events.data?.map((e) => (
              <TableRow key={e.id}>
                <TableCell className="whitespace-nowrap">{new Date(e.created_at).toLocaleString("pt-BR")}</TableCell>
                <TableCell><Badge variant="secondary">{e.event_type}</Badge></TableCell>
                <TableCell>{e.event_notes ?? "—"}</TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </Card>
    </div>
  );
}
