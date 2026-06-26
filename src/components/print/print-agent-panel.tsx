// FASE 7 — Painel compacto de impressão direta para a tela de emissão.
// Não substitui o botão de PDF — adiciona uma seção lateral com status do agente,
// gestão de token e botão "Imprimir direto" com fallback explícito.

import { useState } from "react";
import { Link } from "@tanstack/react-router";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Settings, Wifi, WifiOff, Loader2, KeyRound, Eye, EyeOff } from "lucide-react";
import { usePrintAgent } from "@/lib/print/use-print-agent";

interface PrintAgentPanelProps {
  companyId: string | null;
  canManage: boolean;
}

export function PrintAgentPanel({ companyId, canManage }: PrintAgentPanelProps) {
  const { health, loading, hasToken, token, mock, setToken, setMock, refresh } = usePrintAgent(companyId);
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState("");
  const [show, setShow] = useState(false);

  if (!companyId) return null;

  const online = !!health?.ok;

  return (
    <div className="rounded-md border p-3 space-y-2 text-sm">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2 font-medium">
          {loading ? (
            <Loader2 className="size-4 animate-spin" />
          ) : online ? (
            <Wifi className="size-4 text-emerald-600" />
          ) : (
            <WifiOff className="size-4 text-amber-600" />
          )}
          Print Agent
          {mock && <Badge variant="outline">simulado</Badge>}
        </div>
        <Button variant="ghost" size="sm" onClick={() => refresh()} disabled={loading}>
          Atualizar
        </Button>
      </div>

      <div className="text-xs text-muted-foreground">
        {loading
          ? "Verificando agente local..."
          : online
            ? `Online${health?.version ? ` · v${health.version}` : ""}`
            : `Offline${health?.code ? ` (${health.code})` : ""} — emissão usará PDF.`}
      </div>

      {!hasToken && !mock && (
        <Alert variant="default" className="py-2">
          <KeyRound className="size-4" />
          <AlertTitle className="text-sm">Sem token de pareamento</AlertTitle>
          <AlertDescription className="text-xs">
            Para imprimir direto nesta estação, cole o token gerado em Gerenciamento de Impressoras.
          </AlertDescription>
        </Alert>
      )}

      {canManage && (
        <div className="space-y-2">
          {editing ? (
            <div className="flex gap-2">
              <Input
                type={show ? "text" : "password"}
                placeholder="pat_..."
                value={draft}
                onChange={(e) => setDraft(e.target.value)}
                className="h-8 text-xs"
              />
              <Button size="sm" variant="ghost" onClick={() => setShow((s) => !s)}>
                {show ? <EyeOff className="size-4" /> : <Eye className="size-4" />}
              </Button>
              <Button
                size="sm"
                onClick={() => {
                  setToken(draft.trim() || null);
                  setEditing(false);
                  setDraft("");
                }}
              >
                Salvar
              </Button>
              <Button size="sm" variant="ghost" onClick={() => { setEditing(false); setDraft(""); }}>
                Cancelar
              </Button>
            </div>
          ) : (
            <div className="flex flex-wrap gap-2">
              <Button size="sm" variant="outline" onClick={() => setEditing(true)}>
                {hasToken ? "Trocar token" : "Colar token"}
              </Button>
              {hasToken && (
                <Button size="sm" variant="ghost" onClick={() => setToken(null)}>
                  Remover token
                </Button>
              )}
              <Button size="sm" variant="ghost" onClick={() => setMock(!mock)}>
                {mock ? "Desativar simulador" : "Ativar simulador"}
              </Button>
              <Link to="/app/printers">
                <Button size="sm" variant="outline">
                  <Settings className="size-4 mr-1" /> Configurar agora
                </Button>
              </Link>
            </div>
          )}
          {hasToken && !editing && (
            <div className="text-[11px] text-muted-foreground">
              Token armazenado localmente neste navegador (terminação …{token!.slice(-6)}).
            </div>
          )}
        </div>
      )}
    </div>
  );
}
