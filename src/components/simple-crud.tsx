import { useState, useMemo } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useActiveCompany } from "@/hooks/use-active-company";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle, DialogTrigger,
} from "@/components/ui/dialog";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Card } from "@/components/ui/card";
import { StatusBadge } from "@/components/status-badge";
import { Plus, Pencil, Search } from "lucide-react";
import { toast } from "sonner";

export type SimpleField = {
  name: string;
  label: string;
  type?: "text" | "textarea";
  required?: boolean;
};

const STATUS_OPTIONS = ["ativo", "inativo", "pendente", "revisao_necessaria"] as const;
const PAGE_SIZE = 10;

export function SimpleCrud({
  table, title, fields,
}: {
  table: "brands" | "ingredients" | "allergens";
  title: string;
  fields: SimpleField[];
}) {
  const qc = useQueryClient();
  const { companyId, canWrite, isReadOnly } = useActiveCompany();
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState<string>("all");
  const [page, setPage] = useState(1);
  const [open, setOpen] = useState(false);
  const [editing, setEditing] = useState<any | null>(null);

  const { data, isLoading } = useQuery({
    queryKey: [table, companyId, search, statusFilter, page],
    enabled: !!companyId,
    queryFn: async () => {
      let q = supabase.from(table as any).select("*", { count: "exact" })
        .eq("company_id", companyId!)
        .order("created_at", { ascending: false })
        .range((page - 1) * PAGE_SIZE, page * PAGE_SIZE - 1);
      if (search.trim()) q = q.ilike("name", `%${search.trim()}%`);
      if (statusFilter !== "all") q = q.eq("status", statusFilter);
      const { data, error, count } = await q;
      if (error) throw error;
      return { rows: data as any[], count: count ?? 0 };
    },
  });

  const empty = useMemo(
    () => fields.reduce((acc, f) => ({ ...acc, [f.name]: "" }), {} as Record<string, string>),
    [fields],
  );
  const [form, setForm] = useState<Record<string, string>>(empty);

  function openCreate() { setEditing(null); setForm(empty); setOpen(true); }
  function openEdit(row: any) {
    setEditing(row);
    setForm(fields.reduce((a, f) => ({ ...a, [f.name]: row[f.name] ?? "" }), {} as any));
    setOpen(true);
  }

  const save = useMutation({
    mutationFn: async () => {
      const payload: any = { company_id: companyId };
      fields.forEach((f) => { payload[f.name] = form[f.name] || null; });
      if (editing) {
        const { error } = await supabase.from(table as any).update(payload).eq("id", editing.id);
        if (error) throw error;
      } else {
        const { data: u } = await supabase.auth.getUser();
        payload.created_by = u.user?.id;
        const { error } = await supabase.from(table as any).insert(payload);
        if (error) throw error;
      }
    },
    onSuccess: () => {
      toast.success(editing ? "Registro atualizado" : "Registro criado");
      setOpen(false);
      qc.invalidateQueries({ queryKey: [table] });
    },
    onError: (e: any) => toast.error("Erro", { description: e.message }),
  });

  const toggleStatus = useMutation({
    mutationFn: async (row: any) => {
      const next = row.status === "ativo" ? "inativo" : "ativo";
      const { error } = await supabase.from(table as any).update({ status: next }).eq("id", row.id);
      if (error) throw error;
    },
    onSuccess: () => {
      toast.success("Status alterado");
      qc.invalidateQueries({ queryKey: [table] });
    },
    onError: (e: any) => toast.error("Erro", { description: e.message }),
  });

  const totalPages = Math.max(1, Math.ceil((data?.count ?? 0) / PAGE_SIZE));

  return (
    <Card className="p-4">
      <div className="flex flex-wrap items-center justify-between gap-3 mb-4">
        <div className="flex flex-1 min-w-0 items-center gap-2">
          <div className="relative max-w-xs">
            <Search className="absolute left-2 top-1/2 -translate-y-1/2 size-4 text-muted-foreground" />
            <Input
              placeholder="Buscar por nome…"
              value={search}
              onChange={(e) => { setSearch(e.target.value); setPage(1); }}
              className="pl-8"
            />
          </div>
          <Select value={statusFilter} onValueChange={(v) => { setStatusFilter(v); setPage(1); }}>
            <SelectTrigger className="w-[200px]"><SelectValue /></SelectTrigger>
            <SelectContent>
              <SelectItem value="all">Todos os status</SelectItem>
              {STATUS_OPTIONS.map((s) => <SelectItem key={s} value={s}>{s}</SelectItem>)}
            </SelectContent>
          </Select>
        </div>
        {canWrite && (
          <Dialog open={open} onOpenChange={setOpen}>
            <DialogTrigger asChild>
              <Button onClick={openCreate}><Plus className="size-4 mr-1" /> Novo {title}</Button>
            </DialogTrigger>
            <DialogContent>
              <DialogHeader>
                <DialogTitle>{editing ? `Editar ${title}` : `Novo ${title}`}</DialogTitle>
              </DialogHeader>
              <div className="space-y-3">
                {fields.map((f) => (
                  <div key={f.name} className="space-y-1.5">
                    <Label>{f.label}{f.required && " *"}</Label>
                    <Input
                      value={form[f.name] ?? ""}
                      onChange={(e) => setForm({ ...form, [f.name]: e.target.value })}
                    />
                  </div>
                ))}
              </div>
              <DialogFooter>
                <Button variant="outline" onClick={() => setOpen(false)}>Cancelar</Button>
                <Button onClick={() => save.mutate()} disabled={save.isPending || !form.name?.trim()}>
                  Salvar
                </Button>
              </DialogFooter>
            </DialogContent>
          </Dialog>
        )}
      </div>

      <div className="rounded-md border overflow-x-auto">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Nome</TableHead>
              {fields.find((f) => f.name === "code") && <TableHead>Código</TableHead>}
              <TableHead>Status</TableHead>
              <TableHead className="text-right">Ações</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {isLoading && <TableRow><TableCell colSpan={4} className="text-center py-8 text-muted-foreground">Carregando…</TableCell></TableRow>}
            {!isLoading && (data?.rows.length ?? 0) === 0 && (
              <TableRow><TableCell colSpan={4} className="text-center py-8 text-muted-foreground">Nenhum registro.</TableCell></TableRow>
            )}
            {data?.rows.map((row) => (
              <TableRow key={row.id}>
                <TableCell className="font-medium">{row.name}</TableCell>
                {fields.find((f) => f.name === "code") && <TableCell>{row.code ?? "—"}</TableCell>}
                <TableCell><StatusBadge status={row.status} /></TableCell>
                <TableCell className="text-right space-x-1">
                  {canWrite && (
                    <>
                      <Button size="sm" variant="ghost" onClick={() => openEdit(row)}>
                        <Pencil className="size-4" />
                      </Button>
                      <Button size="sm" variant="outline" onClick={() => toggleStatus.mutate(row)}>
                        {row.status === "ativo" ? "Inativar" : "Ativar"}
                      </Button>
                    </>
                  )}
                  {isReadOnly && <span className="text-xs text-muted-foreground">Somente leitura</span>}
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </div>

      <div className="flex items-center justify-between mt-3 text-sm text-muted-foreground">
        <div>{data?.count ?? 0} registro(s)</div>
        <div className="flex items-center gap-2">
          <Button size="sm" variant="outline" disabled={page <= 1} onClick={() => setPage(page - 1)}>Anterior</Button>
          <span>Página {page} de {totalPages}</span>
          <Button size="sm" variant="outline" disabled={page >= totalPages} onClick={() => setPage(page + 1)}>Próxima</Button>
        </div>
      </div>
    </Card>
  );
}
