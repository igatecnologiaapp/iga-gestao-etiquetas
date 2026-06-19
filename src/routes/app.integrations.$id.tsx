import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useActiveCompany } from "@/hooks/use-active-company";
import { PageHeader } from "@/components/page-header";
import { StatusBadge } from "@/components/status-badge";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { ArrowLeft } from "lucide-react";

export const Route = createFileRoute("/app/integrations/$id")({ component: Page });

function Page() {
  const { id } = Route.useParams();
  const { companyId, role } = useActiveCompany();
  const canView = role === "administrador" || role === "supervisor";

  const { data: cfg } = useQuery({
    queryKey: ["integration", id],
    enabled: !!id && canView,
    queryFn: async () => {
      const { data, error } = await (supabase.from("integration_configs" as any) as any)
        .select("*").eq("id", id).maybeSingle();
      if (error) throw error;
      return data as any;
    },
  });

  const { data: logs } = useQuery({
    queryKey: ["integration-logs", id],
    enabled: !!id && canView,
    queryFn: async () => {
      const { data, error } = await (supabase.from("integration_logs" as any) as any)
        .select("*").eq("integration_config_id", id).order("created_at", { ascending: false }).limit(100);
      if (error) throw error;
      return data as any[];
    },
  });

  const { data: queue } = useQuery({
    queryKey: ["integration-queue", id],
    enabled: !!id && canView,
    queryFn: async () => {
      const { data, error } = await (supabase.from("integration_event_queue" as any) as any)
        .select("*").eq("integration_config_id", id).order("created_at", { ascending: false }).limit(100);
      if (error) throw error;
      return data as any[];
    },
  });

  if (!canView) return <PageHeader title="Integração" description="Acesso restrito." />;
  if (!cfg) return <PageHeader title="Integração" description="Carregando ou não encontrada." />;

  return (
    <>
      <div className="mb-2"><Button asChild variant="ghost" size="sm"><Link to="/app/integrations"><ArrowLeft className="size-4" /> Voltar</Link></Button></div>
      <PageHeader title={cfg.name} description={`${cfg.integration_type} • ${cfg.provider ?? "sem provedor"}`} />

      <Tabs defaultValue="settings">
        <TabsList>
          <TabsTrigger value="settings">Configurações</TabsTrigger>
          <TabsTrigger value="logs">Logs ({logs?.length ?? 0})</TabsTrigger>
          <TabsTrigger value="queue">Fila ({queue?.length ?? 0})</TabsTrigger>
        </TabsList>

        <TabsContent value="settings">
          <Card className="p-4 space-y-3">
            <Row k="Status" v={<StatusBadge status={cfg.status} />} />
            <Row k="Tipo" v={cfg.integration_type} />
            <Row k="Provedor" v={cfg.provider ?? "—"} />
            <Row k="Base URL" v={cfg.base_url ?? "—"} />
            <Row k="Autenticação" v={cfg.auth_type} />
            <Row k="Último teste" v={cfg.last_test_at ? new Date(cfg.last_test_at).toLocaleString("pt-BR") : "—"} />
            <Row k="Último sucesso" v={cfg.last_success_at ? new Date(cfg.last_success_at).toLocaleString("pt-BR") : "—"} />
            <Row k="Último erro" v={cfg.last_error_at ? new Date(cfg.last_error_at).toLocaleString("pt-BR") : "—"} />
            <div>
              <div className="text-xs uppercase text-muted-foreground mb-1">Settings JSON</div>
              <pre className="bg-muted/40 p-3 rounded text-xs overflow-auto">{JSON.stringify(cfg.settings_json, null, 2)}</pre>
              <p className="text-xs text-muted-foreground mt-2">Tokens sensíveis não são exibidos. Armazenados como hash em <code>integration_tokens</code>.</p>
            </div>
          </Card>
        </TabsContent>

        <TabsContent value="logs">
          <Card>
            <Table>
              <TableHeader><TableRow>
                <TableHead>Data</TableHead><TableHead>Evento</TableHead><TableHead>Direção</TableHead>
                <TableHead>Status</TableHead><TableHead>Erro</TableHead>
              </TableRow></TableHeader>
              <TableBody>
                {(logs ?? []).map((l: any) => (
                  <TableRow key={l.id}>
                    <TableCell className="text-xs">{new Date(l.created_at).toLocaleString("pt-BR")}</TableCell>
                    <TableCell>{l.event_type}</TableCell>
                    <TableCell>{l.direction}</TableCell>
                    <TableCell><StatusBadge status={l.status} /></TableCell>
                    <TableCell className="text-xs text-destructive truncate max-w-xs">{l.error_message ?? "—"}</TableCell>
                  </TableRow>
                ))}
                {!(logs ?? []).length && <TableRow><TableCell colSpan={5} className="text-center text-muted-foreground py-8">Sem logs</TableCell></TableRow>}
              </TableBody>
            </Table>
          </Card>
        </TabsContent>

        <TabsContent value="queue">
          <Card>
            <Table>
              <TableHeader><TableRow>
                <TableHead>Criado em</TableHead><TableHead>Evento</TableHead><TableHead>Status</TableHead>
                <TableHead>Tentativas</TableHead><TableHead>Próximo retry</TableHead>
              </TableRow></TableHeader>
              <TableBody>
                {(queue ?? []).map((q: any) => (
                  <TableRow key={q.id}>
                    <TableCell className="text-xs">{new Date(q.created_at).toLocaleString("pt-BR")}</TableCell>
                    <TableCell>{q.event_name}</TableCell>
                    <TableCell><StatusBadge status={q.status} /></TableCell>
                    <TableCell>{q.attempts}</TableCell>
                    <TableCell className="text-xs">{q.next_retry_at ? new Date(q.next_retry_at).toLocaleString("pt-BR") : "—"}</TableCell>
                  </TableRow>
                ))}
                {!(queue ?? []).length && <TableRow><TableCell colSpan={5} className="text-center text-muted-foreground py-8">Fila vazia</TableCell></TableRow>}
              </TableBody>
            </Table>
          </Card>
        </TabsContent>
      </Tabs>
    </>
  );
}

function Row({ k, v }: { k: string; v: any }) {
  return (
    <div className="flex justify-between gap-4 text-sm border-b last:border-0 py-1.5">
      <span className="text-muted-foreground">{k}</span>
      <span className="font-medium text-right">{v}</span>
    </div>
  );
}
