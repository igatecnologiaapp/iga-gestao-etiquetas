import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { toast } from "sonner";
import { Eye, EyeOff, Mail, Lock, ShieldCheck, Gauge, BarChart3 } from "lucide-react";
import logoAsset from "@/assets/logo-souza-aguiar.png.asset.json";

export const Route = createFileRoute("/auth")({
  head: () => ({
    meta: [
      { title: "Entrar — Casa de Carnes Souza Aguiar" },
      {
        name: "description",
        content:
          "Sistema de Emissão de Etiquetas — acesso restrito a usuários autorizados da Casa de Carnes Souza Aguiar.",
      },
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
  const [mode, setMode] = useState<"login" | "forgot">("login");
  const [resetSent, setResetSent] = useState(false);

  async function onRequestReset(e: React.FormEvent) {
    e.preventDefault();
    if (!EMAIL_RE.test(email.trim())) {
      setEmailError("E-mail inválido.");
      return;
    }
    setEmailError(null);
    setSubmitting(true);
    const { error } = await supabase.auth.resetPasswordForEmail(email.trim(), {
      redirectTo: `${window.location.origin}/redefinir-senha`,
    });
    setSubmitting(false);
    if (error) {
      toast.error("Não foi possível enviar o e-mail", {
        description: "Tente novamente em alguns instantes.",
      });
      return;
    }
    setResetSent(true);
    toast.success("E-mail enviado", {
      description: "Verifique sua caixa de entrada e o spam.",
    });
  }


  useEffect(() => {
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
    const { error } = await supabase.auth.signInWithPassword({
      email: email.trim(),
      password,
    });
    setSubmitting(false);
    if (error) {
      toast.error("Não foi possível entrar", {
        description: "Verifique seu e-mail e senha.",
      });
      return;
    }
    toast.success("Bem-vindo");
    navigate({ to: "/app" });
  }

  const year = new Date().getFullYear();

  return (
    <div className="min-h-screen w-full bg-white lg:grid lg:grid-cols-[1.05fr_1fr]">
      {/* Painel institucional */}
      <aside className="relative hidden lg:flex flex-col overflow-hidden text-white bg-[#5e0d12]">
        <div className="relative z-10 flex h-full flex-col gap-8 overflow-y-auto p-10 xl:p-14">
          {/* Logotipo */}
          <div className="flex shrink-0 justify-center">
            <div className="rounded-2xl bg-white p-4 shadow-lg">
              <img
                src={logoAsset.url}
                alt="Casa de Carnes Souza Aguiar"
                className="h-24 xl:h-32 w-auto object-contain"
                loading="eager"
              />
            </div>
          </div>

          <div className="flex-1 min-h-0 flex flex-col justify-center max-w-md space-y-4 xl:space-y-5">
            <h1 className="text-2xl xl:text-4xl font-extrabold leading-[1.15] tracking-tight">
              Qualidade que você confia,{" "}
              <span className="text-red-300">sabor que você merece!</span>
            </h1>
            <div className="h-1 w-16 rounded-full bg-red-400/80" />
            <div>
              <p className="text-lg xl:text-xl font-semibold text-white">
                Sistema de Emissão de Etiquetas
              </p>
              <p className="mt-2 text-sm xl:text-base text-white/80">
                Mais controle, segurança e eficiência para o seu negócio.
              </p>
            </div>
          </div>

          <div className="shrink-0 grid grid-cols-3 gap-5 border-t border-white/15 pt-5 text-sm">
            <Feature
              icon={<ShieldCheck className="size-5" />}
              title="Segurança"
              desc="Dados protegidos com criptografia"
            />
            <Feature
              icon={<Gauge className="size-5" />}
              title="Eficiência"
              desc="Processos rápidos e organizados"
            />
            <Feature
              icon={<BarChart3 className="size-5" />}
              title="Gestão"
              desc="Informações para decisões melhores"
            />
          </div>
        </div>
      </aside>

      {/* Painel de login */}
      <main className="flex min-h-screen items-center justify-center px-5 py-10 sm:px-8 lg:px-12">
        <div className="w-full max-w-md">
          {/* Marca compacta em telas menores */}
          <div className="mb-8 flex items-center gap-3 lg:hidden">
            <div className="grid size-11 shrink-0 place-items-center rounded-xl bg-[#7a1117] text-white shadow-sm">
              <span className="text-base font-black tracking-tight">SA</span>
            </div>
            <div className="min-w-0">
              <p className="text-[10px] font-semibold uppercase tracking-[0.25em] text-neutral-500">
                Casa de Carnes
              </p>
              <p className="truncate text-lg font-bold text-neutral-900">
                Souza Aguiar
              </p>
            </div>
          </div>

          <div className="space-y-1.5">
            <h2 className="text-3xl font-bold tracking-tight text-neutral-900">
              {mode === "forgot" ? "Esqueci minha senha" : "Bem-vindo!"}
            </h2>
            <p className="text-sm text-neutral-500">
              {mode === "forgot"
                ? "Informe seu e-mail para receber o link de redefinição"
                : "Acesse sua conta para continuar"}
            </p>
          </div>

          <form
            onSubmit={mode === "forgot" ? onRequestReset : onSubmit}
            className="mt-8 space-y-5"
            noValidate
          >

            <div className="space-y-2">
              <Label htmlFor="email" className="text-neutral-700">
                E-mail
              </Label>
              <div className="relative">
                <Mail className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-neutral-400" />
                <Input
                  id="email"
                  type="email"
                  autoComplete="email"
                  required
                  placeholder="seu@email.com"
                  value={email}
                  onChange={(e) => {
                    setEmail(e.target.value);
                    if (emailError) setEmailError(null);
                  }}
                  onBlur={() => {
                    if (email && !EMAIL_RE.test(email.trim()))
                      setEmailError("E-mail inválido.");
                  }}
                  aria-invalid={!!emailError}
                  className="h-11 rounded-lg border-neutral-200 pl-10 focus-visible:ring-[#7a1117]/30"
                />
              </div>
              {emailError && (
                <p className="text-xs text-destructive">{emailError}</p>
              )}
            </div>

            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <Label htmlFor="password" className="text-neutral-700">
                  Senha
                </Label>
                <span className="text-xs text-neutral-400">
                  Solicite ao administrador
                </span>
              </div>
              <div className="relative">
                <Lock className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-neutral-400" />
                <Input
                  id="password"
                  type={showPassword ? "text" : "password"}
                  autoComplete="current-password"
                  required
                  placeholder="••••••••"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  className="h-11 rounded-lg border-neutral-200 pl-10 pr-10 focus-visible:ring-[#7a1117]/30"
                />
                <button
                  type="button"
                  onClick={() => setShowPassword((v) => !v)}
                  className="absolute inset-y-0 right-0 grid w-10 place-items-center text-neutral-400 hover:text-neutral-700"
                  aria-label={showPassword ? "Ocultar senha" : "Mostrar senha"}
                  aria-pressed={showPassword}
                  tabIndex={-1}
                >
                  {showPassword ? (
                    <EyeOff className="size-4" />
                  ) : (
                    <Eye className="size-4" />
                  )}
                </button>
              </div>
            </div>

            <Button
              type="submit"
              disabled={submitting}
              className="h-11 w-full rounded-lg bg-[#7a1117] text-base font-semibold text-white shadow-sm transition hover:bg-[#5e0d12] focus-visible:ring-[#7a1117]/40"
            >
              <Lock className="mr-2 size-4" />
              {submitting ? "Entrando..." : "Entrar"}
            </Button>
          </form>

          {/* Bloco de acesso seguro */}
          <div className="mt-8 flex items-start gap-3 rounded-xl border border-red-100 bg-red-50/60 p-4">
            <div className="grid size-9 shrink-0 place-items-center rounded-lg bg-white text-[#7a1117] shadow-sm">
              <ShieldCheck className="size-5" />
            </div>
            <div className="min-w-0">
              <p className="text-sm font-semibold text-neutral-900">
                Acesso seguro
              </p>
              <p className="text-xs text-neutral-600">
                O sistema garante a proteção dos seus dados e informações.
              </p>
            </div>
          </div>

          <p className="mt-6 text-center text-xs text-neutral-500">
            Esqueceu sua senha? Solicite ao administrador da sua empresa.
          </p>

          <p className="mt-8 text-center text-[11px] text-neutral-400">
            © {year} Casa de Carnes Souza Aguiar — Todos os direitos reservados.
          </p>
        </div>
      </main>
    </div>
  );
}

function Feature({
  icon,
  title,
  desc,
}: {
  icon: React.ReactNode;
  title: string;
  desc: string;
}) {
  return (
    <div className="space-y-1.5">
      <div className="grid size-9 place-items-center rounded-lg bg-white/10 text-red-200 ring-1 ring-white/15">
        {icon}
      </div>
      <p className="text-sm font-semibold text-white">{title}</p>
      <p className="text-xs leading-snug text-white/70">{desc}</p>
    </div>
  );
}
