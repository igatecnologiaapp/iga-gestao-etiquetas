import { useMemo, useState } from "react";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { ScrollArea } from "@/components/ui/scroll-area";
import { buildAgentClient } from "@/lib/print/use-print-agent";
import type { AgentDiagnosticStep, AgentDiagnosticsReport } from "@/lib/print/types";
import { AlertTriangle, CheckCircle2, ClipboardList, Loader2, XCircle } from "lucide-react";
import { toast } from "sonner";

interface Props {
  companyId: string;
}

function statusVariant(ok?: boolean) {
  return ok ? "default" : "destructive";
}

function formatJson(value: unknown): string {
  return JSON.stringify(value, null, 2);
}

function firstFailure(steps: AgentDiagnosticStep[]): AgentDiagnosticStep | null {
  return steps.find((step) => !step.ok) ?? null;
}

export function PrintAgentDiagnosticsCard({ companyId }: Props) {
  const [open, setOpen] = useState(false);
  const [running, setRunning] = useState(false);
  const [report, setReport] = useState<AgentDiagnosticsReport | null>(null);
  const [error, setError] = useState<string | null>(null);

  const failure = useMemo(() => firstFailure(report?.steps ?? []), [report]);

  async function runDiagnostics() {
    setRunning(true);
    setError(null);
    setOpen(true);
    try {
      const client = buildAgentClient(companyId);
      const data = await client.diagnostics();
      setReport(data);
      if (data.ok) toast.success("Diagnóstico concluído sem falhas bloqueantes.");
      else toast.warning("Diagnóstico concluído com falha identificada.");
    } catch (e: any) {
      const message = e?.message ?? "Não foi possível executar o diagnóstico.";
      setError(message);
      setReport({
        ok: false,
        generated_at: new Date().toISOString(),
        base_url: "http://127.0.0.1:17777",
        steps: [
          {
            key: "agent_reachable",
            label: "Verificar instalação do agente",
            ok: false,
            status: e?.code ?? "AGENT_OFFLINE",
            message,
          },
        ],
      });
    } finally {
      setRunning(false);
    }
  }

  return (
    <Card className="p-4 space-y-3">
      <div className="flex items-start justify-between gap-3">
        <div className="space-y-1">
          <div className="flex items-center gap-2 font-medium">
            <ClipboardList className="size-4" /> Diagnóstico do pareamento
          </div>
          <p className="text-sm text-muted-foreground">
            Verifica agente, serviço Windows, porta, arquivo agent.json, token, autenticação e detecção de impressoras.
          </p>
        </div>
        <Button onClick={runDiagnostics} disabled={running}>
          {running ? <Loader2 className="size-4 animate-spin" /> : <ClipboardList className="size-4" />}
          Executar Diagnóstico Completo
        </Button>
      </div>

      {report && !running && (
        <Alert variant={report.ok ? "default" : "destructive"}>
          {report.ok ? <CheckCircle2 className="size-4" /> : <AlertTriangle className="size-4" />}
          <AlertTitle>{report.ok ? "Fluxo validado" : "Falha identificada"}</AlertTitle>
          <AlertDescription className="text-sm">
            {report.ok
              ? "O agente respondeu, o pareamento foi reconhecido e o GET /printers foi validado."
              : failure?.message || failure?.label || "Abra o relatório técnico para ver a etapa que falhou."}
          </AlertDescription>
        </Alert>
      )}

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="max-w-4xl max-h-[92vh]">
          <DialogHeader>
            <DialogTitle>Relatório técnico do Print Agent</DialogTitle>
            <DialogDescription>
              Tokens são exibidos apenas por prefixo, sufixo e tamanho; o valor completo não é mostrado nem registrado.
            </DialogDescription>
          </DialogHeader>

          {running && (
            <div className="flex items-center gap-2 text-sm text-muted-foreground py-6">
              <Loader2 className="size-4 animate-spin" /> Executando verificações automáticas...
            </div>
          )}

          {!running && report && (
            <ScrollArea className="max-h-[65vh] pr-4">
              <div className="space-y-4">
                {error && (
                  <Alert variant="destructive">
                    <XCircle className="size-4" />
                    <AlertTitle>Diagnóstico incompleto</AlertTitle>
                    <AlertDescription>{error}</AlertDescription>
                  </Alert>
                )}

                <div className="grid grid-cols-1 md:grid-cols-3 gap-2 text-sm">
                  <SummaryItem label="Resultado" value={report.ok ? "OK" : "Falhou"} ok={report.ok} />
                  <SummaryItem label="Porta" value={String(report.port ?? 17777)} ok={report.health?.reachable ?? report.ok} />
                  <SummaryItem label="Versão" value={report.version ?? report.health?.version ?? "—"} ok={!!(report.version ?? report.health?.version)} />
                </div>

                <section className="space-y-2">
                  <h3 className="text-sm font-medium">Checklist automático</h3>
                  <div className="space-y-2">
                    {report.steps.map((step) => (
                      <div key={step.key} className="rounded-md border p-3 text-sm flex items-start gap-2">
                        {step.ok ? <CheckCircle2 className="size-4 text-emerald-600 mt-0.5" /> : <XCircle className="size-4 text-destructive mt-0.5" />}
                        <div className="flex-1 min-w-0">
                          <div className="flex flex-wrap items-center gap-2">
                            <span className="font-medium">{step.label}</span>
                            <Badge variant={statusVariant(step.ok) as any}>{step.ok ? "OK" : "Falhou"}</Badge>
                            {step.status && <Badge variant="outline">{step.status}</Badge>}
                          </div>
                          {step.message && <p className="text-muted-foreground mt-1">{step.message}</p>}
                        </div>
                      </div>
                    ))}
                  </div>
                </section>

                <section className="grid grid-cols-1 md:grid-cols-2 gap-3">
                  <ReportBlock title="/health" value={report.health ?? null} />
                  <ReportBlock title="agent.json" value={report.agent_json ?? null} />
                  <ReportBlock title="Autenticação antes do /printers" value={report.auth ?? null} />
                  <ReportBlock title="GET /printers" value={report.printers_check ?? null} />
                  <ReportBlock title="Serviço Windows" value={report.service ?? null} />
                  <ReportBlock title="Último exchange" value={report.exchange ?? null} />
                </section>
              </div>
            </ScrollArea>
          )}

          <DialogFooter>
            {report && (
              <Button
                variant="outline"
                onClick={() => {
                  navigator.clipboard.writeText(formatJson(report)).catch(() => undefined);
                  toast.success("Relatório copiado");
                }}
              >
                Copiar relatório
              </Button>
            )}
            <Button onClick={() => setOpen(false)}>Fechar</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </Card>
  );
}

function SummaryItem({ label, value, ok }: { label: string; value: string; ok: boolean }) {
  return (
    <div className="rounded-md border p-3">
      <div className="text-[11px] uppercase tracking-wide text-muted-foreground">{label}</div>
      <div className="flex items-center gap-2 mt-1">
        <Badge variant={statusVariant(ok) as any}>{value}</Badge>
      </div>
    </div>
  );
}

function ReportBlock({ title, value }: { title: string; value: unknown }) {
  return (
    <div className="rounded-md border p-3 min-w-0">
      <div className="text-sm font-medium mb-2">{title}</div>
      <pre className="text-xs bg-muted p-2 rounded overflow-x-auto whitespace-pre-wrap break-words">
        {formatJson(value)}
      </pre>
    </div>
  );
}