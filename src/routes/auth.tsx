import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { toast } from "sonner";
import { Tag, Eye, EyeOff } from "lucide-react";

export const Route = createFileRoute("/auth")({
  head: () => ({
    meta: [
      { title: "Entrar — Etiquetas" },
      { name: "description", content: "Acesso restrito a usuários autorizados." },
      { name: "robots", content: "noindex,nofollow" },
    ],
  }),
  component: AuthPage,
});

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

function AuthPage() {
  const navigate = useNavigate();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [emailError, setEmailError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    // Se o usuário chegou aqui por um link de recuperação/convite,
    // o Supabase coloca os tokens no hash da URL. Redirecionamos para
    // a tela de definição de senha preservando o hash com os tokens.
    if (typeof window !== "undefined" && window.location.hash) {
      const h = window.location.hash;
      if (/type=(recovery|invite|signup|magiclink)/.test(h) || /access_token=/.test(h)) {
        window.location.replace(`/redefinir-senha${h}`);
        return;
      }
    }
    supabase.auth.getSession().then(({ data }) => {
      if (data.session) navigate({ to: "/app" });
    });
  }, [navigate]);

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!EMAIL_RE.test(email.trim())) {
      setEmailError("E-mail inválido.");
      return;
    }
    setEmailError(null);
    setSubmitting(true);
    const { error } = await supabase.auth.signInWithPassword({ email: email.trim(), password });
    setSubmitting(false);
    if (error) {
      toast.error("Não foi possível entrar", { description: "Verifique seu e-mail e senha." });
      return;
    }
    toast.success("Bem-vindo");
    navigate({ to: "/app" });
  }

  return (
    <div className="grid min-h-screen lg:grid-cols-2">
      <div className="hidden lg:flex flex-col justify-between bg-primary p-12 text-primary-foreground">
        <div className="flex items-center gap-2 text-lg font-semibold">
          {/* Área reservada para logotipo da empresa */}
          <div className="size-10 rounded-md bg-primary-foreground/10 grid place-items-center" aria-label="Logotipo">
            <Tag className="size-6" />
          </div>
          <span>Etiquetas</span>
        </div>
        <div className="space-y-3">
          <h1 className="text-4xl font-bold leading-tight">
            Gestão e emissão de etiquetas
          </h1>
        </div>
        <p className="text-sm text-primary-foreground/60">
          © {new Date().getFullYear()} Etiquetas
        </p>
      </div>

      <div className="flex items-center justify-center p-6 bg-background">
        <Card className="w-full max-w-md">
          <CardHeader>
            {/* Logotipo no topo (mobile/visível em telas estreitas e como reforço de marca) */}
            <div className="flex items-center gap-2 mb-2 lg:hidden">
              <div className="size-9 rounded-md bg-primary text-primary-foreground grid place-items-center">
                <Tag className="size-5" />
              </div>
              <span className="font-semibold">Etiquetas</span>
            </div>
            <CardTitle className="text-2xl">Entrar</CardTitle>
            <CardDescription>
              Acesso restrito. Apenas administradores criam novos usuários.
            </CardDescription>
          </CardHeader>
          <CardContent>
            <form onSubmit={onSubmit} className="space-y-4" noValidate>
              <div className="space-y-2">
                <Label htmlFor="email">E-mail</Label>
                <Input
                  id="email"
                  type="email"
                  autoComplete="email"
                  required
                  value={email}
                  onChange={(e) => {
                    setEmail(e.target.value);
                    if (emailError) setEmailError(null);
                  }}
                  onBlur={() => {
                    if (email && !EMAIL_RE.test(email.trim())) setEmailError("E-mail inválido.");
                  }}
                  aria-invalid={!!emailError}
                />
                {emailError && (
                  <p className="text-xs text-destructive">{emailError}</p>
                )}
              </div>
              <div className="space-y-2">
                <Label htmlFor="password">Senha</Label>
                <div className="relative">
                  <Input
                    id="password"
                    type={showPassword ? "text" : "password"}
                    autoComplete="current-password"
                    required
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    className="pr-10"
                  />
                  <button
                    type="button"
                    onClick={() => setShowPassword((v) => !v)}
                    className="absolute inset-y-0 right-0 px-3 grid place-items-center text-muted-foreground hover:text-foreground"
                    aria-label={showPassword ? "Ocultar senha" : "Mostrar senha"}
                    aria-pressed={showPassword}
                    tabIndex={-1}
                  >
                    {showPassword ? <EyeOff className="size-4" /> : <Eye className="size-4" />}
                  </button>
                </div>
                <button
                  type="button"
                  onClick={() => setShowPassword((v) => !v)}
                  className="text-xs text-muted-foreground hover:text-foreground"
                >
                  {showPassword ? "Ocultar senha" : "Mostrar senha"}
                </button>
              </div>
              <Button type="submit" className="w-full" disabled={submitting}>
                {submitting ? "Entrando..." : "Entrar"}
              </Button>
              <p className="text-xs text-muted-foreground text-center">
                Esqueceu sua senha? Solicite ao administrador da sua empresa.
              </p>
            </form>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
