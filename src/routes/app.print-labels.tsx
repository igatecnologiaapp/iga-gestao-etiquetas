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
  SHELF_MODELS,
  blockingIssuesForNutritional,
  computeExpiration,
  isShelfLabel,
  suggestLayout,
  uniqueLabelCode,
  type LabelType,
  type ShelfModel,
} from "@/lib/label-emission";
import { formatBRL } from "@/lib/label-pdf";

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
  const [shelfModel, setShelfModel] = useState<ShelfModel>("simples");
  const [promotionId, setPromotionId] = useState<string>("");

  const isShelf = isShelfLabel(labelType);

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

  // Ingredients selected for the product (joined with name)
  const productIngredients = useQuery({
    queryKey: ["em-prod-ingredients", productId],
    enabled: !!productId,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("product_ingredients")
        .select("position, ingredients(name)")
        .eq("product_id", productId)
        .order("position");
      if (error) throw error;
      return (data ?? []) as any[];
    },
  });

  // Allergens selected for the product (joined with name)
  const productAllergens = useQuery({
    queryKey: ["em-prod-allergens", productId],
    enabled: !!productId,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("product_allergens")
        .select("allergens(name, code)")
        .eq("product_id", productId);
      if (error) throw error;
      return (data ?? []) as any[];
    },
  });


  // Phase 6 — product price (regular/wholesale) for the product+branch
  const productPrice = useQuery({
    queryKey: ["em-price", companyId, productId, branchId],
    enabled: !!companyId && !!productId && isShelf,
    queryFn: async () => {
      let q = (supabase.from("product_prices" as any) as any)
        .select("*").eq("company_id", companyId!).eq("product_id", productId);
      const { data, error } = await q;
      if (error) throw error;
      const list = (data as any[]) ?? [];
      return list.find((p) => p.branch_id === (branchId || null)) ?? list.find((p) => p.branch_id == null) ?? null;
    },
  });

  // Phase 6 — active promotions for product
  const activePromotions = useQuery({
    queryKey: ["em-promos", companyId, productId],
    enabled: !!companyId && !!productId && isShelf,
    queryFn: async () => {
      const nowIso = new Date().toISOString();
      const { data, error } = await (supabase.from("promotion_products" as any) as any)
        .select("*, promotions:promotion_id(id,name,status,start_date,end_date)")
        .eq("company_id", companyId!).eq("product_id", productId).eq("status", "ativo");
      if (error) throw error;
      return ((data as any[]) ?? []).filter((row) => {
        const p = row.promotions;
        return p && p.status === "active" && p.start_date <= nowIso && p.end_date >= nowIso;
      });
    },
  });

  // Auto-pick first active promotion when shelf=promocional
  useEffect(() => {
    if (!isShelf) { setPromotionId(""); return; }
    if (shelfModel === "promocional" && !promotionId && activePromotions.data?.length) {
      setPromotionId(activePromotions.data[0].promotion_id);
    }
  }, [isShelf, shelfModel, activePromotions.data, promotionId]);

  const activePromo = useMemo(
    () => activePromotions.data?.find((p) => p.promotion_id === promotionId) ?? null,
    [activePromotions.data, promotionId],
  );

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

  const previewData = useMemo(() => {
    const reg = productPrice.data?.regular_price ?? activePromo?.regular_price ?? null;
    const promo = shelfModel === "promocional" ? (activePromo?.promotional_price ?? productPrice.data?.current_promotional_price ?? null) : null;
    const whp = shelfModel === "atacado" ? (activePromo?.wholesale_price ?? productPrice.data?.wholesale_price ?? null) : null;
    const whq = shelfModel === "atacado" ? (activePromo?.wholesale_min_quantity ?? productPrice.data?.wholesale_min_quantity ?? null) : null;
    return {
      product_name: product?.name,
      brand: undefined as string | undefined,
      internal_code: product?.internal_code,
      sku: product?.sku,
      ean: product?.ean,
      ingredients: (() => {
        const list = (productIngredients.data ?? [])
          .map((r: any) => r?.ingredients?.name)
          .filter(Boolean);
        if (list.length) return list.join(", ");
        return product?.commercial_description || undefined;
      })(),
      allergens: (() => {
        const list = (productAllergens.data ?? [])
          .map((r: any) => r?.allergens?.name)
          .filter(Boolean);
        if (list.length) return `Contém: ${list.join(", ")}`;
        if (product?.contains_lactose) return "Contém lactose.";
        return undefined;
      })(),
      gluten: product
        ? (product.contains_gluten ? "CONTÉM GLÚTEN" : "NÃO CONTÉM GLÚTEN")
        : undefined,
      lactose: product
        ? (product.contains_lactose ? "CONTÉM LACTOSE" : "NÃO CONTÉM LACTOSE")
        : undefined,
      preservation: product?.preservation,
      lot: batchCode,
      manufacture_date: manufactureDate ? new Date(manufactureDate).toLocaleDateString("pt-BR") : undefined,
      expiry: expiration ? new Date(expiration).toLocaleDateString("pt-BR") : undefined,
      weight: weight ? `${weight} kg` : (product?.standard_weight ? `${product.standard_weight} ${product.unit_of_measure ?? ""}` : undefined),
      nutrition: nutrition.data,
      sale_unit: productPrice.data?.sale_unit ?? product?.unit_of_measure,
      regular_price: reg != null ? formatBRL(Number(reg)) : undefined,
      promotional_price: promo != null ? formatBRL(Number(promo)) : undefined,
      previous_price: promo != null && reg != null ? formatBRL(Number(reg)) : undefined,
      wholesale_price: whp != null ? formatBRL(Number(whp)) : undefined,
      wholesale_min_quantity: whq != null ? String(whq) : undefined,
      promotion_name: activePromo?.promotions?.name,
      promotion_rules: activePromo?.promotion_rules,
      promotion_start: activePromo?.promotions?.start_date ? new Date(activePromo.promotions.start_date).toLocaleDateString("pt-BR") : undefined,
      promotion_end: activePromo?.promotions?.end_date ? new Date(activePromo.promotions.end_date).toLocaleDateString("pt-BR") : undefined,
      qr_payload: { product: product?.name, code: product?.internal_code, lot: batchCode, mfg: manufactureDate, exp: expiration, company_id: companyId, label_type: labelType },
      barcode_value: product?.ean || product?.internal_code,
    };
  }, [product, batchCode, manufactureDate, expiration, weight, nutrition.data, companyId, labelType, productPrice.data, activePromo, shelfModel]);


  // Validations
  const blocking = useMemo(() => {
    const errs: string[] = [];
    if (!productId) errs.push("Selecione um produto.");
    if (!layoutId) errs.push("Selecione um layout.");
    if (quantity <= 0) errs.push("Quantidade deve ser maior que zero.");
    if (product && product.status !== "ativo") errs.push("Produto inativo.");
    if (layout.data && layout.data.status !== "ativo") errs.push("Layout inativo.");
    if (!version.data) errs.push("Layout não tem versão vigente.");
    if (product?.variable_weight && !weight && !isShelf) errs.push("Produto de peso variável — informe o peso.");
    if (labelType === "nutricional") {
      for (const m of blockingIssuesForNutritional(pending.data)) errs.push(m);
    }
    if (isShelf) {
      const reg = productPrice.data?.regular_price ?? activePromo?.regular_price;
      if (reg == null) errs.push("Produto sem preço normal cadastrado.");
      if (shelfModel === "promocional") {
        if (!activePromo) errs.push("Nenhuma promoção ativa para este produto.");
        else if (activePromo.promotional_price == null) errs.push("Promoção sem preço promocional definido.");
      }
      if (shelfModel === "atacado") {
        const whp = activePromo?.wholesale_price ?? productPrice.data?.wholesale_price;
        const whq = activePromo?.wholesale_min_quantity ?? productPrice.data?.wholesale_min_quantity;
        if (whp == null || whq == null) errs.push("Preço por quantidade (atacado) não definido.");
      }
    }
    // Required layout elements
    if (elements.data && !isShelf) {
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
  }, [productId, layoutId, quantity, product, layout.data, version.data, weight, labelType, pending.data, elements.data, batchCode, manufactureDate, expiration, isShelf, shelfModel, productPrice.data, activePromo]);

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
      const reg = productPrice.data?.regular_price ?? activePromo?.regular_price ?? null;
      const promoPrice = shelfModel === "promocional" ? (activePromo?.promotional_price ?? null) : null;
      const whp = shelfModel === "atacado" ? (activePromo?.wholesale_price ?? productPrice.data?.wholesale_price ?? null) : null;
      const whq = shelfModel === "atacado" ? (activePromo?.wholesale_min_quantity ?? productPrice.data?.wholesale_min_quantity ?? null) : null;
      const emissionSnap = {
        label_type: labelType,
        shelf_model: isShelf ? shelfModel : null,
        batch_code: batchCode,
        manufacture_date: manufactureDate,
        expiration_date: expiration,
        weight: weight ? Number(weight) : null,
        suggestion_source: layoutSource,
        overridden: layoutOverridden,
        emitted_at: new Date().toISOString(),
        sale_unit: productPrice.data?.sale_unit ?? product.unit_of_measure ?? null,
        regular_price: reg != null ? Number(reg) : null,
        promotional_price: promoPrice != null ? Number(promoPrice) : null,
        previous_price: promoPrice != null && reg != null ? Number(reg) : null,
        wholesale_price: whp != null ? Number(whp) : null,
        wholesale_min_quantity: whq != null ? Number(whq) : null,
        promotion_id: activePromo?.promotion_id ?? null,
        promotion_name: activePromo?.promotions?.name ?? null,
        promotion_rules: activePromo?.promotion_rules ?? null,
        promotion_start: activePromo?.promotions?.start_date ?? null,
        promotion_end: activePromo?.promotions?.end_date ?? null,
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
              <Label>Unidade</Label>
              <Select value={branchId} onValueChange={setBranchId}>
                <SelectTrigger><SelectValue placeholder="(todas)" /></SelectTrigger>
                <SelectContent>
                  {branches.data?.map((b) => <SelectItem key={b.id} value={b.id}>{b.name.replace(/Filial/gi, "Unidade")}</SelectItem>)}
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

            {isShelf && (
              <>
                <div>
                  <Label>Modelo de gôndola</Label>
                  <Select value={shelfModel} onValueChange={(v) => setShelfModel(v as ShelfModel)}>
                    <SelectTrigger><SelectValue /></SelectTrigger>
                    <SelectContent>
                      {SHELF_MODELS.map((m) => <SelectItem key={m.value} value={m.value}>{m.label}</SelectItem>)}
                    </SelectContent>
                  </Select>
                </div>
                <div>
                  <Label>Promoção ativa {activePromotions.data?.length ? `(${activePromotions.data.length})` : ""}</Label>
                  <Select value={promotionId} onValueChange={setPromotionId} disabled={!activePromotions.data?.length}>
                    <SelectTrigger><SelectValue placeholder="(nenhuma)" /></SelectTrigger>
                    <SelectContent>
                      {activePromotions.data?.map((p: any) => (
                        <SelectItem key={p.promotion_id} value={p.promotion_id}>
                          {p.promotions?.name} {p.promotional_price != null ? `· ${formatBRL(Number(p.promotional_price))}` : ""}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <div className="sm:col-span-2 grid grid-cols-2 sm:grid-cols-4 gap-3 text-sm">
                  <div className="rounded-md border p-2"><div className="text-xs text-muted-foreground">Preço normal</div><div className="font-semibold">{productPrice.data?.regular_price != null ? formatBRL(Number(productPrice.data.regular_price)) : "—"}</div></div>
                  <div className="rounded-md border p-2"><div className="text-xs text-muted-foreground">Promocional</div><div className="font-semibold">{activePromo?.promotional_price != null ? formatBRL(Number(activePromo.promotional_price)) : "—"}</div></div>
                  <div className="rounded-md border p-2"><div className="text-xs text-muted-foreground">Atacado</div><div className="font-semibold">{(activePromo?.wholesale_price ?? productPrice.data?.wholesale_price) != null ? formatBRL(Number(activePromo?.wholesale_price ?? productPrice.data?.wholesale_price)) : "—"}</div></div>
                  <div className="rounded-md border p-2"><div className="text-xs text-muted-foreground">Qtd. mín.</div><div className="font-semibold">{activePromo?.wholesale_min_quantity ?? productPrice.data?.wholesale_min_quantity ?? "—"}</div></div>
                </div>
              </>
            )}


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
              <Label>Impressora preferencial</Label>
              <Select value={printerId} onValueChange={setPrinterId}>
                <SelectTrigger><SelectValue placeholder={printers.data?.length ? "Selecione" : "Nenhuma cadastrada"} /></SelectTrigger>
                <SelectContent>
                  {printers.data?.map((p) => (
                    <SelectItem key={p.id} value={p.id}>
                      {p.name}{p.is_default ? " (padrão)" : ""}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <p className="text-[11px] text-muted-foreground mt-1 leading-tight">
                A escolha é registrada na emissão. Por limitação do navegador, a impressão é feita pelo diálogo nativo do sistema operacional ao abrir o PDF.
              </p>
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
            <FitPreview format={previewFormat} elements={elements.data} data={previewData as any} />
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

const UNIT_PX: Record<string, number> = { mm: 3.78, cm: 37.8, in: 96, px: 1 };

function FitPreview({
  format,
  elements,
  data,
}: {
  format: PreviewFormat;
  elements: PreviewElement[];
  data: any;
}) {
  const containerRef = useState<HTMLDivElement | null>(null);
  const [ref, setRef] = containerRef;
  const [zoom, setZoom] = useState(2);

  useEffect(() => {
    if (!ref) return;
    const baseW = format.width * (UNIT_PX[format.unit] ?? 3.78);
    const baseH = format.height * (UNIT_PX[format.unit] ?? 3.78);
    const compute = () => {
      const cw = ref.clientWidth || 1;
      const maxH = 520;
      const z = Math.max(0.5, Math.min(6, Math.min(cw / baseW, maxH / baseH)));
      setZoom(z);
    };
    compute();
    const ro = new ResizeObserver(compute);
    ro.observe(ref);
    return () => ro.disconnect();
  }, [ref, format.width, format.height, format.unit]);

  return (
    <div ref={setRef} className="w-full flex justify-center items-start overflow-hidden">
      <LabelPreview format={format} elements={elements} zoom={zoom} data={data} />
    </div>
  );
}

