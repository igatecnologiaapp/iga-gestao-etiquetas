// FASE 16 — Card de geração de código de pareamento curto.
// Substitui em UX a colagem manual de token: o admin gera um código de 6 dígitos
// que o operador digita no Print Agent instalado na estação.

import { useEffect, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { KeyRound, Copy, Loader2, Download, Clock } from "lucide-react";
import { toast } from "sonner";
import { createPairingCode, listActivePairingCodes } from "@/lib/print/pairing-codes.functions";

interface Props {
  companyId: string;
}

function formatCode(code: string): string {
  return `${code.slice(0, 3)} ${code.slice(3)}`;
}

function useCountdown(expiresAt: string | null): string {
  const [now, setNow] = useState(() => Date.now());
  useEffect(() => {
    if (!expiresAt) return;
    const id = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(id);
  }, [expiresAt]);
  if (!expiresAt) return "";
  const diff = new Date(expiresAt).getTime() - now;
  if (diff <= 0) return "expirado";
  const m = Math.floor(diff / 60000);
  const s = Math.floor((diff % 60000) / 1000);
  return `${m}:${String(s).padStart(2, "0")}`;
}

export function PairingCodeCard({ companyId }: Props) {
  const qc = useQueryClient();
  const [label, setLabel] = useState("Estação principal");
  const create = useServerFn(createPairingCode);
  const list = useServerFn(listActivePairingCodes);

  const active = useQuery({
    queryKey: ["pairing-codes", companyId],
    queryFn: () => list({ data: { companyId } }),
    refetchInterval: 15_000,
  });

  const mutate = useMutation({
    mutationFn: () => create({ data: { companyId, label: label.trim() || "Estação" } }),
    onSuccess: () => {
      toast.success("Código gerado — válido por 10 minutos");
      qc.invalidateQueries({ queryKey: ["pairing-codes", companyId] });
    },
    onError: (e: any) => toast.error(e?.message ?? "Falha ao gerar código"),
  });

  const current = active.data?.[0] ?? null;
  const countdown = useCountdown(current?.expires_at ?? null);

  return (
    <Card className="p-4 space-y-3">
      <div className="flex items-center gap-2">
        <KeyRound className="size-4" />
        <div className="font-medium">Pareamento do Print Agent</div>
        <Badge variant="outline">novo</Badge>
      </div>

      <p className="text-sm text-muted-foreground">
        Gere um código de 6 dígitos e digite-o no aplicativo Print Agent instalado na
        estação. O agente recebe um token permanente automaticamente — sem copiar e
        colar.
      </p>

      <div className="grid grid-cols-1 md:grid-cols-[1fr_auto] gap-2 items-end">
        <div>
          <Label>Identificação da estação</Label>
          <Input
            value={label}
            onChange={(e) => setLabel(e.target.value)}
            placeholder="Ex.: Balcão 1, Açougue, Caixa 2"
          />
        </div>
        <Button onClick={() => mutate.mutate()} disabled={mutate.isPending}>
          {mutate.isPending ? <Loader2 className="size-4 animate-spin" /> : <KeyRound className="size-4" />}
          Gerar código
        </Button>
      </div>

      {current && (
        <Alert>
          <Clock className="size-4" />
          <AlertTitle className="flex items-center gap-2">
            Código ativo · expira em {countdown}
          </AlertTitle>
          <AlertDescription className="space-y-2">
            <div className="flex items-center gap-3">
              <code className="text-3xl font-mono tracking-[0.4em] bg-muted px-3 py-1 rounded">
                {formatCode(current.code)}
              </code>
              <Button
                size="sm"
                variant="ghost"
                onClick={() => {
                  navigator.clipboard.writeText(current.code).catch(() => {});
                  toast.success("Código copiado");
                }}
              >
                <Copy className="size-4" />
              </Button>
            </div>
            <div className="text-xs text-muted-foreground">
              Estação: <strong>{current.label}</strong>. Códigos anteriores foram
              invalidados.
            </div>
          </AlertDescription>
        </Alert>
      )}

      <div className="border-t pt-3 text-sm">
        <div className="font-medium mb-1 flex items-center gap-2">
          <Download className="size-4" /> Como informar o código na estação
        </div>
        <ol className="list-decimal pl-5 space-y-1 text-muted-foreground">
          <li>Já baixou e instalou o Print Agent? Se não, use o card "Instalador do Print Agent" abaixo.</li>
          <li>Na estação Windows, dê duplo-clique no atalho <strong>Parear Print Agent</strong> (Área de Trabalho ou Menu Iniciar).</li>
          <li>Uma janela vai abrir pedindo o código — digite os 6 dígitos acima e clique <strong>OK</strong>.</li>
          <li>Aparece a mensagem "Pareamento concluído". Volte aqui e clique em <strong>Detectar impressoras</strong> no Assistente.</li>
        </ol>
        <p className="text-xs text-muted-foreground mt-2">
          Não precisa abrir Prompt de Comando — toda a configuração é por janelas. O código expira em 10 minutos e é de uso único.
        </p>
      </div>
    </Card>
  );
}
