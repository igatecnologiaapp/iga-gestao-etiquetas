import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useEffect, useMemo, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { toast } from "sonner";
import { Tag, Eye, EyeOff, ShieldCheck, AlertTriangle, Check, X } from "lucide-react";
import {
  PASSWORD_RULES,
  isExpiredLinkError,
  translateAuthError,
  validateConfirmation,
  validatePassword,
} from "@/lib/password-validation";


export const Route = createFileRoute("/redefinir-senha")({
  head: () => ({
    meta: [
      { title: "Definir nova senha — Etiquetas" },
      { name: "description", content: "Defina sua nova senha de acesso." },
      { name: "robots", content: "noindex,nofollow" },
    ],
  }),
  component: ResetPasswordPage,
});

type Status = "checking" | "ready" | "invalid" | "saving" | "done";

function parseHashTokens(hash: string) {
  const h = hash.startsWith("#") ? hash.slice(1) : hash;
  const p = new URLSearchParams(h);
  return {
    access_token: p.get("access_token"),
    refresh_token: p.get("refresh_token"),
    type: p.get("type"), // recovery | invite | signup | magiclink
    error: p.get("error") || p.get("error_code"),
    error_description: p.get("error_description"),
  };
}

function ResetPasswordPage() {
  const navigate = useNavigate();
  const [status, setStatus] = useState<Status>("checking");
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [flowType, setFlowType] = useState<"recovery" | "invite" | "signup" | "magiclink" | "session">("session");

  const [password, setPassword] = useState("");
  const [confirm, setConfirm] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [touched, setTouched] = useState<{ password: boolean; confirm: boolean }>({
    password: false,
    confirm: false,
  });
  const [submitError, setSubmitError] = useState<string | null>(null);

  const passwordError = useMemo(() => validatePassword(password), [password]);
  const confirmError = useMemo(() => validateConfirmation(password, confirm), [password, confirm]);


  useEffect(() => {
    let unsub: { subscription: { unsubscribe: () => void } } | null = null;

    async function bootstrap() {
      // 1) Tokens vindos no hash (#access_token=...&type=recovery|invite)
      if (typeof window !== "undefined" && window.location.hash) {
        const t = parseHashTokens(window.location.hash);
        if (t.error) {
          const raw = t.error_description?.replace(/\+/g, " ") ?? t.error;
          setErrorMsg(translateAuthError(raw));
          setStatus("invalid");
          return;
        }
        if (t.access_token && t.refresh_token) {
          const { error } = await supabase.auth.setSession({
            access_token: t.access_token,
            refresh_token: t.refresh_token,
          });
          // Limpa o hash da URL sem deixar token visível
          history.replaceState(null, "", window.location.pathname);
          if (error) {
            setErrorMsg(translateAuthError(error.message));
            setStatus("invalid");
            return;
          }

          if (t.type === "recovery") setFlowType("recovery");
          else if (t.type === "invite") setFlowType("invite");
          else if (t.type === "signup") setFlowType("signup");
          else if (t.type === "magiclink") setFlowType("magiclink");
          setStatus("ready");
          return;
        }
      }

      // 2) Evento PASSWORD_RECOVERY (Supabase emite ao detectar recovery)
      const sub = supabase.auth.onAuthStateChange((event) => {
        if (event === "PASSWORD_RECOVERY") {
          setFlowType("recovery");
          setStatus("ready");
        }
      });
      unsub = sub.data;

      // 3) Já existe sessão? Permite trocar a senha do usuário logado.
      const { data } = await supabase.auth.getSession();
      if (data.session) {
        setStatus("ready");
        return;
      }

      // 4) Sem token e sem sessão.
      setErrorMsg(
        "Link inválido, expirado ou já utilizado. Solicite um novo link de redefinição.",
      );
      setStatus("invalid");
    }

    bootstrap();
    return () => {
      unsub?.subscription.unsubscribe();
    };
  }, []);

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    setTouched({ password: true, confirm: true });
    setSubmitError(null);
    if (passwordError || confirmError) {
      setSubmitError(passwordError ?? confirmError);
      return;
    }
    setStatus("saving");
    const { error } = await supabase.auth.updateUser({ password });
    if (error) {
      const message = translateAuthError(error.message);
      if (isExpiredLinkError(error.message)) {
        setErrorMsg(message);
        setStatus("invalid");
        toast.error("Link expirado", { description: message });
        return;
      }
      setStatus("ready");
      setSubmitError(message);
      toast.error("Não foi possível salvar", { description: message });
      return;
    }
    setStatus("done");
    toast.success("Senha definida com sucesso");
    // Encerra a sessão temporária e leva ao login limpo
    await supabase.auth.signOut();
    setTimeout(() => navigate({ to: "/auth" }), 600);
  }


  const heading =
    flowType === "invite"
      ? "Definir senha de acesso"
      : flowType === "recovery"
        ? "Redefinir sua senha"
        : "Definir nova senha";

  return (
    <div className="grid min-h-screen lg:grid-cols-2">
      <div className="hidden lg:flex flex-col justify-between bg-primary p-12 text-primary-foreground">
        <div className="flex items-center gap-2 text-lg font-semibold">
          <div className="size-10 rounded-md bg-primary-foreground/10 grid place-items-center" aria-label="Logotipo">
            <Tag className="size-6" />
          </div>
          <span>Etiquetas</span>
        </div>
        <div className="space-y-3">
          <h1 className="text-4xl font-bold leading-tight">Acesso seguro</h1>
          <p className="text-primary-foreground/80 max-w-md">
            Sua senha é privada. O sistema nunca a armazena em texto puro e nunca
            registra o link de redefinição.
          </p>
        </div>
        <p className="text-sm text-primary-foreground/60">© {new Date().getFullYear()} Etiquetas</p>
      </div>

      <div className="flex items-center justify-center p-6 bg-background">
        <Card className="w-full max-w-md">
          <CardHeader>
            <div className="flex items-center gap-2 mb-2 lg:hidden">
              <div className="size-9 rounded-md bg-primary text-primary-foreground grid place-items-center">
                <Tag className="size-5" />
              </div>
              <span className="font-semibold">Etiquetas</span>
            </div>
            <CardTitle className="text-2xl flex items-center gap-2">
              <ShieldCheck className="size-5 text-primary" aria-hidden /> {heading}
            </CardTitle>
            <CardDescription>
              {flowType === "invite"
                ? "Defina a senha que você usará para entrar no sistema."
                : "Escolha uma senha forte. Mínimo de 8 caracteres."}
            </CardDescription>
          </CardHeader>

          <CardContent>
            {status === "checking" && (
              <p className="text-sm text-muted-foreground">Validando link…</p>
            )}

            {status === "invalid" && (
              <div className="space-y-4">
                <Alert variant="destructive">
                  <AlertTriangle className="size-4" aria-hidden />
                  <AlertTitle>Não foi possível redefinir a senha</AlertTitle>
                  <AlertDescription>{errorMsg}</AlertDescription>
                </Alert>
                <p className="text-sm text-muted-foreground">
                  Os links de redefinição são de uso único e válidos por tempo limitado. Solicite um
                  novo link em "Esqueci minha senha" na tela de login.
                </p>
                <Button className="w-full" onClick={() => navigate({ to: "/auth" })}>
                  Solicitar novo link
                </Button>
              </div>
            )}

            {(status === "ready" || status === "saving" || status === "done") && (
              <form onSubmit={onSubmit} className="space-y-4" noValidate>
                {submitError && (
                  <Alert variant="destructive">
                    <AlertTriangle className="size-4" aria-hidden />
                    <AlertDescription>{submitError}</AlertDescription>
                  </Alert>
                )}
                <div className="space-y-2">
                  <Label htmlFor="password">Nova senha</Label>
                  <div className="relative">
                    <Input
                      id="password"
                      type={showPassword ? "text" : "password"}
                      autoComplete="new-password"
                      minLength={8}
                      required
                      value={password}
                      onChange={(e) => setPassword(e.target.value)}
                      onBlur={() => setTouched((t) => ({ ...t, password: true }))}
                      className="pr-10"
                      disabled={status !== "ready"}
                      aria-invalid={touched.password && !!passwordError}
                      aria-describedby="password-rules password-error"
                    />
                    <button
                      type="button"
                      onClick={() => setShowPassword((v) => !v)}
                      className="absolute inset-y-0 right-0 px-3 grid place-items-center text-muted-foreground hover:text-foreground"
                      aria-label={showPassword ? "Ocultar senha" : "Mostrar senha"}
                      tabIndex={-1}
                    >
                      {showPassword ? <EyeOff className="size-4" /> : <Eye className="size-4" />}
                    </button>
                  </div>
                  {touched.password && passwordError && (
                    <p id="password-error" className="text-xs text-destructive">
                      {passwordError}
                    </p>
                  )}
                  <ul id="password-rules" className="space-y-1 pt-1">
                    {PASSWORD_RULES.map((rule) => {
                      const ok = rule.test(password);
                      return (
                        <li
                          key={rule.id}
                          className={`flex items-center gap-2 text-xs ${
                            ok
                              ? "text-muted-foreground"
                              : touched.password
                                ? "text-destructive"
                                : "text-muted-foreground"
                          }`}
                        >
                          {ok ? (
                            <Check className="size-3.5 text-primary" aria-hidden />
                          ) : (
                            <X className="size-3.5" aria-hidden />
                          )}
                          <span>{rule.label}</span>
                        </li>
                      );
                    })}
                  </ul>
                </div>
                <div className="space-y-2">
                  <Label htmlFor="confirm">Confirmar nova senha</Label>
                  <Input
                    id="confirm"
                    type={showPassword ? "text" : "password"}
                    autoComplete="new-password"
                    minLength={8}
                    required
                    value={confirm}
                    onChange={(e) => setConfirm(e.target.value)}
                    onBlur={() => setTouched((t) => ({ ...t, confirm: true }))}
                    disabled={status !== "ready"}
                    aria-invalid={touched.confirm && !!confirmError}
                    aria-describedby="confirm-error"
                  />
                  {touched.confirm && confirmError && (
                    <p id="confirm-error" className="text-xs text-destructive">
                      {confirmError}
                    </p>
                  )}
                </div>
                <Button
                  type="submit"
                  className="w-full"
                  disabled={status !== "ready" || !!passwordError || !!confirmError}
                >
                  {status === "saving"
                    ? "Salvando…"
                    : status === "done"
                      ? "Redirecionando…"
                      : "Salvar nova senha"}
                </Button>
                <p className="text-xs text-muted-foreground text-center">
                  Após salvar, você será redirecionado para a tela de login.
                </p>
              </form>
            )}

          </CardContent>
        </Card>
      </div>
    </div>
  );
}
