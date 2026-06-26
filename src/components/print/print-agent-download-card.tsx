// FASE 16.1 — Download do instalador nativo do Print Agent.
// O arquivo deve ser publicado em /public/print-agent/PrintAgent-Setup.exe.
// A presença é verificada via HEAD; quando ausente, mostramos mensagem amigável
// orientando a publicar o build. Nenhum token é embutido no download.

import { useEffect, useState } from "react";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Badge } from "@/components/ui/badge";
import { Download, ShieldAlert, CheckCircle2, Loader2 } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";

const INSTALLER_PATH = "/print-agent/PrintAgent-Setup.exe";
const INSTALLER_FILENAME = "PrintAgent-Setup.exe";

type Availability = "checking" | "available" | "missing";

export function PrintAgentDownloadCard({ canDownload, companyId }: { canDownload: boolean; companyId?: string | null }) {
  const [status, setStatus] = useState<Availability>("checking");
  const [size, setSize] = useState<number | null>(null);

  useEffect(() => {
    let cancelled = false;
    fetch(INSTALLER_PATH, { method: "HEAD" })
      .then((r) => {
        if (cancelled) return;
        const ct = r.headers.get("content-type") ?? "";
        // Vite dev/SPA may return index.html for missing files: detect that.
        const isHtmlFallback = ct.includes("text/html");
        if (r.ok && !isHtmlFallback) {
          const len = r.headers.get("content-length");
          setSize(len ? Number(len) : null);
          setStatus("available");
        } else {
          setStatus("missing");
        }
      })
      .catch(() => !cancelled && setStatus("missing"));
    return () => {
      cancelled = true;
    };
  }, []);

  const handleDownload = async () => {
    // Audit: registramos somente metadados (usuário, empresa, arquivo, timestamp).
    // Nenhum token de pareamento é incluído — o instalador é estático e anônimo.
    try {
      const { data: auth } = await supabase.auth.getUser();
      const uid = auth?.user?.id;
      if (uid && companyId) {
        await (supabase.from("audit_logs" as any) as any).insert({
          user_id: uid,
          company_id: companyId,
          action: "OTHER",
          table_name: "print_agent_installer",
          record_id: INSTALLER_FILENAME,
          reason: "download_print_agent_installer",
          new_values: {
            file: INSTALLER_FILENAME,
            path: INSTALLER_PATH,
            at: new Date().toISOString(),
          },
        });
      }
    } catch {
      // não bloqueia o download em caso de falha de auditoria
    }
    const a = document.createElement("a");
    a.href = INSTALLER_PATH;
    a.download = INSTALLER_FILENAME;
    document.body.appendChild(a);
    a.click();
    a.remove();
  };

  return (
    <Card className="p-4 space-y-3">
      <div className="flex items-center gap-2">
        <Download className="size-4" />
        <div className="font-medium">Instalador do Print Agent (Windows)</div>
        {status === "available" && <Badge variant="outline">disponível</Badge>}
        {status === "missing" && <Badge variant="outline">pendente</Badge>}
      </div>

      <p className="text-sm text-muted-foreground">
        Baixe e instale o Print Agent na estação que terá a impressora conectada. O
        instalador <strong>não contém</strong> token ou código de pareamento — após
        instalar, gere um código de 6 dígitos acima e informe-o no agente.
      </p>

      {status === "checking" && (
        <div className="flex items-center gap-2 text-sm text-muted-foreground">
          <Loader2 className="size-4 animate-spin" /> Verificando disponibilidade do instalador…
        </div>
      )}

      {status === "available" && (
        <div className="flex flex-wrap items-center gap-3">
          <Button onClick={handleDownload} disabled={!canDownload}>
            <Download className="size-4" /> Baixar Print Agent
          </Button>
          {size != null && (
            <span className="text-xs text-muted-foreground">
              {(size / (1024 * 1024)).toFixed(1)} MB · {INSTALLER_FILENAME}
            </span>
          )}
          {!canDownload && (
            <span className="text-xs text-muted-foreground">
              Apenas administradores e supervisores podem baixar o instalador.
            </span>
          )}
        </div>
      )}

      {status === "missing" && (
        <Alert>
          <ShieldAlert className="size-4" />
          <AlertTitle>Instalador ainda não disponível</AlertTitle>
          <AlertDescription className="text-sm">
            Gere o build do Print Agent (<code>cd print-agent && npm run build:win</code>)
            e publique o arquivo resultante em{" "}
            <code>public/print-agent/PrintAgent-Setup.exe</code>. Após publicar o app,
            o botão de download fica ativo automaticamente.
          </AlertDescription>
        </Alert>
      )}

      <div className="border-t pt-3 text-sm">
        <div className="font-medium mb-1 flex items-center gap-2">
          <CheckCircle2 className="size-4" /> Como instalar
        </div>
        <ol className="list-decimal pl-5 space-y-1 text-muted-foreground">
          <li>Baixe o instalador clicando no botão acima.</li>
          <li>Abra a pasta <strong>Downloads</strong>.</li>
          <li>Clique com o botão direito em <code>{INSTALLER_FILENAME}</code>.</li>
          <li>Selecione <strong>Executar como administrador</strong> e conclua o assistente.</li>
          <li>Gere o código de 6 dígitos no card de pareamento e informe-o no agente.</li>
        </ol>
      </div>
    </Card>
  );
}
