import { createFileRoute } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useActiveCompany } from "@/hooks/use-active-company";
import { PageHeader } from "@/components/page-header";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Download, FileText } from "lucide-react";
import { exportCsv, exportPdf, logExport, type ExportColumn } from "@/lib/report-export";
import { toast } from "sonner";

export const Route = createFileRoute("/app/reports")({
  head: () => ({ meta: [{ title: "Relatórios — Etiquetas" }] }),
  component: ReportsPage,
});

const PAGE_SIZE = 100;

function ReportsPage() {
  const { companyId, role, isReadOnly } = useActiveCompany();
  const [from, setFrom] = useState<string>(new Date(Date.now() - 30 * 86400_000).toISOString().slice(0, 10));
  const [to, setTo] = useState<string>(new Date().toISOString().slice(0, 10));
  const [branchId, setBranchId] = useState<string>("__all__");
  const [labelType, setLabelType] = useState<string>("__all__");

  const { data: branches } = useQuery({
    queryKey: ["branches-reports", companyId],
    enabled: !!companyId,
    queryFn: async () => {
      const { data, error } = await supabase.from("branches").select("id,name").eq("company_id", companyId!).order("name");
      if (error) throw error;
      return data ?? [];
    },
  });

  const canExportAdmin = role === "administrador" || role === "supervisor";

  async function handleExport<T>(
    rows: T[], cols: ExportColumn<T>[], name: string, fmt: "csv" | "pdf", adminOnly = false,
  ) {
    if (!companyId) return;
    if (adminOnly && !canExportAdmin) { toast.error("Sem permissão para exportar este relatório."); return; }
    if (isReadOnly && adminOnly) { toast.error("Perfil Consulta não pode exportar relatórios administrativos."); return; }
    if (!rows.length) { toast.warning("Sem dados para exportar."); return; }
    if (fmt === "csv") exportCsv(rows, cols, name);
    else exportPdf(name, rows, cols, name);
    await logExport({ companyId, reportName: name, format: fmt, rowCount: rows.length, filters: { from, to, branchId, labelType } });
    toast.success(`Relatório exportado (${fmt.toUpperCase()})`);
  }

  return (
    <>
      <PageHeader title="Relatórios" description="Relatórios gerenciais com filtros, paginação e exportação CSV/PDF." />

      <Card className="mb-4">
        <CardContent className="p-4 grid gap-3 md:grid-cols-5">
          <div>
            <Label className="text-xs">De</Label>
            <Input type="date" value={from} onChange={(e) => setFrom(e.target.value)} />
          </div>
          <div>
            <Label className="text-xs">Até</Label>
            <Input type="date" value={to} onChange={(e) => setTo(e.target.value)} />
          </div>
          <div>
            <Label className="text-xs">Filial</Label>
            <Select value={branchId} onValueChange={setBranchId}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="__all__">Todas</SelectItem>
                {branches?.map((b) => <SelectItem key={b.id} value={b.id}>{b.name}</SelectItem>)}
              </SelectContent>
            </Select>
          </div>
          <div>
            <Label className="text-xs">Tipo de etiqueta</Label>
            <Select value={labelType} onValueChange={setLabelType}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="__all__">Todos</SelectItem>
                <SelectItem value="nutricional">Nutricional</SelectItem>
                <SelectItem value="gondola">Gôndola</SelectItem>
                <SelectItem value="promocional">Promocional</SelectItem>
                <SelectItem value="atacado">Atacado</SelectItem>
                <SelectItem value="personalizada">Personalizada</SelectItem>
              </SelectContent>
            </Select>
          </div>
          <div className="flex items-end text-xs text-muted-foreground">
            {isReadOnly ? "Perfil Consulta — exportação limitada." : `Perfil: ${role}`}
          </div>
        </CardContent>
      </Card>

      <Tabs defaultValue="emissions">
        <TabsList className="flex-wrap h-auto">
          <TabsTrigger value="emissions">Etiquetas por período</TabsTrigger>
          <TabsTrigger value="top-products">Produtos mais impressos</TabsTrigger>
          <TabsTrigger value="top-layouts">Layouts</TabsTrigger>
          <TabsTrigger value="by-user">Por usuário</TabsTrigger>
          <TabsTrigger value="reprints">Reimpressões</TabsTrigger>
          <TabsTrigger value="pending">Pendências nutricionais</TabsTrigger>
          <TabsTrigger value="audit">Histórico de alterações</TabsTrigger>
          <TabsTrigger value="price-history">Histórico de preços</TabsTrigger>
          <TabsTrigger value="promos">Promoções</TabsTrigger>
        </TabsList>

        <TabsContent value="emissions">
          <EmissionsReport
            companyId={companyId} branchId={branchId} from={from} to={to} labelType={labelType}
            onExport={(rows, cols, fmt) => handleExport(rows, cols, "etiquetas-por-periodo", fmt)}
          />
        </TabsContent>
        <TabsContent value="top-products">
          <TopProductsReport
            companyId={companyId} branchId={branchId}
            onExport={(rows, cols, fmt) => handleExport(rows, cols, "produtos-mais-impressos", fmt)}
          />
        </TabsContent>
        <TabsContent value="top-layouts">
          <TopLayoutsReport
            companyId={companyId} branchId={branchId}
            onExport={(rows, cols, fmt) => handleExport(rows, cols, "layouts-mais-utilizados", fmt)}
          />
        </TabsContent>
        <TabsContent value="by-user">
          <ByUserReport
            companyId={companyId} branchId={branchId}
            onExport={(rows, cols, fmt) => handleExport(rows, cols, "impressoes-por-usuario", fmt, true)}
          />
        </TabsContent>
        <TabsContent value="reprints">
          <ReprintsReport
            companyId={companyId} branchId={branchId} from={from} to={to}
            onExport={(rows, cols, fmt) => handleExport(rows, cols, "reimpressoes", fmt)}
          />
        </TabsContent>
        <TabsContent value="pending">
          <PendingReport
            companyId={companyId}
            onExport={(rows, cols, fmt) => handleExport(rows, cols, "pendencias-nutricionais", fmt)}
          />
        </TabsContent>
        <TabsContent value="audit">
          <AuditReport
            companyId={companyId} from={from} to={to}
            onExport={(rows, cols, fmt) => handleExport(rows, cols, "auditoria", fmt, true)}
          />
        </TabsContent>
        <TabsContent value="price-history">
          <PriceHistoryReport
            companyId={companyId} from={from} to={to}
            onExport={(rows, cols, fmt) => handleExport(rows, cols, "historico-precos", fmt, true)}
          />
        </TabsContent>
        <TabsContent value="promos">
          <PromotionsReport
            companyId={companyId}
            onExport={(rows, cols, fmt) => handleExport(rows, cols, "promocoes", fmt)}
          />
        </TabsContent>
      </Tabs>
    </>
  );
}

