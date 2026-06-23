import { createFileRoute, Link } from "@tanstack/react-router";
import { useState, useMemo } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useActiveCompany } from "@/hooks/use-active-company";
import { PageHeader } from "@/components/page-header";
import { StatusBadge } from "@/components/status-badge";
import { LabelPreview, type PreviewElement } from "@/components/label-preview";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Card } from "@/components/ui/card";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Plus, Trash2, Copy, Save, GitBranch, ChevronUp, ChevronDown, AlertTriangle } from "lucide-react";
import { toast } from "sonner";
import { checkNutritionElementHeight } from "@/lib/nutrition-layout-rules";

export const Route = createFileRoute("/app/layouts/$id")({
  component: LayoutEditorPage,
});

const ELEMENT_TYPES: { value: string; label: string }[] = [
  { value: "product_name", label: "Nome do produto" },
  { value: "internal_code", label: "Código interno" },
  { value: "sku", label: "SKU" },
  { value: "barcode", label: "Código de barras" },
  { value: "qrcode", label: "QR Code" },
  { value: "logo", label: "Logotipo" },
  { value: "brand", label: "Marca" },
  { value: "weight", label: "Peso" },
  { value: "lot", label: "Lote" },
  { value: "expiry", label: "Validade" },
  { value: "manufacture_date", label: "Data de fabricação" },
  { value: "ingredients", label: "Ingredientes" },
  { value: "preservation", label: "Conservação" },
  { value: "allergens", label: "Alergênicos" },
  { value: "gluten", label: "Glúten" },
  { value: "lactose", label: "Lactose" },
  { value: "nutrition_facts", label: "Informações nutricionais" },
  { value: "price", label: "Preço" },
  { value: "custom_field", label: "Campo personalizado" },
  { value: "fixed_text", label: "Texto fixo" },
  { value: "image", label: "Imagem" },
  { value: "line", label: "Linha" },
  { value: "box", label: "Caixa" },
];

