import { createFileRoute } from "@tanstack/react-router";
import { useMemo, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useActiveCompany } from "@/hooks/use-active-company";
import { PageHeader } from "@/components/page-header";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Card } from "@/components/ui/card";
import { Checkbox } from "@/components/ui/checkbox";
import { Badge } from "@/components/ui/badge";
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { StatusBadge } from "@/components/status-badge";
import { NutritionTable } from "@/components/nutrition-table";
import { Plus, Pencil, Eye, Search } from "lucide-react";
import { toast } from "sonner";

export const Route = createFileRoute("/app/products")({
  head: () => ({ meta: [{ title: "Produtos — Etiquetas" }] }),
  component: ProductsPage,
});

const STATUSES = ["ativo", "inativo", "pendente", "revisao_necessaria"] as const;
const PAGE_SIZE = 10;

type FormState = {
  internal_code: string; ean: string; sku: string; name: string;
  category_id: string; subcategory_id: string; brand_id: string;
  unit_of_measure: string; standard_weight: string; variable_weight: boolean;
  commercial_description: string;
  nutrition_fact_id: string;
  contains_gluten: boolean; contains_lactose: boolean;
  preservation: string; preparation: string;
  shelf_life_days: string; storage_temperature: string;
  legal_notes: string; image_url: string;
  status: string;
  ingredient_ids: string[];
  allergen_ids: string[];
};

const emptyForm = (): FormState => ({
  internal_code: "", ean: "", sku: "", name: "",
  category_id: "", subcategory_id: "", brand_id: "",
  unit_of_measure: "un", standard_weight: "", variable_weight: false,
  commercial_description: "",
  nutrition_fact_id: "",
  contains_gluten: false, contains_lactose: false,
  preservation: "", preparation: "",
  shelf_life_days: "", storage_temperature: "",
  legal_notes: "", image_url: "",
  status: "pendente",
  ingredient_ids: [], allergen_ids: [],
});