function ExportBar({ onCsv, onPdf, count }: { onCsv: () => void; onPdf: () => void; count: number }) {
  return (
    <div className="flex items-center justify-between mb-3">
      <div className="text-sm text-muted-foreground">{count} registro(s)</div>
      <div className="flex gap-2">
        <Button size="sm" variant="outline" onClick={onCsv}><Download className="size-4 mr-1" />CSV</Button>
        <Button size="sm" variant="outline" onClick={onPdf}><FileText className="size-4 mr-1" />PDF</Button>
      </div>
    </div>
  );
}

function ReportCard({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <Card className="mt-4">
      <CardHeader className="pb-2"><CardTitle className="text-base">{title}</CardTitle></CardHeader>
      <CardContent>{children}</CardContent>
    </Card>
  );
}

// ===== Individual reports =====
function EmissionsReport({ companyId, branchId, from, to, labelType, onExport }: any) {
  const { data = [] } = useQuery({
    queryKey: ["rep-emissions", companyId, branchId, from, to, labelType],
    enabled: !!companyId,
    queryFn: async () => {
      let q = supabase.from("dashboard_prints_by_period").select("*")
        .eq("company_id", companyId).gte("period_day", from).lte("period_day", to)
        .order("period_day", { ascending: false }).limit(PAGE_SIZE * 5);
      if (branchId !== "__all__") q = q.eq("branch_id", branchId);
      if (labelType !== "__all__") q = q.eq("label_type", labelType);
      const { data, error } = await q;
      if (error) throw error;
      return data ?? [];
    },
  });
  const cols: ExportColumn<any>[] = [
    { key: "period_day", label: "Data" },
    { key: "label_type", label: "Tipo" },
    { key: "total_labels", label: "Total" },
    { key: "total_reprints", label: "Reimpressões" },
  ];
  return (
    <ReportCard title="Etiquetas emitidas por período">
      <ExportBar count={data.length}
        onCsv={() => onExport(data, cols, "csv")}
        onPdf={() => onExport(data, cols, "pdf")} />
      <SimpleTable cols={cols} rows={data} />
    </ReportCard>
  );
}

