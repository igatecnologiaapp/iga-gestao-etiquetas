import { createFileRoute } from "@tanstack/react-router";
import { useMemo, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useActiveCompany } from "@/hooks/use-active-company";
import { PageHeader } from "@/components/page-header";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Button } from "@/components/ui/button";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { Plus, Pencil, Trash2, Play, Square, Ban, CalendarClock } from "lucide-react";
import { toast } from "sonner";
import { formatBRL } from "@/lib/label-pdf";

export const Route = createFileRoute("/app/promotions")({ component: PromotionsPage });

const STATUS_LABEL: Record<string, string> = {
  draft: "Rascunho", scheduled: "Agendada", active: "Ativa", ended: "Encerrada", cancelled: "Cancelada",
};
const STATUS_VARIANT: Record<string, any> = { active: "default", scheduled: "secondary", draft: "outline", ended: "secondary", cancelled: "destructive" };

function PromotionsPage() {
  const qc = useQueryClient();
  const { companyId, canWrite, canDelete, isReadOnly } = useActiveCompany();
  const [open, setOpen] = useState(false);
  const [editing, setEditing] = useState<any | null>(null);
  const [productsOpenFor, setProductsOpenFor] = useState<any | null>(null);

  const promotions = useQuery({
    queryKey: ["promotions", companyId],
    enabled: !!companyId,
    queryFn: async () => {
      const { data, error } = await (supabase.from("promotions" as any) as any)
        .select("*").eq("company_id", companyId!).order("start_date", { ascending: false });
      if (error) throw error;
      return data as any[];
    },
  });

  const save = useMutation({
    mutationFn: async (p: any) => {
      const { data: u } = await supabase.auth.getUser();
      const payload = {
        company_id: companyId,
        branch_id: p.branch_id || null,
        name: p.name,
        description: p.description ?? null,
        start_date: p.start_date,
        end_date: p.end_date,
        status: p.status ?? "draft",
        updated_by: u.user?.id ?? null,
      };
      if (p.id) {
        const { error } = await (supabase.from("promotions" as any) as any).update(payload).eq("id", p.id);
        if (error) throw error;
      } else {
        const { error } = await (supabase.from("promotions" as any) as any).insert({ ...payload, created_by: u.user?.id ?? null });
        if (error) throw error;
      }
    },
    onSuccess: () => { toast.success("Promoção salva"); qc.invalidateQueries({ queryKey: ["promotions"] }); setOpen(false); setEditing(null); },
    onError: (e: any) => toast.error(e.message),
  });

  const setStatus = useMutation({
    mutationFn: async ({ id, status }: { id: string; status: string }) => {
      const { error } = await (supabase.from("promotions" as any) as any).update({ status }).eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => { toast.success("Status atualizado"); qc.invalidateQueries({ queryKey: ["promotions"] }); },
    onError: (e: any) => toast.error(e.message),
  });

  const remove = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await (supabase.from("promotions" as any) as any).delete().eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => { toast.success("Promoção removida"); qc.invalidateQueries({ queryKey: ["promotions"] }); },
    onError: (e: any) => toast.error(e.message),
  });

  return (
    <div className="space-y-6">
      <PageHeader
        title="Promoções"
        description="Cadastre promoções, vincule produtos e gerencie preços promocionais e de atacado."
        actions={!isReadOnly && canWrite ? (
          <Button onClick={() => { setEditing({ status: "draft", start_date: new Date().toISOString().slice(0, 16), end_date: new Date(Date.now() + 7 * 86400000).toISOString().slice(0, 16) }); setOpen(true); }}>
            <Plus className="size-4 mr-1" /> Nova promoção
          </Button>
        ) : null}
      />

      <Card className="p-4">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Nome</TableHead>
              <TableHead>Período</TableHead>
              <TableHead>Status</TableHead>
              <TableHead className="text-right">Ações</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {promotions.isLoading && <TableRow><TableCell colSpan={4}>Carregando...</TableCell></TableRow>}
            {promotions.data?.map((p) => (
              <TableRow key={p.id}>
                <TableCell className="font-medium">{p.name}<div className="text-xs text-muted-foreground">{p.description}</div></TableCell>
                <TableCell className="text-sm">
                  {new Date(p.start_date).toLocaleString("pt-BR")}<br />
                  até {new Date(p.end_date).toLocaleString("pt-BR")}
                </TableCell>
                <TableCell><Badge variant={STATUS_VARIANT[p.status] ?? "outline"}>{STATUS_LABEL[p.status]}</Badge></TableCell>
                <TableCell className="text-right space-x-1">
                  <Button size="sm" variant="ghost" onClick={() => setProductsOpenFor(p)}>Produtos</Button>
                  {!isReadOnly && canWrite && (
                    <>
                      {p.status !== "active" && <Button size="sm" variant="ghost" title="Ativar" onClick={() => setStatus.mutate({ id: p.id, status: "active" })}><Play className="size-4" /></Button>}
                      {p.status === "draft" && <Button size="sm" variant="ghost" title="Agendar" onClick={() => setStatus.mutate({ id: p.id, status: "scheduled" })}><CalendarClock className="size-4" /></Button>}
                      {p.status === "active" && <Button size="sm" variant="ghost" title="Encerrar" onClick={() => setStatus.mutate({ id: p.id, status: "ended" })}><Square className="size-4" /></Button>}
                      {p.status !== "cancelled" && p.status !== "ended" && <Button size="sm" variant="ghost" title="Cancelar" onClick={() => setStatus.mutate({ id: p.id, status: "cancelled" })}><Ban className="size-4" /></Button>}
                      <Button size="sm" variant="outline" onClick={() => { setEditing({ ...p, start_date: p.start_date?.slice(0, 16), end_date: p.end_date?.slice(0, 16) }); setOpen(true); }}><Pencil className="size-4" /></Button>
                    </>
                  )}
                  {canDelete && <Button size="sm" variant="ghost" onClick={() => confirm("Excluir promoção?") && remove.mutate(p.id)}><Trash2 className="size-4" /></Button>}
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </Card>

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent>
          <DialogHeader><DialogTitle>{editing?.id ? "Editar" : "Nova"} promoção</DialogTitle></DialogHeader>
          <div className="grid gap-3">
            <div><Label>Nome *</Label><Input value={editing?.name ?? ""} onChange={(e) => setEditing({ ...editing, name: e.target.value })} /></div>
            <div><Label>Descrição</Label><Textarea rows={2} value={editing?.description ?? ""} onChange={(e) => setEditing({ ...editing, description: e.target.value })} /></div>
            <div className="grid grid-cols-2 gap-3">
              <div><Label>Início *</Label><Input type="datetime-local" value={editing?.start_date ?? ""} onChange={(e) => setEditing({ ...editing, start_date: e.target.value })} /></div>
              <div><Label>Fim *</Label><Input type="datetime-local" value={editing?.end_date ?? ""} onChange={(e) => setEditing({ ...editing, end_date: e.target.value })} /></div>
            </div>
            <div>
              <Label>Status</Label>
              <Select value={editing?.status ?? "draft"} onValueChange={(v) => setEditing({ ...editing, status: v })}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>{Object.entries(STATUS_LABEL).map(([v, l]) => <SelectItem key={v} value={v}>{l}</SelectItem>)}</SelectContent>
              </Select>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setOpen(false)}>Cancelar</Button>
            <Button disabled={!editing?.name || !editing?.start_date || !editing?.end_date} onClick={() => save.mutate(editing)}>Salvar</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <PromotionProductsDialog promotion={productsOpenFor} onClose={() => setProductsOpenFor(null)} />
    </div>
  );
}

function PromotionProductsDialog({ promotion, onClose }: { promotion: any | null; onClose: () => void }) {
  const qc = useQueryClient();
  const { companyId, canWrite } = useActiveCompany();
  const [productId, setProductId] = useState("");
  const [form, setForm] = useState<any>({});

  const products = useQuery({
    queryKey: ["pp-products", companyId],
    enabled: !!companyId && !!promotion,
    queryFn: async () => {
      const { data, error } = await supabase.from("products").select("id,name,internal_code").eq("company_id", companyId!).order("name");
      if (error) throw error;
      return data as any[];
    },
  });

  const items = useQuery({
    queryKey: ["promo-products", promotion?.id],
    enabled: !!promotion,
    queryFn: async () => {
      const { data, error } = await (supabase.from("promotion_products" as any) as any)
        .select("*, products:product_id(id,name,internal_code)").eq("promotion_id", promotion.id);
      if (error) throw error;
      return data as any[];
    },
  });

  const add = useMutation({
    mutationFn: async () => {
      if (!productId) throw new Error("Selecione um produto");
      const { error } = await (supabase.from("promotion_products" as any) as any).insert({
        company_id: companyId,
        branch_id: promotion.branch_id ?? null,
        promotion_id: promotion.id,
        product_id: productId,
        regular_price: form.regular_price !== "" && form.regular_price != null ? Number(form.regular_price) : null,
        promotional_price: form.promotional_price !== "" && form.promotional_price != null ? Number(form.promotional_price) : null,
        wholesale_price: form.wholesale_price !== "" && form.wholesale_price != null ? Number(form.wholesale_price) : null,
        wholesale_min_quantity: form.wholesale_min_quantity !== "" && form.wholesale_min_quantity != null ? Number(form.wholesale_min_quantity) : null,
        promotion_rules: form.promotion_rules || null,
        status: "ativo",
      });
      if (error) throw error;
    },
    onSuccess: () => { toast.success("Produto vinculado"); setProductId(""); setForm({}); qc.invalidateQueries({ queryKey: ["promo-products"] }); },
    onError: (e: any) => toast.error(e.message),
  });

  const removeItem = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await (supabase.from("promotion_products" as any) as any).delete().eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => { qc.invalidateQueries({ queryKey: ["promo-products"] }); },
    onError: (e: any) => toast.error(e.message),
  });

  const linkedIds = useMemo(() => new Set(items.data?.map((i) => i.product_id) ?? []), [items.data]);

  return (
    <Dialog open={!!promotion} onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="max-w-4xl">
        <DialogHeader><DialogTitle>Produtos da promoção — {promotion?.name}</DialogTitle></DialogHeader>

        {canWrite && (
          <div className="grid gap-2 border rounded-md p-3 bg-muted/30">
            <div className="grid sm:grid-cols-2 gap-2">
              <div>
                <Label>Produto</Label>
                <Select value={productId} onValueChange={setProductId}>
                  <SelectTrigger><SelectValue placeholder="Selecione" /></SelectTrigger>
                  <SelectContent>
                    {products.data?.filter((p) => !linkedIds.has(p.id)).map((p) => (
                      <SelectItem key={p.id} value={p.id}>{p.name}{p.internal_code ? ` · ${p.internal_code}` : ""}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div><Label>Preço normal (referência)</Label><Input type="number" step="0.01" value={form.regular_price ?? ""} onChange={(e) => setForm({ ...form, regular_price: e.target.value })} /></div>
              <div><Label>Preço promocional</Label><Input type="number" step="0.01" value={form.promotional_price ?? ""} onChange={(e) => setForm({ ...form, promotional_price: e.target.value })} /></div>
              <div><Label>Preço atacado</Label><Input type="number" step="0.01" value={form.wholesale_price ?? ""} onChange={(e) => setForm({ ...form, wholesale_price: e.target.value })} /></div>
              <div><Label>Qtd. mínima (atacado)</Label><Input type="number" step="1" value={form.wholesale_min_quantity ?? ""} onChange={(e) => setForm({ ...form, wholesale_min_quantity: e.target.value })} /></div>
              <div className="sm:col-span-2"><Label>Regras</Label><Textarea rows={2} value={form.promotion_rules ?? ""} onChange={(e) => setForm({ ...form, promotion_rules: e.target.value })} placeholder="Leve 3 pague 2 etc." /></div>
            </div>
            <div className="flex justify-end"><Button onClick={() => add.mutate()} disabled={!productId || add.isPending}><Plus className="size-4 mr-1" /> Vincular</Button></div>
          </div>
        )}

        <div className="max-h-[50vh] overflow-auto">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Produto</TableHead>
                <TableHead>Promocional</TableHead>
                <TableHead>Atacado</TableHead>
                <TableHead>Qtd. mín.</TableHead>
                <TableHead>Regras</TableHead>
                {canWrite && <TableHead></TableHead>}
              </TableRow>
            </TableHeader>
            <TableBody>
              {items.data?.map((it: any) => (
                <TableRow key={it.id}>
                  <TableCell>{it.products?.name}</TableCell>
                  <TableCell>{it.promotional_price != null ? formatBRL(Number(it.promotional_price)) : "—"}</TableCell>
                  <TableCell>{it.wholesale_price != null ? formatBRL(Number(it.wholesale_price)) : "—"}</TableCell>
                  <TableCell>{it.wholesale_min_quantity ?? "—"}</TableCell>
                  <TableCell className="text-sm text-muted-foreground">{it.promotion_rules ?? "—"}</TableCell>
                  {canWrite && <TableCell><Button size="sm" variant="ghost" onClick={() => removeItem.mutate(it.id)}><Trash2 className="size-4" /></Button></TableCell>}
                </TableRow>
              ))}
              {items.data?.length === 0 && <TableRow><TableCell colSpan={6} className="text-center text-muted-foreground">Nenhum produto vinculado</TableCell></TableRow>}
            </TableBody>
          </Table>
        </div>
      </DialogContent>
    </Dialog>
  );
}
