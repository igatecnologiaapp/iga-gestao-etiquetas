import { createFileRoute } from "@tanstack/react-router";
import { useMemo, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useActiveCompany } from "@/hooks/use-active-company";
import { PageHeader } from "@/components/page-header";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { toast } from "sonner";
import { formatBRL } from "@/lib/label-pdf";
import { History, Pencil, Plus, Search } from "lucide-react";

export const Route = createFileRoute("/app/prices")({ component: PricesPage });

const PAGE_SIZE = 20;

function PricesPage() {
  const qc = useQueryClient();
  const { companyId, canWrite, isReadOnly } = useActiveCompany();
  const [search, setSearch] = useState("");
  const [page, setPage] = useState(1);
  const [open, setOpen] = useState(false);
  const [historyFor, setHistoryFor] = useState<{ productId: string; productName: string } | null>(null);
  const [editing, setEditing] = useState<any | null>(null);

  const products = useQuery({
    queryKey: ["prices-products", companyId, search, page],
    enabled: !!companyId,
    queryFn: async () => {
      let q = supabase.from("products").select("id,name,internal_code,unit_of_measure,status,brand_id,category_id", { count: "exact" })
        .eq("company_id", companyId!).order("name")
        .range((page - 1) * PAGE_SIZE, page * PAGE_SIZE - 1);
      if (search.trim()) q = q.ilike("name", `%${search.trim()}%`);
      const { data, error, count } = await q;
      if (error) throw error;
      return { rows: data as any[], count: count ?? 0 };
    },
  });

  const productIds = useMemo(() => products.data?.rows.map((p) => p.id) ?? [], [products.data]);
  const prices = useQuery({
    queryKey: ["prices-data", companyId, productIds],
    enabled: !!companyId && productIds.length > 0,
    queryFn: async () => {
      const { data, error } = await (supabase.from("product_prices" as any) as any)
        .select("*").eq("company_id", companyId!).in("product_id", productIds);
      if (error) throw error;
      const map: Record<string, any> = {};
      for (const row of data as any[]) {
        if (!map[row.product_id] || row.branch_id == null) map[row.product_id] = row;
      }
      return map;
    },
  });

  const save = useMutation({
    mutationFn: async (payload: any) => {
      const { data: u } = await supabase.auth.getUser();
      const existing = prices.data?.[payload.product_id] ?? null;
      const baseRow = {
        company_id: companyId,
        branch_id: null,
        product_id: payload.product_id,
        sale_unit: payload.sale_unit || null,
        regular_price: Number(payload.regular_price) || 0,
        wholesale_price: payload.wholesale_price !== "" ? Number(payload.wholesale_price) : null,
        wholesale_min_quantity: payload.wholesale_min_quantity !== "" ? Number(payload.wholesale_min_quantity) : null,
        current_promotional_price: payload.current_promotional_price !== "" ? Number(payload.current_promotional_price) : null,
        currency: "BRL",
        status: "ativo",
        updated_by: u.user?.id ?? null,
      };
      let saved: any;
      if (existing) {
        const { data, error } = await (supabase.from("product_prices" as any) as any)
          .update(baseRow).eq("id", existing.id).select("*").single();
        if (error) throw error;
        saved = data;
      } else {
        const { data, error } = await (supabase.from("product_prices" as any) as any)
          .insert({ ...baseRow, created_by: u.user?.id ?? null }).select("*").single();
        if (error) throw error;
        saved = data;
      }
      // History row
      const histChanged = !existing
        || Number(existing.regular_price ?? 0) !== Number(saved.regular_price ?? 0)
        || Number(existing.wholesale_price ?? 0) !== Number(saved.wholesale_price ?? 0)
        || Number(existing.current_promotional_price ?? 0) !== Number(saved.current_promotional_price ?? 0);
      if (histChanged) {
        await (supabase.from("product_price_history" as any) as any).insert({
          company_id: companyId,
          branch_id: null,
          product_id: payload.product_id,
          previous_regular_price: existing?.regular_price ?? null,
          new_regular_price: saved.regular_price,
          previous_promotional_price: existing?.current_promotional_price ?? null,
          new_promotional_price: saved.current_promotional_price,
          previous_wholesale_price: existing?.wholesale_price ?? null,
          new_wholesale_price: saved.wholesale_price,
          reason: payload.reason || null,
          changed_by: u.user?.id ?? null,
        });
      }
    },
    onSuccess: () => { toast.success("Preço salvo"); qc.invalidateQueries({ queryKey: ["prices-data"] }); setOpen(false); setEditing(null); },
    onError: (e: any) => toast.error(e.message),
  });

  const history = useQuery({
    queryKey: ["price-history", companyId, historyFor?.productId],
    enabled: !!companyId && !!historyFor,
    queryFn: async () => {
      const { data, error } = await (supabase.from("product_price_history" as any) as any)
        .select("*").eq("company_id", companyId!).eq("product_id", historyFor!.productId)
        .order("changed_at", { ascending: false }).limit(50);
      if (error) throw error;
      return data as any[];
    },
  });

  const totalPages = Math.max(1, Math.ceil((products.data?.count ?? 0) / PAGE_SIZE));

  return (
    <div className="space-y-6">
      <PageHeader title="Preços" description="Cadastro de preços por produto, preço de atacado e promocional vigente." />

      <Card className="p-4 space-y-4">
        <div className="flex gap-2 items-end">
          <div className="flex-1">
            <Label>Buscar produto</Label>
            <div className="relative">
              <Search className="size-4 absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" />
              <Input className="pl-9" value={search} onChange={(e) => { setSearch(e.target.value); setPage(1); }} placeholder="Nome do produto" />
            </div>
          </div>
        </div>

        <div className="overflow-x-auto">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Produto</TableHead>
                <TableHead>Código</TableHead>
                <TableHead>Unidade</TableHead>
                <TableHead className="text-right">Preço normal</TableHead>
                <TableHead className="text-right">Atacado</TableHead>
                <TableHead className="text-right">Qtd. mín.</TableHead>
                <TableHead className="text-right">Promocional</TableHead>
                <TableHead className="w-44 text-right">Ações</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {products.isLoading && <TableRow><TableCell colSpan={8}>Carregando...</TableCell></TableRow>}
              {products.data?.rows.map((p) => {
                const pr = prices.data?.[p.id];
                return (
                  <TableRow key={p.id}>
                    <TableCell className="font-medium">{p.name}</TableCell>
                    <TableCell className="text-muted-foreground">{p.internal_code ?? "—"}</TableCell>
                    <TableCell>{p.unit_of_measure ?? "—"}</TableCell>
                    <TableCell className="text-right">{pr?.regular_price != null ? formatBRL(Number(pr.regular_price)) : "—"}</TableCell>
                    <TableCell className="text-right">{pr?.wholesale_price != null ? formatBRL(Number(pr.wholesale_price)) : "—"}</TableCell>
                    <TableCell className="text-right">{pr?.wholesale_min_quantity ?? "—"}</TableCell>
                    <TableCell className="text-right">{pr?.current_promotional_price != null ? formatBRL(Number(pr.current_promotional_price)) : "—"}</TableCell>
                    <TableCell className="text-right space-x-1">
                      <Button size="sm" variant="ghost" onClick={() => setHistoryFor({ productId: p.id, productName: p.name })}>
                        <History className="size-4" />
                      </Button>
                      {!isReadOnly && canWrite && (
                        <Button size="sm" variant="outline" onClick={() => { setEditing({ ...pr, product_id: p.id, product_name: p.name }); setOpen(true); }}>
                          {pr ? <Pencil className="size-4" /> : <Plus className="size-4" />}
                        </Button>
                      )}
                    </TableCell>
                  </TableRow>
                );
              })}
            </TableBody>
          </Table>
        </div>

        <div className="flex justify-between items-center text-sm">
          <div className="text-muted-foreground">{products.data?.count ?? 0} produto(s)</div>
          <div className="flex gap-2">
            <Button variant="outline" size="sm" disabled={page <= 1} onClick={() => setPage(page - 1)}>Anterior</Button>
            <div className="px-2 py-1 text-muted-foreground">{page} / {totalPages}</div>
            <Button variant="outline" size="sm" disabled={page >= totalPages} onClick={() => setPage(page + 1)}>Próxima</Button>
          </div>
        </div>
      </Card>

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent>
          <DialogHeader><DialogTitle>Editar preço — {editing?.product_name}</DialogTitle></DialogHeader>
          <PriceForm value={editing ?? {}} onChange={setEditing} />
          <DialogFooter>
            <Button variant="outline" onClick={() => setOpen(false)}>Cancelar</Button>
            <Button onClick={() => save.mutate(editing)} disabled={save.isPending}>Salvar</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={!!historyFor} onOpenChange={(o) => !o && setHistoryFor(null)}>
        <DialogContent className="max-w-3xl">
          <DialogHeader><DialogTitle>Histórico de preços — {historyFor?.productName}</DialogTitle></DialogHeader>
          <div className="max-h-[60vh] overflow-auto">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Quando</TableHead>
                  <TableHead>Normal</TableHead>
                  <TableHead>Promocional</TableHead>
                  <TableHead>Atacado</TableHead>
                  <TableHead>Motivo</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {history.data?.map((h: any) => (
                  <TableRow key={h.id}>
                    <TableCell>{new Date(h.changed_at).toLocaleString("pt-BR")}</TableCell>
                    <TableCell>{h.previous_regular_price != null ? formatBRL(Number(h.previous_regular_price)) : "—"} → {h.new_regular_price != null ? formatBRL(Number(h.new_regular_price)) : "—"}</TableCell>
                    <TableCell>{h.previous_promotional_price != null ? formatBRL(Number(h.previous_promotional_price)) : "—"} → {h.new_promotional_price != null ? formatBRL(Number(h.new_promotional_price)) : "—"}</TableCell>
                    <TableCell>{h.previous_wholesale_price != null ? formatBRL(Number(h.previous_wholesale_price)) : "—"} → {h.new_wholesale_price != null ? formatBRL(Number(h.new_wholesale_price)) : "—"}</TableCell>
                    <TableCell className="text-muted-foreground">{h.reason ?? "—"}</TableCell>
                  </TableRow>
                ))}
                {history.data?.length === 0 && <TableRow><TableCell colSpan={5} className="text-center text-muted-foreground">Sem histórico</TableCell></TableRow>}
              </TableBody>
            </Table>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}

function PriceForm({ value, onChange }: { value: any; onChange: (v: any) => void }) {
  const set = (k: string, v: any) => onChange({ ...value, [k]: v });
  return (
    <div className="grid grid-cols-2 gap-3">
      <div className="col-span-2">
        <Label>Unidade de venda</Label>
        <Input value={value.sale_unit ?? ""} onChange={(e) => set("sale_unit", e.target.value)} placeholder="un, kg, cx..." />
      </div>
      <div>
        <Label>Preço normal (R$) *</Label>
        <Input type="number" step="0.01" value={value.regular_price ?? ""} onChange={(e) => set("regular_price", e.target.value)} />
      </div>
      <div>
        <Label>Preço promocional vigente (R$)</Label>
        <Input type="number" step="0.01" value={value.current_promotional_price ?? ""} onChange={(e) => set("current_promotional_price", e.target.value)} />
      </div>
      <div>
        <Label>Preço atacado (R$)</Label>
        <Input type="number" step="0.01" value={value.wholesale_price ?? ""} onChange={(e) => set("wholesale_price", e.target.value)} />
      </div>
      <div>
        <Label>Quantidade mínima (atacado)</Label>
        <Input type="number" step="1" value={value.wholesale_min_quantity ?? ""} onChange={(e) => set("wholesale_min_quantity", e.target.value)} />
      </div>
      <div className="col-span-2">
        <Label>Motivo da alteração</Label>
        <Input value={value.reason ?? ""} onChange={(e) => set("reason", e.target.value)} placeholder="Reajuste, promoção etc." />
      </div>
    </div>
  );
}
