import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useMemo, useState, useEffect } from "react";
import { useMutation, useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useActiveCompany } from "@/hooks/use-active-company";
import { PageHeader } from "@/components/page-header";
import { LabelPreview, type PreviewElement, type PreviewFormat } from "@/components/label-preview";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Card } from "@/components/ui/card";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { AlertTriangle, Printer as PrinterIcon, Wand2 } from "lucide-react";
import { toast } from "sonner";
import {
  LABEL_TYPES,
  SUGGESTION_SOURCE_LABEL,
  blockingIssuesForNutritional,
  computeExpiration,
  suggestLayout,
  uniqueLabelCode,
  type LabelType,
} from "@/lib/label-emission";

export const Route = createFileRoute("/app/print-labels")({ component: PrintLabelsPage });

function todayISO() {
  return new Date().toISOString().slice(0, 10);
}

function PrintLabelsPage() {
  const navigate = useNavigate();
  const { companyId, role, canCreateProduct, isReadOnly, canWrite } = useActiveCompany();

  const [labelType, setLabelType] = useState<LabelType>("nutricional");
  const [productId, setProductId] = useState<string>("");
  const [branchId, setBranchId] = useState<string>("");
  const [layoutId, setLayoutId] = useState<string>("");
  const [layoutSource, setLayoutSource] = useState<string>("");
  const [layoutOverridden, setLayoutOverridden] = useState(false);
  const [printerId, setPrinterId] = useState<string>("");
  const [quantity, setQuantity] = useState<number>(1);
  const [batchCode, setBatchCode] = useState<string>("");
  const [manufactureDate, setManufactureDate] = useState<string>(todayISO());
  const [expiration, setExpiration] = useState<string>("");
  const [weight, setWeight] = useState<string>("");
  const [notes, setNotes] = useState<string>("");

  // Lookups
  const branches = useQuery({
    queryKey: ["em-branches", companyId],
    enabled: !!companyId,
    queryFn: async () => {
      const { data, error } = await supabase.from("branches").select("id,name").eq("company_id", companyId!).eq("status", "ativo" as any);
      if (error) throw error;
      return data as { id: string; name: string }[];
    },
  });

  const products = useQuery({
    queryKey: ["em-products", companyId],
    enabled: !!companyId,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("products")
        .select("id,name,internal_code,ean,variable_weight,shelf_life_days,status,category_id,brand_id,nutrition_fact_id,preservation,unit_of_measure,standard_weight")
        .eq("company_id", companyId!)
        .order("name");
      if (error) throw error;
      return data as any[];
    },
  });

  const product = useMemo(() => products.data?.find((p) => p.id === productId), [products.data, productId]);

  const printers = useQuery({
    queryKey: ["em-printers", companyId],
    enabled: !!companyId,
    queryFn: async () => {
      const { data, error } = await (supabase.from("printer_configs" as any) as any)
        .select("id,name,status,is_default,printer_type").eq("company_id", companyId!).eq("status", "ativo");
      if (error) throw error;
      return data as any[];
    },
  });

  // Default printer
  useEffect(() => {
    if (!printerId && printers.data?.length) {
      const def = printers.data.find((p) => p.is_default) ?? printers.data[0];
      setPrinterId(def?.id ?? "");
    }
  }, [printers.data, printerId]);

  const layouts = useQuery({
    queryKey: ["em-layouts", companyId],
    enabled: !!companyId,
    queryFn: async () => {
      const { data, error } = await (supabase.from("label_layouts" as any) as any)
        .select("id,name,status,label_type,current_version").eq("company_id", companyId!).eq("status", "ativo");
      if (error) throw error;
      return data as any[];
    },
  });

  // Pending issues for product
  const pending = useQuery({
    queryKey: ["em-pending", productId],
    enabled: !!productId,
    queryFn: async () => {
      const { data, error } = await (supabase.from("product_pending_issues" as any) as any)
        .select("*").eq("product_id", productId).maybeSingle();
      if (error) throw error;
      return data as any;
    },
  });

  // Nutrition (for snapshot + preview)
  const nutrition = useQuery({
    queryKey: ["em-nut", product?.nutrition_fact_id],
    enabled: !!product?.nutrition_fact_id,
    queryFn: async () => {
      const { data, error } = await (supabase.from("nutrition_facts" as any) as any)
        .select("*").eq("id", product!.nutrition_fact_id).maybeSingle();
      if (error) throw error;
      return data as any;
    },
  });

  // Auto-suggest layout when product+type change
  const suggest = useMutation({
    mutationFn: async () => {
      if (!companyId || !productId) return null;
      return suggestLayout({ companyId, branchId: branchId || null, productId, labelType });
    },
    onSuccess: (res) => {
      if (res) {
        setLayoutId(res.layoutId);
        setLayoutSource(res.source);
        setLayoutOverridden(false);
      } else {
        setLayoutId("");
        setLayoutSource("none");
        toast.warning("Nenhum layout sugerido. Selecione manualmente.");
      }
    },
    onError: (e: any) => toast.error(e.message),
  });

  useEffect(() => {
    if (productId && companyId) suggest.mutate();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [productId, labelType, branchId, companyId]);

  // Recompute expiration when manufacture or product changes
  useEffect(() => {
    if (product?.shelf_life_days && manufactureDate) {
      const v = computeExpiration(manufactureDate, product.shelf_life_days);
      if (v) setExpiration(v);
    }
  }, [product?.shelf_life_days, manufactureDate]);

  // Selected layout version + elements + format for preview
  const layout = useQuery({
    queryKey: ["em-layout", layoutId],
    enabled: !!layoutId,
    queryFn: async () => {
      const { data, error } = await (supabase.from("label_layouts" as any) as any)
        .select("*, label_formats(*)").eq("id", layoutId).maybeSingle();
      if (error) throw error;
      return data as any;
    },
  });

  const version = useQuery({
    queryKey: ["em-version", layoutId, layout.data?.current_version],
    enabled: !!layoutId && !!layout.data?.current_version,
    queryFn: async () => {
      const { data, error } = await (supabase.from("label_layout_versions" as any) as any)
        .select("*").eq("layout_id", layoutId).eq("version", layout.data!.current_version).maybeSingle();
      if (error) throw error;
      return data as any;
    },
  });

  const elements = useQuery({
    queryKey: ["em-elements", version.data?.id],
    enabled: !!version.data?.id,
    queryFn: async () => {
      const { data, error } = await (supabase.from("label_layout_elements" as any) as any)
        .select("*").eq("version_id", version.data!.id).order("layer");
      if (error) throw error;
      return data as PreviewElement[];
    },
  });

  const previewFormat: PreviewFormat | null = useMemo(() => {
    const f = layout.data?.label_formats;
    if (!f) return null;
    return {
      width: Number(f.width), height: Number(f.height), unit: f.unit,
      margin_top: Number(f.margin_top), margin_bottom: Number(f.margin_bottom),
      margin_left: Number(f.margin_left), margin_right: Number(f.margin_right),
      orientation: f.orientation,
    };
  }, [layout.data]);

  const previewData = useMemo(() => ({
    product_name: product?.name,
    brand: undefined as string | undefined,
    internal_code: product?.internal_code,
    sku: product?.sku,
    ean: product?.ean,
    ingredients: product?.commercial_description,
    allergens: product?.contains_gluten || product?.contains_lactose
      ? `${product?.contains_gluten ? "Contém glúten. " : ""}${product?.contains_lactose ? "Contém lactose." : ""}`
      : undefined,
    gluten: product?.contains_gluten ? "CONTÉM GLÚTEN" : undefined,
    lactose: product?.contains_lactose ? "CONTÉM LACTOSE" : undefined,
    preservation: product?.preservation,
    lot: batchCode,
    manufacture_date: manufactureDate ? new Date(manufactureDate).toLocaleDateString("pt-BR") : undefined,
    expiry: expiration ? new Date(expiration).toLocaleDateString("pt-BR") : undefined,
    weight: weight ? `${weight} kg` : (product?.standard_weight ? `${product.standard_weight} ${product.unit_of_measure ?? ""}` : undefined),
    nutrition: nutrition.data,
    qr_payload: { product: product?.name, code: product?.internal_code, lot: batchCode, mfg: manufactureDate, exp: expiration, company_id: companyId },
    barcode_value: product?.ean || product?.internal_code,
  }), [product, batchCode, manufactureDate, expiration, weight, nutrition.data, companyId]);


  // Validations
  const blocking = useMemo(() => {
    const errs: string[] = [];
    if (!productId) errs.push("Selecione um produto.");
    if (!layoutId) errs.push("Selecione um layout.");
    if (quantity <= 0) errs.push("Quantidade deve ser maior que zero.");
    if (product && product.status !== "ativo") errs.push("Produto inativo.");
    if (layout.data && layout.data.status !== "ativo") errs.push("Layout inativo.");
    if (!version.data) errs.push("Layout não tem versão vigente.");
    if (product?.variable_weight && !weight) errs.push("Produto de peso variável — informe o peso.");
    if (labelType === "nutricional") {
      for (const m of blockingIssuesForNutritional(pending.data)) errs.push(m);
    }
    // Required layout elements
    if (elements.data) {
      const missingReq = elements.data.filter((e: any) => e.required).filter((e: any) => {
        if (e.element_type === "lot") return !batchCode;
        if (e.element_type === "manufacture_date") return !manufactureDate;
        if (e.element_type === "expiry") return !expiration;
        if (e.element_type === "weight") return product?.variable_weight ? !weight : false;
        return false;
      });
      if (missingReq.length) errs.push(`Campos obrigatórios do layout não preenchidos: ${missingReq.map((e: any) => e.element_type).join(", ")}`);
    }
    return errs;
  }, [productId, layoutId, quantity, product, layout.data, version.data, weight, labelType, pending.data, elements.data, batchCode, manufactureDate, expiration]);

  const canEmit = !isReadOnly && canCreateProduct && blocking.length === 0;

  // Emission
  const emit = useMutation({
    mutationFn: async () => {
      if (!companyId || !product || !layout.data || !version.data) throw new Error("Dados incompletos");
      const { data: userData } = await supabase.auth.getUser();
      const userId = userData.user?.id;

      // Insert batch
      const { data: batch, error: be } = await (supabase.from("print_batches" as any) as any).insert({
        company_id: companyId,
        branch_id: branchId || null,
        product_id: product.id,
        label_type: labelType,
        label_layout_id: layout.data.id,
        label_layout_version_id: version.data.id,
        printer_config_id: printerId || null,
        quantity,
        batch_code: batchCode || null,
        manufacture_date: manufactureDate || null,
        expiration_date: expiration || null,
        variable_weight: weight ? Number(weight) : null,
        layout_suggested: !!layoutSource && layoutSource !== "manual" && layoutSource !== "none",
        layout_suggestion_source: layoutSource || null,
        layout_overridden: layoutOverridden,
        status: "generated",
        requested_by: userId ?? null,
        notes: notes || null,
      }).select("*").single();
      if (be) throw be;

      // Build snapshots
      const printerSnap = printers.data?.find((p: any) => p.id === printerId) ?? null;
      const layoutSnap = {
        layout: layout.data,
        version: version.data,
        elements: elements.data ?? [],
        format: layout.data.label_formats,
      };
      const emissionSnap = {
        label_type: labelType,
        batch_code: batchCode,
        manufacture_date: manufactureDate,
        expiration_date: expiration,
        weight: weight ? Number(weight) : null,
        suggestion_source: layoutSource,
        overridden: layoutOverridden,
        emitted_at: new Date().toISOString(),
      };

      const productSnap = product;
      const nutSnap = nutrition.data ?? null;

      const companyShort = companyId.slice(0, 4).toUpperCase();
      const batchShort = batch.id.slice(0, 6).toUpperCase();

      // Build labels
      const rows: any[] = [];
      for (let i = 1; i <= quantity; i++) {
        const code = uniqueLabelCode(companyShort, batchShort, i);
        rows.push({
          company_id: companyId,
          branch_id: branchId || null,
          print_batch_id: batch.id,
          product_id: product.id,
          label_layout_id: layout.data.id,
          label_layout_version_id: version.data.id,
          unique_label_code: code,
          sequential_number: i,
          qr_code_payload: {
            id: code,
            product: product.name,
            internal_code: product.internal_code,
            batch: batchCode,
            mfg: manufactureDate,
            exp: expiration,
            company_id: companyId,
            emitted_at: emissionSnap.emitted_at,
          },
          barcode_value: product.ean || code,
          status: "generated",
          created_by: userId ?? null,
        });
      }

      const { data: inserted, error: ie } = await (supabase.from("printed_labels" as any) as any).insert(rows).select("id");
      if (ie) throw ie;

      // Snapshots — one per label (compact)
      const snapRows = (inserted as any[]).map((l) => ({
        company_id: companyId,
        branch_id: branchId || null,
        printed_label_id: l.id,
        product_snapshot: productSnap,
        nutrition_snapshot: nutSnap,
        ingredients_snapshot: null,
        allergens_snapshot: null,
        layout_snapshot: layoutSnap,
        printer_snapshot: printerSnap,
        emission_snapshot: emissionSnap,
      }));
      const { error: se } = await (supabase.from("label_snapshots" as any) as any).insert(snapRows);
      if (se) throw se;

      // Events
      const events: any[] = [
        {
          company_id: companyId,
          branch_id: branchId || null,
          print_batch_id: batch.id,
          event_type: "generated",
          event_notes: `Emitido ${quantity} etiqueta(s)`,
          metadata: { source: layoutSource, overridden: layoutOverridden },
          created_by: userId ?? null,
        },
      ];
      if (layoutSource && layoutSource !== "manual" && layoutSource !== "none") {
        events.push({
          company_id: companyId, branch_id: branchId || null, print_batch_id: batch.id,
          event_type: "layout_suggested", event_notes: SUGGESTION_SOURCE_LABEL[layoutSource] ?? layoutSource,
          created_by: userId ?? null,
        });
      }
      if (layoutSource === "none") {
        events.push({
          company_id: companyId, branch_id: branchId || null, print_batch_id: batch.id,
          event_type: "no_layout_suggestion", created_by: userId ?? null,
        });
      }
      if (layoutOverridden) {
        events.push({
          company_id: companyId, branch_id: branchId || null, print_batch_id: batch.id,
          event_type: "layout_changed", event_notes: "Operador trocou o layout sugerido", created_by: userId ?? null,
        });
      }
      await (supabase.from("print_events" as any) as any).insert(events);

      return batch.id as string;
    },
    onSuccess: (id) => {
      toast.success("Emissão registrada com sucesso");
      navigate({ to: "/app/print-history/$id", params: { id } });
    },
    onError: (e: any) => toast.error(e.message),
  });

  return (
    <div className="space-y-6">
      <PageHeader title="Emissão de Etiquetas" description="Nova emissão com sugestão automática de layout, snapshot histórico e validações regulatórias." />

      <div className="grid lg:grid-cols-3 gap-6">
        <Card className="p-5 space-y-4 lg:col-span-2">
          <div className="grid sm:grid-cols-2 gap-4">
            <div>
              <Label>Filial</Label>
              <Select value={branchId} onValueChange={setBranchId}>
                <SelectTrigger><SelectValue placeholder="(todas)" /></SelectTrigger>
                <SelectContent>
                  {branches.data?.map((b) => <SelectItem key={b.id} value={b.id}>{b.name}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
            <div>
              <Label>Tipo de etiqueta</Label>
              <Select value={labelType} onValueChange={(v) => setLabelType(v as LabelType)}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  {LABEL_TYPES.map((t) => <SelectItem key={t.value} value={t.value}>{t.label}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
            <div className="sm:col-span-2">
              <Label>Produto</Label>
              <Select value={productId} onValueChange={setProductId}>
                <SelectTrigger><SelectValue placeholder="Selecione o produto" /></SelectTrigger>
                <SelectContent>
                  {products.data?.map((p) => (
                    <SelectItem key={p.id} value={p.id}>
                      {p.name} {p.internal_code ? `· ${p.internal_code}` : ""}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="sm:col-span-2">
              <Label className="flex items-center gap-2">
                Layout {layoutSource && layoutSource !== "none" && (
                  <span className="text-xs text-muted-foreground">
                    (sugerido: {SUGGESTION_SOURCE_LABEL[layoutSource] ?? layoutSource}{layoutOverridden ? " — trocado" : ""})
                  </span>
                )}
              </Label>
              <div className="flex gap-2">
                <Select
                  value={layoutId}
                  onValueChange={(v) => { setLayoutId(v); setLayoutOverridden(true); setLayoutSource((s) => s === "none" ? "manual" : s); }}
                  disabled={!canWrite && !canCreateProduct}
                >
                  <SelectTrigger><SelectValue placeholder="Selecione um layout" /></SelectTrigger>
                  <SelectContent>
                    {layouts.data?.map((l) => (
                      <SelectItem key={l.id} value={l.id}>
                        {l.name}{l.label_type ? ` · ${l.label_type}` : ""}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                <Button variant="outline" onClick={() => suggest.mutate()} disabled={!productId} title="Sugerir novamente">
                  <Wand2 className="size-4" />
                </Button>
              </div>
            </div>

            <div>
              <Label>Impressora</Label>
              <Select value={printerId} onValueChange={setPrinterId}>
                <SelectTrigger><SelectValue placeholder="Selecione" /></SelectTrigger>
                <SelectContent>
                  {printers.data?.map((p) => <SelectItem key={p.id} value={p.id}>{p.name}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
            <div>
              <Label>Quantidade</Label>
              <Input type="number" min={1} value={quantity} onChange={(e) => setQuantity(Number(e.target.value))} />
            </div>
            <div>
              <Label>Lote</Label>
              <Input value={batchCode} onChange={(e) => setBatchCode(e.target.value)} placeholder="Ex: L20260619" />
            </div>
            <div>
              <Label>Peso (kg) {product?.variable_weight ? "— obrigatório" : "(opcional)"}</Label>
              <Input type="number" step="0.001" value={weight} onChange={(e) => setWeight(e.target.value)} />
            </div>
            <div>
              <Label>Data de fabricação</Label>
              <Input type="date" value={manufactureDate} onChange={(e) => setManufactureDate(e.target.value)} />
            </div>
            <div>
              <Label>Validade {product?.shelf_life_days ? `(auto: +${product.shelf_life_days}d)` : ""}</Label>
              <Input type="date" value={expiration} onChange={(e) => setExpiration(e.target.value)} />
            </div>
            <div className="sm:col-span-2">
              <Label>Observações</Label>
              <Textarea value={notes} onChange={(e) => setNotes(e.target.value)} rows={2} />
            </div>
          </div>

          {blocking.length > 0 && (
            <Alert variant="destructive">
              <AlertTriangle className="size-4" />
              <AlertTitle>Não é possível emitir</AlertTitle>
              <AlertDescription>
                <ul className="list-disc pl-5 text-sm">{blocking.map((b) => <li key={b}>{b}</li>)}</ul>
              </AlertDescription>
            </Alert>
          )}

          <div className="flex justify-end gap-2">
            <Button
              variant="outline"
              disabled={!previewFormat || !elements.data}
              onClick={async () => {
                if (!previewFormat || !elements.data) return;
                const { buildLabelsPdf, openBlob } = await import("@/lib/label-pdf");
                const blob = await buildLabelsPdf({
                  format: previewFormat as any,
                  elements: elements.data as any,
                  labels: [previewData as any],
                });
                openBlob(blob);
              }}
            >
              <PrinterIcon className="size-4 mr-2" /> Pré-visualizar PDF
            </Button>
            <Button onClick={() => emit.mutate()} disabled={!canEmit || emit.isPending}>
              <PrinterIcon className="size-4 mr-2" />
              {emit.isPending ? "Emitindo..." : `Confirmar emissão (${quantity})`}
            </Button>
          </div>
        </Card>

        <Card className="p-5 space-y-3">
          <div className="font-semibold">Pré-visualização</div>
          {previewFormat && elements.data ? (
            <div className="overflow-auto">
              <LabelPreview format={previewFormat} elements={elements.data} zoom={2} data={previewData as any} />
            </div>
          ) : (
            <div className="text-sm text-muted-foreground">Selecione produto e layout para pré-visualizar.</div>
          )}
          {role && (
            <div className="text-xs text-muted-foreground">Perfil ativo: <b>{role}</b></div>
          )}
        </Card>

      </div>
    </div>
  );
}