function LayoutEditorPage() {
  const { id } = Route.useParams();
  const qc = useQueryClient();
  const { companyId, canWrite } = useActiveCompany();
  const [zoom, setZoom] = useState(2);
  const [addType, setAddType] = useState("product_name");
  const [versionReason, setVersionReason] = useState("");

  const layout = useQuery({
    queryKey: ["layout", id],
    queryFn: async () => {
      const { data, error } = await (supabase.from("label_layouts" as any) as any)
        .select("*, label_categories(name), label_formats(*)").eq("id", id).single();
      if (error) throw error;
      return data as any;
    },
  });

  const versions = useQuery({
    queryKey: ["layout-versions", id],
    queryFn: async () => {
      const { data, error } = await (supabase.from("label_layout_versions" as any) as any)
        .select("*").eq("layout_id", id).order("version", { ascending: false });
      if (error) throw error;
      return data as any[];
    },
  });

  const currentVersion = useMemo(
    () => versions.data?.find((v) => v.version === layout.data?.current_version),
    [versions.data, layout.data?.current_version],
  );

  const elements = useQuery({
    queryKey: ["layout-elements", currentVersion?.id],
    enabled: !!currentVersion?.id,
    queryFn: async () => {
      const { data, error } = await (supabase.from("label_layout_elements" as any) as any)
        .select("*").eq("version_id", currentVersion!.id).order("layer", { ascending: true });
      if (error) throw error;
      return data as any[];
    },
  });

  const associations = useQuery({
    queryKey: ["layout-associations", id],
    queryFn: async () => {
      const { data, error } = await (supabase.from("layout_associations" as any) as any)
        .select("*").eq("layout_id", id);
      if (error) throw error;
      return data as any[];
    },
  });

  const addElement = useMutation({
    mutationFn: async () => {
      const maxLayer = Math.max(0, ...(elements.data?.map((e) => e.layer ?? 0) ?? []));
      const { error } = await (supabase.from("label_layout_elements" as any) as any).insert({
        company_id: companyId,
        version_id: currentVersion!.id,
        element_type: addType,
        pos_x: 5, pos_y: 5, width: 40, height: 8,
        layer: maxLayer + 1,
        font_size: 10, font_family: "Inter", color: "#111111", align: "left",
        visible: true,
      });
      if (error) throw error;
    },
    onSuccess: () => { qc.invalidateQueries({ queryKey: ["layout-elements"] }); },
    onError: (e: any) => toast.error(e.message),
  });

  const updateElement = useMutation({
    mutationFn: async ({ id: elId, patch }: { id: string; patch: any }) => {
      const { error } = await (supabase.from("label_layout_elements" as any) as any)
        .update(patch).eq("id", elId);
      if (error) throw error;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ["layout-elements"] }),
    onError: (e: any) => toast.error(e.message),
  });

  const deleteElement = useMutation({
    mutationFn: async (elId: string) => {
      const { error } = await (supabase.from("label_layout_elements" as any) as any).delete().eq("id", elId);
      if (error) throw error;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ["layout-elements"] }),
    onError: (e: any) => toast.error(e.message),
  });

  const duplicateElement = useMutation({
    mutationFn: async (row: any) => {
      const { id: _i, created_at, updated_at, ...rest } = row;
      const { error } = await (supabase.from("label_layout_elements" as any) as any).insert({
        ...rest, pos_x: (rest.pos_x ?? 0) + 5, pos_y: (rest.pos_y ?? 0) + 5,
      });
      if (error) throw error;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ["layout-elements"] }),
    onError: (e: any) => toast.error(e.message),
  });

  const createVersion = useMutation({
    mutationFn: async () => {
      const next = (layout.data?.current_version ?? 0) + 1;
      const { data: newVer, error } = await (supabase.from("label_layout_versions" as any) as any).insert({
        company_id: companyId,
        layout_id: id,
        version: next,
        change_reason: versionReason || `Nova versão ${next}`,
      }).select("id").single();
      if (error) throw error;
      // copy elements from current version
      if (elements.data?.length) {
        const clones = elements.data.map(({ id, created_at, updated_at, version_id, ...rest }: any) => ({
          ...rest, version_id: newVer.id,
        }));
        await (supabase.from("label_layout_elements" as any) as any).insert(clones);
      }
      const { error: uErr } = await (supabase.from("label_layouts" as any) as any)
        .update({ current_version: next, locked: false }).eq("id", id);
      if (uErr) throw uErr;
    },
    onSuccess: () => {
      toast.success("Nova versão criada");
      setVersionReason("");
      qc.invalidateQueries({ queryKey: ["layout", id] });
      qc.invalidateQueries({ queryKey: ["layout-versions", id] });
    },
    onError: (e: any) => toast.error(e.message),
  });

  const switchVersion = useMutation({
    mutationFn: async (version: number) => {
      const { error } = await (supabase.from("label_layouts" as any) as any)
        .update({ current_version: version }).eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => { qc.invalidateQueries({ queryKey: ["layout", id] }); },
  });

  const changeStatus = useMutation({
    mutationFn: async (status: string) => {
      const { error } = await (supabase.from("label_layouts" as any) as any)
        .update({ status }).eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ["layout", id] }),
  });

  if (layout.isLoading) return <div>Carregando…</div>;
  if (!layout.data) return <div>Layout não encontrado.</div>;
  const fmt = layout.data.label_formats;

  // Validação de altura mínima do bloco nutrition_facts.
  // Não reduzimos a fonte indefinidamente nem permitimos corte silencioso
  // de Fibra, Sódio ou Observações — alertamos no editor.
  const nutritionIssues = (elements.data ?? [])
    .filter((e) => e.element_type === "nutrition_facts")
    .map((e) => ({
      el: e,
      check: fmt
        ? checkNutritionElementHeight(Number(e.height), Number(e.width), fmt.unit)
        : null,
    }))
    .filter((x) => x.check && x.check.level !== "ok");


  return (
    <>
      <PageHeader
        title={layout.data.name}
        description={layout.data.description || layout.data.label_categories?.name || "Layout"}
        actions={
          <div className="flex gap-2 items-center">
            <Link to="/app/layouts" className="text-sm underline">← Voltar</Link>
            <StatusBadge status={layout.data.status} />
            {canWrite && (
              <Select value={layout.data.status} onValueChange={(v) => changeStatus.mutate(v)}>
                <SelectTrigger className="w-[140px]"><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="ativo">Ativo</SelectItem>
                  <SelectItem value="inativo">Inativo</SelectItem>
                  <SelectItem value="arquivado">Arquivado</SelectItem>
                </SelectContent>
              </Select>
            )}
          </div>
        }
      />

      <Tabs defaultValue="editor" className="space-y-4">
        <TabsList>
          <TabsTrigger value="editor">Editor</TabsTrigger>
          <TabsTrigger value="versions">Versões</TabsTrigger>
          <TabsTrigger value="associations">Associações</TabsTrigger>
        </TabsList>

        <TabsContent value="editor" className="space-y-4">
          <div className="grid lg:grid-cols-[1fr_minmax(0,420px)] gap-4">
            <Card className="p-4">
              {nutritionIssues.length > 0 && (
                <Alert
                  variant={nutritionIssues.some((i) => i.check?.level === "error") ? "destructive" : "default"}
                  className="mb-3"
                >
                  <AlertTriangle className="size-4" />
                  <AlertTitle>
                    {nutritionIssues.some((i) => i.check?.level === "error")
                      ? "Altura insuficiente para exibir a tabela nutricional completa"
                      : "Tabela nutricional abaixo da altura recomendada"}
                  </AlertTitle>
                  <AlertDescription className="space-y-1">
                    {nutritionIssues.map((i, idx) => (
                      <div key={idx} className="text-xs">
                        Bloco nutrição em {Math.round(i.check!.heightMm)} mm —{" "}
                        mínimo {i.check!.minMm} mm, recomendado {i.check!.recommendedMm} mm.
                        {" "}
                        {i.check!.message}
                      </div>
                    ))}
                  </AlertDescription>
                </Alert>
              )}
              {canWrite && (
                <div className="flex items-end gap-2 mb-3">
                  <div className="flex-1">
                    <Label>Adicionar elemento</Label>
                    <Select value={addType} onValueChange={setAddType}>
                      <SelectTrigger><SelectValue /></SelectTrigger>
                      <SelectContent>
                        {ELEMENT_TYPES.map((t) => <SelectItem key={t.value} value={t.value}>{t.label}</SelectItem>)}
                      </SelectContent>
                    </Select>
                  </div>
                  <Button onClick={() => addElement.mutate()}><Plus className="size-4" /> Adicionar</Button>
                </div>
              )}

              <div className="overflow-x-auto">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Tipo</TableHead>
                      <TableHead className="w-[80px]">X</TableHead>
                      <TableHead className="w-[80px]">Y</TableHead>
                      <TableHead className="w-[80px]">L</TableHead>
                      <TableHead className="w-[80px]">A</TableHead>
                      <TableHead className="w-[70px]">Fonte</TableHead>
                      <TableHead className="w-[60px]">Cam</TableHead>
                      <TableHead>Texto/Campo</TableHead>
                      <TableHead className="w-[100px]"></TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {elements.data?.map((el) => (
                      <TableRow key={el.id}>
                        <TableCell>{ELEMENT_TYPES.find((t) => t.value === el.element_type)?.label ?? el.element_type}</TableCell>
                        <TableCell><Input type="number" step="0.5" disabled={!canWrite} value={el.pos_x} onChange={(e) => updateElement.mutate({ id: el.id, patch: { pos_x: Number(e.target.value) } })} /></TableCell>
                        <TableCell><Input type="number" step="0.5" disabled={!canWrite} value={el.pos_y} onChange={(e) => updateElement.mutate({ id: el.id, patch: { pos_y: Number(e.target.value) } })} /></TableCell>
                        <TableCell><Input type="number" step="0.5" disabled={!canWrite} value={el.width} onChange={(e) => updateElement.mutate({ id: el.id, patch: { width: Number(e.target.value) } })} /></TableCell>
                        <TableCell><Input type="number" step="0.5" disabled={!canWrite} value={el.height} onChange={(e) => {
                          const v = Number(e.target.value);
                          if (el.element_type === "nutrition_facts" && fmt) {
                            const c = checkNutritionElementHeight(v, Number(el.width), fmt.unit);
                            if (c.level === "error") {
                              toast.error(c.message ?? "Altura insuficiente para a tabela nutricional.");
                              return;
                            }
                            if (c.level === "warning") toast.warning(c.message ?? "Altura abaixo do recomendado.");
                          }
                          updateElement.mutate({ id: el.id, patch: { height: v } });
                        }} /></TableCell>
                        <TableCell><Input type="number" step="0.5" disabled={!canWrite} value={el.font_size ?? 10} onChange={(e) => updateElement.mutate({ id: el.id, patch: { font_size: Number(e.target.value) } })} /></TableCell>
                        <TableCell>
                          <div className="flex gap-1">
                            <Button size="icon" variant="ghost" disabled={!canWrite} onClick={() => updateElement.mutate({ id: el.id, patch: { layer: (el.layer ?? 0) + 1 } })}><ChevronUp className="size-3" /></Button>
                            <Button size="icon" variant="ghost" disabled={!canWrite} onClick={() => updateElement.mutate({ id: el.id, patch: { layer: Math.max(0, (el.layer ?? 0) - 1) } })}><ChevronDown className="size-3" /></Button>
                          </div>
                        </TableCell>
                        <TableCell>
                          {el.element_type === "fixed_text" ? (
                            <Input disabled={!canWrite} value={el.fixed_text ?? ""} onChange={(e) => updateElement.mutate({ id: el.id, patch: { fixed_text: e.target.value } })} />
                          ) : el.element_type === "custom_field" ? (
                            <Input disabled={!canWrite} placeholder="chave" value={el.bound_field ?? ""} onChange={(e) => updateElement.mutate({ id: el.id, patch: { bound_field: e.target.value } })} />
                          ) : (
                            <span className="text-xs text-muted-foreground">—</span>
                          )}
                        </TableCell>
                        <TableCell>
                          {canWrite && (
                            <div className="flex gap-1">
                              <Button size="icon" variant="ghost" onClick={() => duplicateElement.mutate(el)}><Copy className="size-3" /></Button>
                              <Button size="icon" variant="ghost" onClick={() => deleteElement.mutate(el.id)}><Trash2 className="size-3" /></Button>
                            </div>
                          )}
                        </TableCell>
                      </TableRow>
                    ))}
                    {!elements.data?.length && (
                      <TableRow><TableCell colSpan={9} className="text-center text-muted-foreground py-6">Nenhum elemento. Use "Adicionar".</TableCell></TableRow>
                    )}
                  </TableBody>
                </Table>
              </div>
            </Card>

            <Card className="p-4">
              <div className="flex items-center justify-between mb-3">
                <Label>Pré-visualização</Label>
                <Select value={String(zoom)} onValueChange={(v) => setZoom(Number(v))}>
                  <SelectTrigger className="w-[110px]"><SelectValue /></SelectTrigger>
                  <SelectContent>
                    {[1, 1.5, 2, 3, 4].map((z) => <SelectItem key={z} value={String(z)}>Zoom {z}×</SelectItem>)}
                  </SelectContent>
                </Select>
              </div>
              {fmt && (
                <div className="overflow-auto">
                  <LabelPreview
                    zoom={zoom}
                    format={{
                      width: Number(fmt.width), height: Number(fmt.height), unit: fmt.unit,
                      margin_top: Number(fmt.margin_top), margin_bottom: Number(fmt.margin_bottom),
                      margin_left: Number(fmt.margin_left), margin_right: Number(fmt.margin_right),
                      orientation: fmt.orientation,
                    }}
                    elements={(elements.data ?? []) as PreviewElement[]}
                  />
                </div>
              )}
              <p className="text-xs text-muted-foreground mt-3">Borda vermelha indica elemento fora da área útil.</p>
            </Card>
          </div>
        </TabsContent>

        <TabsContent value="versions" className="space-y-4">
          <Card className="p-4">
            <div className="flex items-end gap-2 mb-4">
              <div className="flex-1">
                <Label>Motivo da nova versão</Label>
                <Input value={versionReason} onChange={(e) => setVersionReason(e.target.value)} placeholder="Ex.: ajuste de tabela nutricional" />
              </div>
              <Button onClick={() => createVersion.mutate()} disabled={!canWrite || createVersion.isPending}>
                <GitBranch className="size-4" /> Nova versão
              </Button>
            </div>
            <Table>
              <TableHeader>
                <TableRow><TableHead>Versão</TableHead><TableHead>Motivo</TableHead><TableHead>Criada em</TableHead><TableHead>Atual</TableHead><TableHead></TableHead></TableRow>
              </TableHeader>
              <TableBody>
                {versions.data?.map((v) => (
                  <TableRow key={v.id}>
                    <TableCell>v{v.version}</TableCell>
                    <TableCell>{v.change_reason ?? "—"}</TableCell>
                    <TableCell>{new Date(v.created_at).toLocaleString("pt-BR")}</TableCell>
                    <TableCell>{v.version === layout.data.current_version ? "Sim" : "—"}</TableCell>
                    <TableCell>
                      {canWrite && v.version !== layout.data.current_version && (
                        <Button size="sm" variant="outline" onClick={() => switchVersion.mutate(v.version)}>Tornar atual</Button>
                      )}
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </Card>
        </TabsContent>

        <TabsContent value="associations">
          <AssociationsPanel layoutId={id} associations={associations.data ?? []} canWrite={!!canWrite} companyId={companyId!} onChange={() => qc.invalidateQueries({ queryKey: ["layout-associations", id] })} />
        </TabsContent>
      </Tabs>
    </>
  );
}

function AssociationsPanel({
  layoutId, associations, canWrite, companyId, onChange,
}: { layoutId: string; associations: any[]; canWrite: boolean; companyId: string; onChange: () => void }) {
  const [target, setTarget] = useState<string>("category");
  const [targetId, setTargetId] = useState<string>("");
  const [priority, setPriority] = useState(0);

  const options = useQuery({
    queryKey: ["assoc-options", companyId, target],
    enabled: !!companyId && ["product", "category", "brand", "branch"].includes(target),
    queryFn: async () => {
      const map: Record<string, string> = { product: "products", category: "categories", brand: "brands", branch: "branches" };
      const tbl = map[target];
      if (!tbl) return [];
      const { data } = await (supabase.from(tbl as any) as any).select("id,name").eq("company_id", companyId).order("name");
      return data ?? [];
    },
  });

  const add = useMutation({
    mutationFn: async () => {
      const payload: any = {
        company_id: companyId, layout_id: layoutId, target_type: target, priority,
        target_id: target === "company" ? companyId : targetId || null,
      };
      const { error } = await (supabase.from("layout_associations" as any) as any).insert(payload);
      if (error) throw error;
    },
    onSuccess: () => { toast.success("Associação criada"); setTargetId(""); onChange(); },
    onError: (e: any) => toast.error(e.message),
  });

  const remove = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await (supabase.from("layout_associations" as any) as any).delete().eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => onChange(),
  });

  return (
    <Card className="p-4 space-y-4">
      {canWrite && (
        <div className="grid md:grid-cols-[160px_1fr_120px_auto] gap-2 items-end">
          <div>
            <Label>Tipo</Label>
            <Select value={target} onValueChange={(v) => { setTarget(v); setTargetId(""); }}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="product">Produto</SelectItem>
                <SelectItem value="category">Categoria</SelectItem>
                <SelectItem value="brand">Marca</SelectItem>
                <SelectItem value="branch">Filial</SelectItem>
                <SelectItem value="company">Empresa (atual)</SelectItem>
              </SelectContent>
            </Select>
          </div>
          <div>
            <Label>Alvo</Label>
            {target === "company" ? (
              <Input disabled value="Empresa atual" />
            ) : (
              <Select value={targetId} onValueChange={setTargetId}>
                <SelectTrigger><SelectValue placeholder="Selecione" /></SelectTrigger>
                <SelectContent>
                  {options.data?.map((o: any) => <SelectItem key={o.id} value={o.id}>{o.name}</SelectItem>)}
                </SelectContent>
              </Select>
            )}
          </div>
          <div>
            <Label>Prioridade</Label>
            <Input type="number" value={priority} onChange={(e) => setPriority(Number(e.target.value))} />
          </div>
          <Button onClick={() => add.mutate()}><Plus className="size-4" /> Vincular</Button>
        </div>
      )}
      <Table>
        <TableHeader>
          <TableRow><TableHead>Tipo</TableHead><TableHead>Alvo</TableHead><TableHead>Prioridade</TableHead><TableHead></TableHead></TableRow>
        </TableHeader>
        <TableBody>
          {associations.map((a) => (
            <TableRow key={a.id}>
              <TableCell>{a.target_type}</TableCell>
              <TableCell className="font-mono text-xs">{a.target_id ?? "—"}</TableCell>
              <TableCell>{a.priority}</TableCell>
              <TableCell>{canWrite && <Button size="sm" variant="ghost" onClick={() => remove.mutate(a.id)}><Trash2 className="size-4" /></Button>}</TableCell>
            </TableRow>
          ))}
          {!associations.length && <TableRow><TableCell colSpan={4} className="text-center text-muted-foreground py-6">Sem associações.</TableCell></TableRow>}
        </TableBody>
      </Table>
      <p className="text-xs text-muted-foreground">
        Hierarquia de sugestão (futura): produto → categoria → marca → filial → empresa → padrão global da categoria.
      </p>
    </Card>
  );
}
