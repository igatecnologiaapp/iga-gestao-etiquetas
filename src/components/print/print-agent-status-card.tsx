// Indicador de status do Print Agent local — Configurações > Impressoras.
// Mostra: instalado (pareado), em execução (alcançável) e porta ativa.

import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Activity, CheckCircle2, XCircle, Loader2, RefreshCw, AlertTriangle } from "lucide-react";
import { usePrintAgent } from "@/lib/print/use-print-agent";

const AGENT_PORT = 17777;

interface PrintAgentStatusCardProps {
  companyId: string;
}

export function PrintAgentStatusCard({ companyId }: PrintAgentStatusCardProps) {
  const { health, loading, refresh } = usePrintAgent(companyId);

  const running = !!health?.reachable;
  // Quando o agente responde mas reporta paired=false, está instalado mas não pareado.
  // Quando reachable=false, não conseguimos confirmar instalação (provavelmente não está rodando).
  const installed = running ? !!health?.paired : null;

  return (
    <Card className="p-4 space-y-3">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2 font-medium">
          <Activity className="size-4" />
          Status do Print Agent
        </div>
        <Button size="sm" variant="ghost" onClick={() => refresh()} disabled={loading}>
          {loading ? <Loader2 className="size-4 animate-spin" /> : <RefreshCw className="size-4" />}
          <span className="ml-1">Atualizar</span>
        </Button>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-3 gap-2 text-sm">
        <StatusRow
          label="Instalado"
          state={
            loading
              ? "loading"
              : installed === true
                ? "ok"
                : installed === false
                  ? "warn"
                  : "unknown"
          }
          value={
            loading
              ? "Verificando..."
              : installed === true
                ? "Sim, pareado"
                : installed === false
                  ? "Sem pareamento"
                  : "Não detectado"
          }
        />
        <StatusRow
          label="Em execução"
          state={loading ? "loading" : running ? "ok" : "error"}
          value={loading ? "Verificando..." : running ? `Online${health?.version ? ` · v${health.version}` : ""}` : "Offline"}
        />
        <StatusRow
          label="Porta ativa"
          state={loading ? "loading" : running ? "ok" : "unknown"}
          value={running ? `127.0.0.1:${AGENT_PORT}` : `${AGENT_PORT} (esperada)`}
        />
      </div>

      {!loading && !running && (
        <div className="text-xs text-muted-foreground">
          O agente não respondeu em <code>http://127.0.0.1:{AGENT_PORT}</code>. Verifique se o Print Agent está
          instalado e em execução nesta estação. Se necessário, baixe e instale pelo card "Baixar Print Agent".
        </div>
      )}
      {!loading && running && installed === false && (
        <div className="text-xs text-amber-700 dark:text-amber-400">
          O serviço está em execução, mas o pareamento ainda não foi reconhecido. Execute o Diagnóstico Completo antes
          de realizar qualquer novo pareamento.
        </div>
      )}
    </Card>
  );
}

function StatusRow({
  label,
  state,
  value,
}: {
  label: string;
  state: "ok" | "warn" | "error" | "loading" | "unknown";
  value: string;
}) {
  const icon =
    state === "ok" ? <CheckCircle2 className="size-4 text-emerald-600" />
    : state === "error" ? <XCircle className="size-4 text-destructive" />
    : state === "warn" ? <AlertTriangle className="size-4 text-amber-600" />
    : state === "loading" ? <Loader2 className="size-4 animate-spin text-muted-foreground" />
    : <XCircle className="size-4 text-muted-foreground" />;

  const badgeVariant =
    state === "ok" ? "default"
    : state === "error" ? "destructive"
    : "secondary";

  return (
    <div className="rounded-md border p-2">
      <div className="text-[11px] uppercase tracking-wide text-muted-foreground">{label}</div>
      <div className="flex items-center gap-2 mt-1">
        {icon}
        <Badge variant={badgeVariant as any} className="font-normal">{value}</Badge>
      </div>
    </div>
  );
}
