import { createFileRoute, Link } from "@tanstack/react-router";
import { useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useActiveCompany } from "@/hooks/use-active-company";
import { PageHeader } from "@/components/page-header";
import { StatusBadge } from "@/components/status-badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card } from "@/components/ui/card";
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Plug, Plus, Eye } from "lucide-react";
import { toast } from "sonner";

export const Route = createFileRoute("/app/integrations")({ component: Page });

const TYPES = [
  { v: "erp", l: "ERP" },
  { v: "printer", l: "Impressoras" },
  { v: "scale", l: "Balanças" },
  { v: "whatsapp", l: "WhatsApp" },
  { v: "email", l: "E-mail" },
  { v: "external_api", l: "API Externa" },
  { v: "production", l: "Produção" },
  { v: "tech_sheet", l: "Ficha Técnica" },
];

const AUTH = ["none", "api_key", "bearer", "basic", "oauth2", "hmac", "custom"];
const STATUSES = ["inactive", "testing", "active", "error", "disabled"];

const empty = {
  name: "", integration_type: "erp", provider: "", status: "inactive",
  base_url: "", auth_type: "none", settings_json: "{}",
};

function Page() {
  const qc = useQueryClient();
  const { companyId, role } = useActiveCompany();
  const isAdmin = role === "administrador";
  const canView = isAdmin || role === "supervisor";
  const [open, setOpen] = useState(false);
  const [form, setForm] = useState<any>(empty);
  const [typeFilter, setTypeFilter] = useState<string>("all");
  const [statusFilter, setStatusFilter] = useState<string>("all");

  const { data } = useQuery({
    queryKey: ["integrations", companyId, typeFilter, statusFilter],
    enabled: !!companyId && canView,
    queryFn: async () => {
      let q = (supabase.from("integration_configs" as any) as any)
        .select("*").eq("company_id", companyId!).order("name");
      if (typeFilter !== "all") q = q.eq("integration_type", typeFilter);
      if (statusFilter !== "all") q = q.eq("status", statusFilter);
      const { data, error } = await q;
      if (error) throw error;
      return data as any[];
    },
  });

  const save = useMutation({
    mutationFn: async () => {
      let settings: any = {};
      try { settings = JSON.parse(form.settings_json || "{}"); } catch { throw new Error("Settings JSON inválido"); }
      const payload: any = {
        company_id: companyId,
        name: form.name,
        integration_type: form.integration_type,
        provider: form.provider || null,
        status: form.status,
        base_url: form.base_url || null,
        auth_type: form.auth_type,
        settings_json: settings,
      };
      if (form.id) {
        const { error } = await (supabase.from("integration_configs" as any) as any).update(payload).eq("id", form.id);
        if (error) throw error;
      } else {
        const { error } = await (supabase.from("integration_configs" as any) as any).insert(payload);
        if (error) throw error;
      }
    },
    onSuccess: () => { toast.success("Integração salva"); setOpen(false); setForm(empty); qc.invalidateQueries({ queryKey: ["integrations"] }); },
    onError: (e: any) => toast.error(e.message),
  });

  const test = useMutation({
    mutationFn: async (id: string) => {
      const now = new Date().toISOString();
      const { error } = await (supabase.from("integration_configs" as any) as any)
        .update({ last_test_at: now, status: "testing" }).eq("id", id);
      if (error) throw error;
      await (supabase.from("integration_logs" as any) as any).insert({
        company_id: companyId, integration_config_id: id,
        event_type: "test_connection", direction: "outbound", status: "skipped",
        response_payload: { note: "Teste simulado — integração real será implementada em fase futura." },
      });
    },
    onSuccess: () => { toast.info("Teste simulado registrado nos logs"); qc.invalidateQueries({ queryKey: ["integrations"] }); },
    onError: (e: any) => toast.error(e.message),
  });

  if (!canView) {
    return <PageHeader title="Integrações" description="Acesso restrito a administradores e supervisores." />;
  }

  return (
    <>
      <PageHeader
        title="Integrações"
        description="Configurações de integração com sistemas externos. Comunicação real implementada em fase futura."
        actions={isAdmin && (
          <Dialog open={open} onOpenChange={(o) => { setOpen(o); if (!o) setForm(empty); }}>
            <DialogTrigger asChild><Button><Plus className="size-4" /> Nova integração</Button></DialogTrigger>
            <DialogContent className="max-w-2xl">
              <DialogHeader><DialogTitle>{form.id ? "Editar" : "Nova"} integração</DialogTitle></DialogHeader>
              <div className="grid grid-cols-2 gap-3">
                <div className="col-span-2"><Label>Nome</Label><Input value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} /></div>
                <div><Label>Tipo</Label>
                  <Select value={form.integration_type} onValueChange={(v) => setForm({ ...form, integration_type: v })}>
                    <SelectTrigger><SelectValue /></SelectTrigger>
                    <SelectContent>{TYPES.map((t) => <SelectItem key={t.v} value={t.v}>{t.l}</SelectItem>)}</SelectContent>
                  </Select>
                </div>
                <div><Label>Provedor</Label><Input value={form.provider} onChange={(e) => setForm({ ...form, provider: e.target.value })} placeholder="Ex.: Bling, Zebra, Twilio" /></div>
                <div className="col-span-2"><Label>Base URL</Label><Input value={form.base_url} onChange={(e) => setForm({ ...form, base_url: e.target.value })} placeholder="https://api.provider.com" /></div>
                <div><Label>Autenticação</Label>
                  <Select value={form.auth_type} onValueChange={(v) => setForm({ ...form, auth_type: v })}>
                    <SelectTrigger><SelectValue /></SelectTrigger>
                    <SelectContent>{AUTH.map((a) => <SelectItem key={a} value={a}>{a}</SelectItem>)}</SelectContent>
                  </Select>
                </div>
                <div><Label>Status</Label>
                  <Select value={form.status} onValueChange={(v) => setForm({ ...form, status: v })}>
                    <SelectTrigger><SelectValue /></SelectTrigger>
                    <SelectContent>{STATUSES.map((s) => <SelectItem key={s} value={s}>{s}</SelectItem>)}</SelectContent>
                  </Select>
                </div>
                <div className="col-span-2"><Label>Configurações (JSON)</Label>
                  <textarea className="w-full h-32 rounded-md border bg-background p-2 font-mono text-xs"
                    value={form.settings_json} onChange={(e) => setForm({ ...form, settings_json: e.target.value })} />
                  <p className="text-xs text-muted-foreground mt-1">Tokens sensíveis devem ser armazenados via tabela <code>integration_tokens</code>, não aqui.</p>
                </div>
              </div>
              <DialogFooter>
                <Button variant="outline" onClick={() => setOpen(false)}>Cancelar</Button>
                <Button onClick={() => save.mutate()} disabled={save.isPending || !form.name}>Salvar</Button>
              </DialogFooter>
            </DialogContent>
          </Dialog>
        )}
      />

      <div className="flex gap-2 mb-4 flex-wrap">
        <Select value={typeFilter} onValueChange={setTypeFilter}>
          <SelectTrigger className="w-48"><SelectValue placeholder="Tipo" /></SelectTrigger>
          <SelectContent>
            <SelectItem value="all">Todos os tipos</SelectItem>
            {TYPES.map((t) => <SelectItem key={t.v} value={t.v}>{t.l}</SelectItem>)}
          </SelectContent>
        </Select>
        <Select value={statusFilter} onValueChange={setStatusFilter}>
          <SelectTrigger className="w-48"><SelectValue placeholder="Status" /></SelectTrigger>
          <SelectContent>
            <SelectItem value="all">Todos os status</SelectItem>
            {STATUSES.map((s) => <SelectItem key={s} value={s}>{s}</SelectItem>)}
          </SelectContent>
        </Select>
      </div>

      <Card>
        <Table>
          <TableHeader><TableRow>
            <TableHead>Nome</TableHead><TableHead>Tipo</TableHead><TableHead>Provedor</TableHead>
            <TableHead>Status</TableHead><TableHead>Último teste</TableHead><TableHead className="text-right">Ações</TableHead>
          </TableRow></TableHeader>
          <TableBody>
            {(data ?? []).map((i: any) => (
              <TableRow key={i.id}>
                <TableCell className="font-medium flex items-center gap-2"><Plug className="size-4 text-muted-foreground" />{i.name}</TableCell>
                <TableCell>{TYPES.find((t) => t.v === i.integration_type)?.l ?? i.integration_type}</TableCell>
                <TableCell>{i.provider ?? "—"}</TableCell>
                <TableCell><StatusBadge status={i.status} /></TableCell>
                <TableCell className="text-xs text-muted-foreground">{i.last_test_at ? new Date(i.last_test_at).toLocaleString("pt-BR") : "—"}</TableCell>
                <TableCell className="text-right space-x-2">
                  <Button asChild variant="ghost" size="sm"><Link to="/app/integrations/$id" params={{ id: i.id }}><Eye className="size-4" /></Link></Button>
                  {isAdmin && <Button variant="outline" size="sm" onClick={() => test.mutate(i.id)} disabled={test.isPending}>Testar</Button>}
                  {isAdmin && <Button variant="ghost" size="sm" onClick={() => { setForm({ ...i, settings_json: JSON.stringify(i.settings_json ?? {}, null, 2) }); setOpen(true); }}>Editar</Button>}
                </TableCell>
              </TableRow>
            ))}
            {!(data ?? []).length && <TableRow><TableCell colSpan={6} className="text-center text-muted-foreground py-8">Nenhuma integração configurada</TableCell></TableRow>}
          </TableBody>
        </Table>
      </Card>
    </>
  );
}
