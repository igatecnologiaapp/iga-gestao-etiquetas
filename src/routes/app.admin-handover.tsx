import { createFileRoute } from "@tanstack/react-router";
import { useState } from "react";
import { useServerFn } from "@tanstack/react-start";
import { bootstrapPrincipalAdmin } from "@/lib/admin-users.functions";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Copy, ShieldCheck, AlertTriangle } from "lucide-react";
import { toast } from "sonner";
import { useAuth } from "@/lib/auth-context";

export const Route = createFileRoute("/app/admin-handover")({
  head: () => ({ meta: [{ title: "Transferência de Administrador" }] }),
  component: HandoverPage,
});

function HandoverPage() {
  const run = useServerFn(bootstrapPrincipalAdmin);
  const { signOut } = useAuth();
  const [loading, setLoading] = useState(false);
  const [link, setLink] = useState<string | null>(null);
  const [done, setDone] = useState<{ demoted: boolean; callerWasOld: boolean } | null>(null);

  async function execute() {
    if (!confirm("Confirma criar Souza Aguiar como administrador principal e rebaixar o usuário IGA?")) return;
    setLoading(true);
    try {
      const res: any = await run();
      setLink(res.recoveryLink);
      setDone({ demoted: res.oldAdminDemoted, callerWasOld: res.callerWasOldAdmin });
      toast.success("Transferência concluída");
    } catch (e: any) {
      toast.error("Falha", { description: e.message });
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="max-w-3xl space-y-6">
      <div>
        <h1 className="text-2xl font-bold flex items-center gap-2">
          <ShieldCheck className="size-6" /> Transferência de Administrador Principal
        </h1>
        <p className="text-muted-foreground">
          Cria <strong>Souza Aguiar</strong> (<code>souzaaguiar.producao@gmail.com</code>) como
          administrador e rebaixa o usuário IGA para <em>consulta · inativo</em>, preservando todo o histórico.
        </p>
      </div>

      <Alert>
        <AlertTriangle className="size-4" />
        <AlertTitle>Operação sensível</AlertTitle>
        <AlertDescription>
          Nenhuma senha é gravada em código, banco ou logs. Ao concluir, será exibido <strong>uma única vez</strong> um
          link de redefinição de senha que você deve repassar ao novo administrador por canal seguro.
        </AlertDescription>
      </Alert>

      {!done && (
        <Card>
          <CardHeader>
            <CardTitle>Executar transferência</CardTitle>
            <CardDescription>Requer perfil administrador.</CardDescription>
          </CardHeader>
          <CardContent>
            <Button onClick={execute} disabled={loading}>
              {loading ? "Executando…" : "Executar agora"}
            </Button>
          </CardContent>
        </Card>
      )}

      {done && (
        <Card>
          <CardHeader>
            <CardTitle>Concluído</CardTitle>
            <CardDescription>
              Souza Aguiar agora é administrador principal.
              {done.demoted && " O usuário IGA foi rebaixado para consulta e marcado como inativo."}
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-3">
            {link && (
              <div className="space-y-2">
                <div className="text-sm font-medium">Link de definição de senha (exibido apenas agora):</div>
                <div className="flex gap-2">
                  <input
                    readOnly value={link}
                    className="flex-1 rounded border px-2 py-1 text-xs font-mono bg-muted"
                    onFocus={(e) => e.currentTarget.select()}
                  />
                  <Button size="sm" variant="outline" onClick={() => {
                    navigator.clipboard.writeText(link); toast.success("Copiado");
                  }}>
                    <Copy className="size-4" />
                  </Button>
                </div>
                <p className="text-xs text-muted-foreground">
                  Envie por canal seguro a <strong>souzaaguiar.producao@gmail.com</strong>. O link expira conforme a
                  política do provedor de autenticação. Após uso, Souza define a própria senha.
                </p>
              </div>
            )}
            {done.callerWasOld && (
              <Alert>
                <AlertDescription>
                  Você (IGA) foi rebaixado nesta operação. Faça logout para garantir o novo estado de permissões.
                  <div className="mt-2">
                    <Button size="sm" variant="destructive" onClick={() => signOut()}>Sair agora</Button>
                  </div>
                </AlertDescription>
              </Alert>
            )}
          </CardContent>
        </Card>
      )}
    </div>
  );
}