function ProductsPage() {
  const qc = useQueryClient();
  const { companyId, canWrite, canCreateProduct } = useActiveCompany();
  const [search, setSearch] = useState("");
  const [status, setStatus] = useState("all");
  const [page, setPage] = useState(1);
  const [open, setOpen] = useState(false);
  const [editing, setEditing] = useState<any | null>(null);
  const [form, setForm] = useState<FormState>(emptyForm());
  const [view, setView] = useState<any | null>(null);

  const { data: cats = [] } = useQuery({
    queryKey: ["all-categories", companyId], enabled: !!companyId,
    queryFn: async () => (await supabase.from("categories").select("*").eq("company_id", companyId!).eq("status", "ativo")).data ?? [],
  });
  const { data: brands = [] } = useQuery({
    queryKey: ["all-brands", companyId], enabled: !!companyId,
    queryFn: async () => (await supabase.from("brands").select("*").eq("company_id", companyId!).eq("status", "ativo")).data ?? [],
  });
  const { data: ingredients = [] } = useQuery({
    queryKey: ["all-ingredients", companyId], enabled: !!companyId,
    queryFn: async () => (await supabase.from("ingredients").select("*").eq("company_id", companyId!).eq("status", "ativo").order("name")).data ?? [],
  });
  const { data: allergens = [] } = useQuery({
    queryKey: ["all-allergens", companyId], enabled: !!companyId,
    queryFn: async () => (await supabase.from("allergens").select("*").eq("company_id", companyId!).eq("status", "ativo").order("name")).data ?? [],
  });
  const { data: nutritionList = [] } = useQuery({
    queryKey: ["all-nutrition", companyId], enabled: !!companyId,
    queryFn: async () => (await supabase.from("nutrition_facts").select("id,name,status,version").eq("company_id", companyId!).order("name")).data ?? [],
  });

  const rootCats = useMemo(() => cats.filter((c: any) => !c.parent_id), [cats]);
  const subCats = useMemo(
    () => cats.filter((c: any) => c.parent_id === form.category_id),
    [cats, form.category_id],
  );

  const { data, isLoading } = useQuery({
    queryKey: ["products", companyId, search, status, page],
    enabled: !!companyId,
    queryFn: async () => {
      let q = supabase.from("products")
        .select("*, categories!products_category_id_fkey(name), brands(name), nutrition_facts(name,status)", { count: "exact" })
        .eq("company_id", companyId!)
        .order("created_at", { ascending: false })
        .range((page - 1) * PAGE_SIZE, page * PAGE_SIZE - 1);
      if (search.trim()) q = q.or(`name.ilike.%${search.trim()}%,internal_code.ilike.%${search.trim()}%,ean.ilike.%${search.trim()}%`);
      if (status !== "all") q = q.eq("status", status as any);
      const { data, error, count } = await q;
      if (error) throw error;
      return { rows: data, count: count ?? 0 };
    },
  });

  function openCreate() { setEditing(null); setForm(emptyForm()); setOpen(true); }
  async function openEdit(row: any) {
    setEditing(row);
    const [pi, pa] = await Promise.all([
      supabase.from("product_ingredients").select("ingredient_id").eq("product_id", row.id),
      supabase.from("product_allergens").select("allergen_id").eq("product_id", row.id),
    ]);
    setForm({
      internal_code: row.internal_code ?? "", ean: row.ean ?? "", sku: row.sku ?? "", name: row.name ?? "",
      category_id: row.category_id ?? "", subcategory_id: row.subcategory_id ?? "", brand_id: row.brand_id ?? "",
      unit_of_measure: row.unit_of_measure ?? "", standard_weight: row.standard_weight?.toString() ?? "",
      variable_weight: !!row.variable_weight,
      commercial_description: row.commercial_description ?? "",
      nutrition_fact_id: row.nutrition_fact_id ?? "",
      contains_gluten: !!row.contains_gluten, contains_lactose: !!row.contains_lactose,
      preservation: row.preservation ?? "", preparation: row.preparation ?? "",
      shelf_life_days: row.shelf_life_days?.toString() ?? "",
      storage_temperature: row.storage_temperature ?? "",
      legal_notes: row.legal_notes ?? "", image_url: row.image_url ?? "",
      status: row.status,
      ingredient_ids: (pi.data ?? []).map((r: any) => r.ingredient_id),
      allergen_ids: (pa.data ?? []).map((r: any) => r.allergen_id),
    });
    setOpen(true);
  }

  const save = useMutation({
    mutationFn: async () => {
      const payload: any = {
        company_id: companyId,
        internal_code: form.internal_code || null,
        ean: form.ean || null, sku: form.sku || null, name: form.name,
        category_id: form.category_id || null,
        subcategory_id: form.subcategory_id || null,
        brand_id: form.brand_id || null,
        unit_of_measure: form.unit_of_measure || null,
        standard_weight: form.standard_weight ? Number(form.standard_weight) : null,
        variable_weight: form.variable_weight,
        commercial_description: form.commercial_description || null,
        nutrition_fact_id: form.nutrition_fact_id || null,
        contains_gluten: form.contains_gluten,
        contains_lactose: form.contains_lactose,
        preservation: form.preservation || null,
        preparation: form.preparation || null,
        shelf_life_days: form.shelf_life_days ? Number(form.shelf_life_days) : null,
        storage_temperature: form.storage_temperature || null,
        legal_notes: form.legal_notes || null,
        image_url: form.image_url || null,
        status: form.status as any,
      };
      let productId = editing?.id as string | undefined;
      if (editing) {
        const { error } = await supabase.from("products").update(payload).eq("id", editing.id);
        if (error) throw error;
      } else {
        const { data: u } = await supabase.auth.getUser();
        payload.created_by = u.user?.id;
        const { data: created, error } = await supabase.from("products").insert(payload).select().single();
        if (error) throw error;
        productId = created.id;
      }
      // Reset vínculos
      await supabase.from("product_ingredients").delete().eq("product_id", productId!);
      await supabase.from("product_allergens").delete().eq("product_id", productId!);
      if (form.ingredient_ids.length) {
        await supabase.from("product_ingredients").insert(
          form.ingredient_ids.map((id, i) => ({ company_id: companyId, product_id: productId!, ingredient_id: id, position: i + 1 })),
        );
      }
      if (form.allergen_ids.length) {
        await supabase.from("product_allergens").insert(
          form.allergen_ids.map((id) => ({ company_id: companyId, product_id: productId!, allergen_id: id })),
        );
      }
    },
    onSuccess: () => { toast.success("Produto salvo"); setOpen(false); qc.invalidateQueries({ queryKey: ["products"] }); qc.invalidateQueries({ queryKey: ["pending"] }); },
    onError: (e: any) => toast.error("Erro", { description: e.message }),
  });

  const toggleStatus = useMutation({
    mutationFn: async (row: any) => {
      const next = row.status === "ativo" ? "inativo" : "ativo";
      const { error } = await supabase.from("products").update({ status: next }).eq("id", row.id);
      if (error) throw error;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ["products"] }),
  });

  const totalPages = Math.max(1, Math.ceil((data?.count ?? 0) / PAGE_SIZE));

  return (
    <>
      <PageHeader title="Produtos" description="Cadastro completo dos produtos para emissão de etiquetas." />
      <Card className="p-4">
        <div className="flex flex-wrap items-center justify-between gap-3 mb-4">
          <div className="flex items-center gap-2">
            <div className="relative max-w-xs">
              <Search className="absolute left-2 top-1/2 -translate-y-1/2 size-4 text-muted-foreground" />
              <Input placeholder="Nome, código ou EAN…" value={search} onChange={(e) => { setSearch(e.target.value); setPage(1); }} className="pl-8" />
            </div>
            <Select value={status} onValueChange={(v) => { setStatus(v); setPage(1); }}>
              <SelectTrigger className="w-[200px]"><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Todos status</SelectItem>
                {STATUSES.map((s) => <SelectItem key={s} value={s}>{s}</SelectItem>)}
              </SelectContent>
            </Select>
          </div>
          {canCreateProduct && <Button onClick={openCreate}><Plus className="size-4 mr-1" /> Novo produto</Button>}
        </div>

        <div className="rounded-md border overflow-x-auto">
          <Table>
            <TableHeader><TableRow>
              <TableHead>Produto</TableHead><TableHead>Código</TableHead><TableHead>Categoria</TableHead>
              <TableHead>Marca</TableHead><TableHead>Nutrição</TableHead><TableHead>Status</TableHead>
              <TableHead className="text-right">Ações</TableHead>
            </TableRow></TableHeader>
            <TableBody>
              {isLoading && <TableRow><TableCell colSpan={7} className="text-center py-8 text-muted-foreground">Carregando…</TableCell></TableRow>}
              {!isLoading && (data?.rows.length ?? 0) === 0 && (
                <TableRow><TableCell colSpan={7} className="text-center py-8 text-muted-foreground">Nenhum produto cadastrado.</TableCell></TableRow>
              )}
              {data?.rows.map((row: any) => (
                <TableRow key={row.id}>
                  <TableCell className="font-medium">{row.name}</TableCell>
                  <TableCell className="text-muted-foreground">{row.internal_code ?? "—"}</TableCell>
                  <TableCell className="text-muted-foreground">{row.categories?.name ?? "—"}</TableCell>
                  <TableCell className="text-muted-foreground">{row.brands?.name ?? "—"}</TableCell>
                  <TableCell>{row.nutrition_facts ? <Badge variant="outline">{row.nutrition_facts.name}</Badge> : <span className="text-rose-600 text-xs">Faltando</span>}</TableCell>
                  <TableCell><StatusBadge status={row.status} /></TableCell>
                  <TableCell className="text-right space-x-1">
                    <Button size="sm" variant="ghost" onClick={() => setView(row)}><Eye className="size-4" /></Button>
                    {canWrite && (<>
                      <Button size="sm" variant="ghost" onClick={() => openEdit(row)}><Pencil className="size-4" /></Button>
                      <Button size="sm" variant="outline" onClick={() => toggleStatus.mutate(row)}>
                        {row.status === "ativo" ? "Inativar" : "Ativar"}
                      </Button>
                    </>)}
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </div>

        <div className="flex items-center justify-between mt-3 text-sm text-muted-foreground">
          <div>{data?.count ?? 0} produto(s)</div>
          <div className="flex items-center gap-2">
            <Button size="sm" variant="outline" disabled={page <= 1} onClick={() => setPage(page - 1)}>Anterior</Button>
            <span>Página {page} de {totalPages}</span>
            <Button size="sm" variant="outline" disabled={page >= totalPages} onClick={() => setPage(page + 1)}>Próxima</Button>
          </div>
        </div>
      </Card>

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="max-w-3xl max-h-[92vh] overflow-y-auto">
          <DialogHeader><DialogTitle>{editing ? "Editar produto" : "Novo produto"}</DialogTitle></DialogHeader>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
            <div className="md:col-span-2 space-y-1.5"><Label>Nome do produto *</Label>
              <Input value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} /></div>
            <div className="space-y-1.5"><Label>Status</Label>
              <Select value={form.status} onValueChange={(v) => setForm({ ...form, status: v })}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>{STATUSES.map((s) => <SelectItem key={s} value={s}>{s}</SelectItem>)}</SelectContent>
              </Select>
            </div>

            <div className="space-y-1.5"><Label>Código interno</Label>
              <Input value={form.internal_code} onChange={(e) => setForm({ ...form, internal_code: e.target.value })} /></div>
            <div className="space-y-1.5"><Label>EAN</Label>
              <Input value={form.ean} onChange={(e) => setForm({ ...form, ean: e.target.value })} /></div>
            <div className="space-y-1.5"><Label>SKU</Label>
              <Input value={form.sku} onChange={(e) => setForm({ ...form, sku: e.target.value })} /></div>

            <div className="space-y-1.5"><Label>Categoria</Label>
              <Select value={form.category_id || "none"} onValueChange={(v) => setForm({ ...form, category_id: v === "none" ? "" : v, subcategory_id: "" })}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="none">—</SelectItem>
                  {rootCats.map((c: any) => <SelectItem key={c.id} value={c.id}>{c.name}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1.5"><Label>Subcategoria</Label>
              <Select value={form.subcategory_id || "none"} onValueChange={(v) => setForm({ ...form, subcategory_id: v === "none" ? "" : v })} disabled={!form.category_id || subCats.length === 0}>
                <SelectTrigger><SelectValue placeholder={subCats.length === 0 ? "Nenhuma" : "Selecione…"} /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="none">—</SelectItem>
                  {subCats.map((c: any) => <SelectItem key={c.id} value={c.id}>{c.name}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1.5"><Label>Marca</Label>
              <Select value={form.brand_id || "none"} onValueChange={(v) => setForm({ ...form, brand_id: v === "none" ? "" : v })}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="none">—</SelectItem>
                  {brands.map((b: any) => <SelectItem key={b.id} value={b.id}>{b.name}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-1.5"><Label>Unidade de medida</Label>
              <Input value={form.unit_of_measure} onChange={(e) => setForm({ ...form, unit_of_measure: e.target.value })} placeholder="un, kg, g, ml, L…" /></div>
            <div className="space-y-1.5"><Label>Peso padrão</Label>
              <Input type="number" step="0.001" value={form.standard_weight} onChange={(e) => setForm({ ...form, standard_weight: e.target.value })} /></div>
            <div className="space-y-1.5 flex flex-col"><Label>Peso variável?</Label>
              <div className="flex items-center gap-2 h-9">
                <Checkbox checked={form.variable_weight} onCheckedChange={(v) => setForm({ ...form, variable_weight: !!v })} />
                <span className="text-sm">Sim</span>
              </div>
            </div>

            <div className="md:col-span-3 space-y-1.5"><Label>Descrição comercial</Label>
              <Textarea value={form.commercial_description} onChange={(e) => setForm({ ...form, commercial_description: e.target.value })} /></div>

            <div className="md:col-span-3 space-y-1.5"><Label>Informação nutricional vinculada</Label>
              <Select value={form.nutrition_fact_id || "none"} onValueChange={(v) => setForm({ ...form, nutrition_fact_id: v === "none" ? "" : v })}>
                <SelectTrigger><SelectValue placeholder="Vincular…" /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="none">— Sem tabela nutricional —</SelectItem>
                  {nutritionList.map((n: any) => <SelectItem key={n.id} value={n.id}>{n.name} (v{n.version}, {n.status})</SelectItem>)}
                </SelectContent>
              </Select>
            </div>

            <div className="md:col-span-3 space-y-1.5">
              <Label>Ingredientes</Label>
              <div className="grid grid-cols-2 md:grid-cols-3 gap-2 border rounded-md p-3 max-h-40 overflow-y-auto">
                {ingredients.length === 0 && <div className="text-sm text-muted-foreground">Cadastre ingredientes primeiro.</div>}
                {ingredients.map((i: any) => {
                  const checked = form.ingredient_ids.includes(i.id);
                  return (
                    <label key={i.id} className="flex items-center gap-2 text-sm">
                      <Checkbox checked={checked} onCheckedChange={(v) => setForm({
                        ...form,
                        ingredient_ids: v ? [...form.ingredient_ids, i.id] : form.ingredient_ids.filter((x) => x !== i.id),
                      })} />
                      {i.name}
                    </label>
                  );
                })}
              </div>
            </div>

            <div className="md:col-span-3 space-y-1.5">
              <Label>Alergênicos</Label>
              <div className="grid grid-cols-2 md:grid-cols-3 gap-2 border rounded-md p-3 max-h-40 overflow-y-auto">
                {allergens.length === 0 && <div className="text-sm text-muted-foreground">Cadastre alergênicos primeiro.</div>}
                {allergens.map((a: any) => {
                  const checked = form.allergen_ids.includes(a.id);
                  return (
                    <label key={a.id} className="flex items-center gap-2 text-sm">
                      <Checkbox checked={checked} onCheckedChange={(v) => setForm({
                        ...form,
                        allergen_ids: v ? [...form.allergen_ids, a.id] : form.allergen_ids.filter((x) => x !== a.id),
                      })} />
                      {a.name}{a.code && <span className="text-xs text-muted-foreground">({a.code})</span>}
                    </label>
                  );
                })}
              </div>
            </div>

            <div className="flex items-center gap-2"><Checkbox checked={form.contains_gluten} onCheckedChange={(v) => setForm({ ...form, contains_gluten: !!v })} /><Label>Contém glúten</Label></div>
            <div className="flex items-center gap-2"><Checkbox checked={form.contains_lactose} onCheckedChange={(v) => setForm({ ...form, contains_lactose: !!v })} /><Label>Contém lactose</Label></div>
            <div />

            <div className="md:col-span-3 space-y-1.5"><Label>Conservação</Label>
              <Textarea value={form.preservation} onChange={(e) => setForm({ ...form, preservation: e.target.value })} /></div>
            <div className="md:col-span-3 space-y-1.5"><Label>Modo de preparo</Label>
              <Textarea value={form.preparation} onChange={(e) => setForm({ ...form, preparation: e.target.value })} /></div>
            <div className="space-y-1.5"><Label>Prazo de validade (dias)</Label>
              <Input type="number" value={form.shelf_life_days} onChange={(e) => setForm({ ...form, shelf_life_days: e.target.value })} /></div>
            <div className="space-y-1.5"><Label>Temperatura de armazenamento</Label>
              <Input value={form.storage_temperature} onChange={(e) => setForm({ ...form, storage_temperature: e.target.value })} /></div>
            <div className="space-y-1.5"><Label>URL da imagem</Label>
              <Input value={form.image_url} onChange={(e) => setForm({ ...form, image_url: e.target.value })} /></div>
            <div className="md:col-span-3 space-y-1.5"><Label>Observações legais</Label>
              <Textarea value={form.legal_notes} onChange={(e) => setForm({ ...form, legal_notes: e.target.value })} /></div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setOpen(false)}>Cancelar</Button>
            <Button onClick={() => save.mutate()} disabled={save.isPending || !form.name.trim()}>Salvar</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={!!view} onOpenChange={(o) => !o && setView(null)}>
        <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
          <DialogHeader><DialogTitle>{view?.name} <StatusBadge status={view?.status ?? ""} /></DialogTitle></DialogHeader>
          {view && <ProductDetail product={view} />}
        </DialogContent>
      </Dialog>
    </>
  );
}

function ProductDetail({ product }: { product: any }) {
  const { data: nut } = useQuery({
    queryKey: ["nut-detail", product.nutrition_fact_id],
    enabled: !!product.nutrition_fact_id,
    queryFn: async () => (await supabase.from("nutrition_facts").select("*").eq("id", product.nutrition_fact_id).single()).data,
  });
  const { data: ings = [] } = useQuery({
    queryKey: ["pi-detail", product.id],
    queryFn: async () => (await supabase.from("product_ingredients").select("position, ingredients(name)").eq("product_id", product.id).order("position")).data ?? [],
  });
  const { data: algs = [] } = useQuery({
    queryKey: ["pa-detail", product.id],
    queryFn: async () => (await supabase.from("product_allergens").select("allergens(name, code)").eq("product_id", product.id)).data ?? [],
  });

  return (
    <div className="space-y-4 text-sm">
      <div className="grid grid-cols-2 gap-2">
        <div><span className="text-muted-foreground">Código:</span> {product.internal_code ?? "—"}</div>
        <div><span className="text-muted-foreground">EAN:</span> {product.ean ?? "—"}</div>
        <div><span className="text-muted-foreground">Unidade:</span> {product.unit_of_measure ?? "—"}</div>
        <div><span className="text-muted-foreground">Peso:</span> {product.standard_weight ?? "—"} {product.variable_weight && "(variável)"}</div>
        <div><span className="text-muted-foreground">Conservação:</span> {product.preservation ?? "—"}</div>
        <div><span className="text-muted-foreground">Validade:</span> {product.shelf_life_days ? `${product.shelf_life_days} dias` : "—"}</div>
        <div><span className="text-muted-foreground">Temperatura:</span> {product.storage_temperature ?? "—"}</div>
        <div><span className="text-muted-foreground">Glúten/Lactose:</span> {product.contains_gluten ? "Contém glúten" : "Sem glúten"} · {product.contains_lactose ? "Contém lactose" : "Sem lactose"}</div>
      </div>
      <div>
        <div className="font-medium mb-1">Ingredientes</div>
        <div>{ings.length === 0 ? <span className="text-muted-foreground">— Nenhum vinculado —</span> : (ings as any[]).map((i) => i.ingredients?.name).join(", ")}</div>
      </div>
      <div>
        <div className="font-medium mb-1">Alergênicos</div>
        <div className="flex gap-2 flex-wrap">{algs.length === 0 ? <span className="text-muted-foreground">— Nenhum —</span> :
          (algs as any[]).map((a, i) => <Badge key={i} variant="outline">{a.allergens?.name}</Badge>)}</div>
      </div>
      {nut && (
        <div>
          <div className="font-medium mb-1">Informação nutricional <StatusBadge status={nut.status} /></div>
          <NutritionTable data={nut} />
        </div>
      )}
    </div>
  );
}
