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
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Plus } from "lucide-react";
import { toast } from "sonner";

export const Route = createFileRoute("/app/message-templates")({ component: Page });

const VARS = [
  "{{product_name}}", "{{label_code}}", "{{batch_code}}", "{{expiration_date}}",
  "{{company_name}}", "{{promotion_name}}", "{{print_date}}",
];
const STATUSES = ["draft", "active", "disabled"];

function Page() {
  const { canWrite } = useActiveCompany();
  return (
    <>
      <PageHeader
        title="Templates de Mensagens"
        description="Modelos de e-mail e WhatsApp com variáveis dinâmicas. Envio real será habilitado quando as integrações estiverem ativas."
      />
      <div className="mb-4 text-xs text-muted-foreground">
        <span className="font-medium">Variáveis disponíveis:</span> {VARS.join("  ")}
      </div>
      <Tabs defaultValue="email">
        <TabsList>
          <TabsTrigger value="email">E-mail</TabsTrigger>
          <TabsTrigger value="whatsapp">WhatsApp</TabsTrigger>
        </TabsList>
        <TabsContent value="email"><TemplateList table="email_templates" kind="email" canWrite={!!canWrite} /></TabsContent>
        <TabsContent value="whatsapp"><TemplateList table="whatsapp_templates" kind="whatsapp" canWrite={!!canWrite} /></TabsContent>
      </Tabs>
    </>
  );
}

function TemplateList({ table, kind, canWrite }: { table: string; kind: "email" | "whatsapp"; canWrite: boolean }) {
  const qc = useQueryClient();
  const { companyId } = useActiveCompany();
  const [open, setOpen] = useState(false);
  const empty: any = kind === "email"
    ? { name: "", subject: "", body: "", status: "draft" }
    : { name: "", message: "", status: "draft" };
  const [form, setForm] = useState<any>(empty);

  const { data } = useQuery({
    queryKey: [table, companyId],
    enabled: !!companyId,
    queryFn: async () => {
      const { data, error } = await (supabase.from(table as any) as any)
        .select("*").eq("company_id", companyId!).order("name");
      if (error) throw error;
      return data as any[];
    },
  });

  const save = useMutation({
    mutationFn: async () => {
      const text = kind === "email" ? (form.subject + " " + form.body) : form.message;
      const variables = VARS.filter((v) => text.includes(v));
      const payload = { ...form, company_id: companyId, variables };
      if (form.id) {
        const { error } = await (supabase.from(table as any) as any).update(payload).eq("id", form.id);
        if (error) throw error;
      } else {
        const { error } = await (supabase.from(table as any) as any).insert(payload);
        if (error) throw error;
      }
    },
    onSuccess: () => { toast.success("Template salvo"); setOpen(false); setForm(empty); qc.invalidateQueries({ queryKey: [table] }); },
    onError: (e: any) => toast.error(e.message),
  });

  return (
    <>
      {canWrite && (
        <div className="mb-3 flex justify-end">
          <Dialog open={open} onOpenChange={(o) => { setOpen(o); if (!o) setForm(empty); }}>
            <DialogTrigger asChild><Button><Plus className="size-4" /> Novo template</Button></DialogTrigger>
            <DialogContent className="max-w-2xl">
              <DialogHeader><DialogTitle>{form.id ? "Editar" : "Novo"} template de {kind}</DialogTitle></DialogHeader>
              <div className="space-y-3">
                <div><Label>Nome</Label><Input value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} /></div>
                {kind === "email" ? (
                  <>
                    <div><Label>Assunto</Label><Input value={form.subject} onChange={(e) => setForm({ ...form, subject: e.target.value })} /></div>
                    <div><Label>Corpo</Label><Textarea rows={8} value={form.body} onChange={(e) => setForm({ ...form, body: e.target.value })} /></div>
                  </>
                ) : (
                  <div><Label>Mensagem</Label><Textarea rows={8} value={form.message} onChange={(e) => setForm({ ...form, message: e.target.value })} /></div>
                )}
                <div><Label>Status</Label>
                  <Select value={form.status} onValueChange={(v) => setForm({ ...form, status: v })}>
                    <SelectTrigger><SelectValue /></SelectTrigger>
                    <SelectContent>{STATUSES.map((s) => <SelectItem key={s} value={s}>{s}</SelectItem>)}</SelectContent>
                  </Select>
                </div>
              </div>
              <DialogFooter>
                <Button variant="outline" onClick={() => setOpen(false)}>Cancelar</Button>
                <Button onClick={() => save.mutate()} disabled={save.isPending || !form.name}>Salvar</Button>
              </DialogFooter>
            </DialogContent>
          </Dialog>
        </div>
      )}
      <Card>
        <Table>
          <TableHeader><TableRow>
            <TableHead>Nome</TableHead>
            <TableHead>{kind === "email" ? "Assunto" : "Prévia"}</TableHead>
            <TableHead>Variáveis</TableHead>
            <TableHead>Status</TableHead>
            <TableHead className="text-right">Ações</TableHead>
          </TableRow></TableHeader>
          <TableBody>
            {(data ?? []).map((t: any) => (
              <TableRow key={t.id}>
                <TableCell className="font-medium">{t.name}</TableCell>
                <TableCell className="truncate max-w-xs">{kind === "email" ? t.subject : (t.message ?? "").slice(0, 80)}</TableCell>
                <TableCell className="text-xs text-muted-foreground">{(t.variables ?? []).join(", ") || "—"}</TableCell>
                <TableCell><StatusBadge status={t.status} /></TableCell>
                <TableCell className="text-right">
                  {canWrite && <Button variant="ghost" size="sm" onClick={() => { setForm(t); setOpen(true); }}>Editar</Button>}
                </TableCell>
              </TableRow>
            ))}
            {!(data ?? []).length && <TableRow><TableCell colSpan={5} className="text-center text-muted-foreground py-8">Nenhum template</TableCell></TableRow>}
          </TableBody>
        </Table>
      </Card>
    </>
  );
}
