import { createFileRoute } from "@tanstack/react-router";
import { useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useActiveCompany } from "@/hooks/use-active-company";
import { PageHeader } from "@/components/page-header";
import { StatusBadge } from "@/components/status-badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Card } from "@/components/ui/card";
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Plus, Pencil } from "lucide-react";
import { toast } from "sonner";

export const Route = createFileRoute("/app/layout-categories")({ component: Page });

function Page() {
  const qc = useQueryClient();
  const { companyId, canWrite } = useActiveCompany();
  const [open, setOpen] = useState(false);
  const [form, setForm] = useState<any>({ name: "", description: "", status: "ativo" });

  const { data } = useQuery({
    queryKey: ["label_categories_full", companyId],
    enabled: !!companyId,
    queryFn: async () => {
      const { data, error } = await (supabase.from("label_categories" as any) as any)
        .select("*").eq("company_id", companyId!).order("name");
      if (error) throw error;
      return data as any[];
    },
  });

  const save = useMutation({
    mutationFn: async () => {
      const payload = { name: form.name, description: form.description || null, status: form.status, company_id: companyId };
      if (form.id) {
        const { error } = await (supabase.from("label_categories" as any) as any).update(payload).eq("id", form.id);
        if (error) throw error;
      } else {
        const { error } = await (supabase.from("label_categories" as any) as any).insert(payload);
        if (error) throw error;
      }
    },
    onSuccess: () => { toast.success("Salvo"); setOpen(false); setForm({ name: "", description: "", status: "ativo" }); qc.invalidateQueries({ queryKey: ["label_categories_full"] }); },
    onError: (e: any) => toast.error(e.message),
  });

  return (
    <>
      <PageHeader
        title="Categorias de layout"
        actions={canWrite && (
          <Dialog open={open} onOpenChange={(o) => { setOpen(o); if (!o) setForm({ name: "", description: "", status: "ativo" }); }}>
            <DialogTrigger asChild><Button><Plus className="size-4" /> Nova categoria</Button></DialogTrigger>
            <DialogContent>
              <DialogHeader><DialogTitle>{form.id ? "Editar" : "Nova"} categoria</DialogTitle></DialogHeader>
              <div className="space-y-3">
                <div><Label>Nome</Label><Input value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} /></div>
                <div><Label>Descrição</Label><Textarea value={form.description ?? ""} onChange={(e) => setForm({ ...form, description: e.target.value })} /></div>
              </div>
              <DialogFooter><Button variant="outline" onClick={() => setOpen(false)}>Cancelar</Button><Button onClick={() => save.mutate()}>Salvar</Button></DialogFooter>
            </DialogContent>
          </Dialog>
        )}
      />
      <Card className="p-4">
        <Table>
          <TableHeader><TableRow><TableHead>Nome</TableHead><TableHead>Descrição</TableHead><TableHead>Status</TableHead><TableHead></TableHead></TableRow></TableHeader>
          <TableBody>
            {data?.map((r) => (
              <TableRow key={r.id}>
                <TableCell className="font-medium">{r.name}{r.is_native && <span className="ml-2 text-xs text-muted-foreground">(nativa)</span>}</TableCell>
                <TableCell className="text-sm text-muted-foreground">{r.description ?? "—"}</TableCell>
                <TableCell><StatusBadge status={r.status} /></TableCell>
                <TableCell>{canWrite && <Button size="sm" variant="ghost" onClick={() => { setForm(r); setOpen(true); }}><Pencil className="size-4" /></Button>}</TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </Card>
    </>
  );
}