function TopProductsReport({ companyId, branchId, onExport }: any) {
  const { data = [] } = useQuery({
    queryKey: ["rep-top-products", companyId, branchId],
    enabled: !!companyId,
    queryFn: async () => {
      let q = supabase.from("dashboard_top_products").select("*")
        .eq("company_id", companyId).order("total_labels", { ascending: false }).limit(PAGE_SIZE);
      if (branchId !== "__all__") q = q.eq("branch_id", branchId);
      const { data, error } = await q;
      if (error) throw error;
      return data ?? [];
    },
  });
  const cols: ExportColumn<any>[] = [
    { key: "product_name", label: "Produto" },
    { key: "total_labels", label: "Etiquetas" },
    { key: "last_printed_at", label: "Última impressão", format: (v) => v ? new Date(v).toLocaleString("pt-BR") : "" },
  ];
  return (
    <ReportCard title="Produtos mais impressos">
      <ExportBar count={data.length}
        onCsv={() => onExport(data, cols, "csv")}
        onPdf={() => onExport(data, cols, "pdf")} />
      <SimpleTable cols={cols} rows={data} />
    </ReportCard>
  );
}

function TopLayoutsReport({ companyId, branchId, onExport }: any) {
  const { data = [] } = useQuery({
    queryKey: ["rep-top-layouts", companyId, branchId],
    enabled: !!companyId,
    queryFn: async () => {
      let q = supabase.from("dashboard_top_layouts").select("*")
        .eq("company_id", companyId).order("total_labels", { ascending: false }).limit(PAGE_SIZE);
      if (branchId !== "__all__") q = q.eq("branch_id", branchId);
      const { data, error } = await q;
      if (error) throw error;
      return data ?? [];
    },
  });
  const cols: ExportColumn<any>[] = [
    { key: "layout_name", label: "Layout" },
    { key: "label_type", label: "Tipo" },
    { key: "total_labels", label: "Etiquetas" },
  ];
  return (
    <ReportCard title="Layouts mais utilizados">
      <ExportBar count={data.length}
        onCsv={() => onExport(data, cols, "csv")}
        onPdf={() => onExport(data, cols, "pdf")} />
      <SimpleTable cols={cols} rows={data} />
    </ReportCard>
  );
}

function ByUserReport({ companyId, branchId, onExport }: any) {
  const { data = [] } = useQuery({
    queryKey: ["rep-by-user", companyId, branchId],
    enabled: !!companyId,
    queryFn: async () => {
      let q = supabase.from("dashboard_prints_by_user").select("*")
        .eq("company_id", companyId).order("total_labels", { ascending: false }).limit(PAGE_SIZE);
      if (branchId !== "__all__") q = q.eq("branch_id", branchId);
      const { data, error } = await q;
      if (error) throw error;
      return data ?? [];
    },
  });
  const cols: ExportColumn<any>[] = [
    { key: "full_name", label: "Usuário" },
    { key: "email", label: "E-mail" },
    { key: "total_batches", label: "Lotes" },
    { key: "total_labels", label: "Etiquetas" },
  ];
  return (
    <ReportCard title="Impressões por usuário">
      <ExportBar count={data.length}
        onCsv={() => onExport(data, cols, "csv")}
        onPdf={() => onExport(data, cols, "pdf")} />
      <SimpleTable cols={cols} rows={data} />
    </ReportCard>
  );
}

