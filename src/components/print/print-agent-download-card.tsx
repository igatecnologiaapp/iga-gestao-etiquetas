// FASE 16.1 — Download do instalador nativo do Print Agent.
// O binário é grande (~38 MB) e fica fora do repositório, hospedado via
// lovable-assets. A referência canônica é src/assets/print-agent-setup.exe.asset.json.
// Nenhum token é embutido no download.

import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Download, CheckCircle2 } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import installerAsset from "@/assets/print-agent-setup.exe.asset.json";

const INSTALLER_URL: string = installerAsset.url;
const INSTALLER_FILENAME = "PrintAgent-Setup.exe";
const INSTALLER_SIZE: number = installerAsset.size ?? 0;

export function PrintAgentDownloadCard({
  canDownload,
  companyId,
}: {
  canDownload: boolean;
  companyId?: string | null;
}) {
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
            url: INSTALLER_URL,
            at: new Date().toISOString(),
          },
        });
      }
    } catch {
      // não bloqueia o download em caso de falha de auditoria
    }
    const a = document.createElement("a");
    a.href = INSTALLER_URL;
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
        <Badge variant="outline">disponível</Badge>
      </div>

      <p className="text-sm text-muted-foreground">
        Baixe e instale o Print Agent na estação que terá a impressora conectada. O
        instalador <strong>não contém</strong> token ou código de pareamento — após
        instalar, gere um código de 6 dígitos acima e informe-o no agente.
      </p>

      <div className="flex flex-wrap items-center gap-3">
        <Button onClick={handleDownload} disabled={!canDownload}>
          <Download className="size-4" /> Baixar Print Agent
        </Button>
        {INSTALLER_SIZE > 0 && (
          <span className="text-xs text-muted-foreground">
            {(INSTALLER_SIZE / (1024 * 1024)).toFixed(1)} MB · {INSTALLER_FILENAME}
          </span>
        )}
        {!canDownload && (
          <span className="text-xs text-muted-foreground">
            Apenas administradores e supervisores podem baixar o instalador.
          </span>
        )}
      </div>

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