function ReprintsReport({ companyId, branchId, from, to, onExport }: any) {
  const { data = [] } = useQuery({
    queryKey: ["rep-reprints", companyId, branchId, from, to],
    enabled: !!companyId,
    queryFn: async () => {
      let q = supabase.from("dashboard_reprints").select("*")
        .eq("company_id", companyId).gte("period_day", from).lte("period_day", to)
        .order("period_day", { ascending: false }).limit(PAGE_SIZE * 5);
      if (branchId !== "__all__") q = q.eq("branch_id", branchId);
      const { data, error } = await q;
      if (error) throw error;
      return data ?? [];
    },
  });
  const cols: ExportColumn<any>[] = [
    { key: "period_day", label: "Data" },
    { key: "total_reprints", label: "Reimpressões" },
  ];
  return (
    <ReportCard title="Reimpressões">
      <ExportBar count={data.length}
        onCsv={() => onExport(data, cols, "csv")}
        onPdf={() => onExport(data, cols, "pdf")} />
      <SimpleTable cols={cols} rows={data} />
    </ReportCard>
  );
}

function PendingReport({ companyId, onExport }: any) {
  const { data = [] } = useQuery({
    queryKey: ["rep-pending", companyId],
    enabled: !!companyId,
    queryFn: async () => {
      const { data, error } = await supabase.from("product_pending_issues").select("*").eq("company_id", companyId);
      if (error) throw error;
      return (data ?? []).filter((r: any) =>
        r.missing_nutrition || r.missing_ingredients || r.missing_allergens ||
        r.missing_shelf_life || r.missing_preservation || r.nutrition_in_review || r.status_pending,
      );
    },
  });
  const cols: ExportColumn<any>[] = [
    { key: "name", label: "Produto" },
    { key: "status", label: "Status" },
    { key: "missing_nutrition", label: "Sem nutricional", format: (v) => v ? "Sim" : "" },
    { key: "missing_ingredients", label: "Sem ingredientes", format: (v) => v ? "Sim" : "" },
    { key: "missing_allergens", label: "Sem alergênicos", format: (v) => v ? "Sim" : "" },
    { key: "missing_shelf_life", label: "Sem validade", format: (v) => v ? "Sim" : "" },
    { key: "missing_preservation", label: "Sem conservação", format: (v) => v ? "Sim" : "" },
    { key: "nutrition_in_review", label: "Em revisão", format: (v) => v ? "Sim" : "" },
  ];
  return (
    <ReportCard title="Pendências nutricionais / regulatórias">
      <ExportBar count={data.length}
        onCsv={() => onExport(data, cols, "csv")}
        onPdf={() => onExport(data, cols, "pdf")} />
      <SimpleTable cols={cols} rows={data} />
    </ReportCard>
  );
}

function AuditReport({ companyId, from, to, onExport }: any) {
  const { data = [] } = useQuery({
    queryKey: ["rep-audit", companyId, from, to],
    enabled: !!companyId,
    queryFn: async () => {
      const { data, error } = await supabase.from("audit_logs").select("created_at,action,table_name,record_id,user_id,reason")
        .eq("company_id", companyId).gte("created_at", from).lte("created_at", to + "T23:59:59")
        .order("created_at", { ascending: false }).limit(PAGE_SIZE * 5);
      if (error) throw error;
      return data ?? [];
    },
  });
  const cols: ExportColumn<any>[] = [
    { key: "created_at", label: "Data", format: (v) => new Date(v).toLocaleString("pt-BR") },
    { key: "action", label: "Ação" },
    { key: "table_name", label: "Tabela" },
    { key: "record_id", label: "Registro" },
    { key: "user_id", label: "Usuário" },
    { key: "reason", label: "Motivo" },
  ];
  return (
    <ReportCard title="Histórico de alterações (auditoria)">
      <ExportBar count={data.length}
        onCsv={() => onExport(data, cols, "csv")}
        onPdf={() => onExport(data, cols, "pdf")} />
      <SimpleTable cols={cols} rows={data} />
    </ReportCard>
  );
}

function PriceHistoryReport({ companyId, from, to, onExport }: any) {
  const { data = [] } = useQuery({
    queryKey: ["rep-prices", companyId, from, to],
    enabled: !!companyId,
    queryFn: async () => {
      const { data, error } = await supabase.from("product_price_history").select("*")
        .eq("company_id", companyId).gte("created_at", from).lte("created_at", to + "T23:59:59")
        .order("created_at", { ascending: false }).limit(PAGE_SIZE * 5);
      if (error) throw error;
      return data ?? [];
    },
  });
  const cols: ExportColumn<any>[] = [
    { key: "created_at", label: "Data", format: (v) => new Date(v).toLocaleString("pt-BR") },
    { key: "product_id", label: "Produto" },
    { key: "old_regular_price", label: "Preço anterior" },
    { key: "new_regular_price", label: "Preço novo" },
    { key: "reason", label: "Motivo" },
  ];
  return (
    <ReportCard title="Histórico de preços">
      <ExportBar count={data.length}
        onCsv={() => onExport(data, cols, "csv")}
        onPdf={() => onExport(data, cols, "pdf")} />
      <SimpleTable cols={cols} rows={data} />
    </ReportCard>
  );
}

function PromotionsReport({ companyId, onExport }: any) {
  const { data = [] } = useQuery({
    queryKey: ["rep-promos", companyId],
    enabled: !!companyId,
    queryFn: async () => {
      const { data, error } = await supabase.from("dashboard_promotions_summary").select("*")
        .eq("company_id", companyId).order("start_date", { ascending: false }).limit(PAGE_SIZE);
      if (error) throw error;
      return data ?? [];
    },
  });
  const cols: ExportColumn<any>[] = [
    { key: "promotion_name", label: "Promoção" },
    { key: "status", label: "Status" },
    { key: "start_date", label: "Início", format: (v) => v ? new Date(v).toLocaleDateString("pt-BR") : "" },
    { key: "end_date", label: "Fim", format: (v) => v ? new Date(v).toLocaleDateString("pt-BR") : "" },
    { key: "total_products", label: "Produtos" },
    { key: "total_labels", label: "Etiquetas" },
  ];
  return (
    <ReportCard title="Promoções (ativas e encerradas) — etiquetas de gôndola por promoção">
      <ExportBar count={data.length}
        onCsv={() => onExport(data, cols, "csv")}
        onPdf={() => onExport(data, cols, "pdf")} />
      <SimpleTable cols={cols} rows={data} />
    </ReportCard>
  );
}

function SimpleTable({ cols, rows }: { cols: ExportColumn<any>[]; rows: any[] }) {
  if (!rows.length) return <div className="py-10 text-center text-sm text-muted-foreground">Sem dados para os filtros selecionados.</div>;
  return (
    <div className="rounded-md border overflow-x-auto">
      <Table>
        <TableHeader>
          <TableRow>{cols.map((c) => <TableHead key={String(c.key)}>{c.label}</TableHead>)}</TableRow>
        </TableHeader>
        <TableBody>
          {rows.map((r, i) => (
            <TableRow key={r.id ?? r.product_id ?? r.user_id ?? r.promotion_id ?? r.printer_config_id ?? r.layout_id ?? i}>
              {cols.map((c) => {
                const raw = r[c.key as string];
                const v = c.format ? c.format(raw, r) : raw ?? "";
                return <TableCell key={String(c.key)}>{typeof v === "boolean" ? (v ? <Badge variant="secondary">Sim</Badge> : "") : String(v)}</TableCell>;
              })}
            </TableRow>
          ))}
        </TableBody>
      </Table>
    </div>
  );
}
