import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useActiveCompany } from "@/hooks/use-active-company";
import { useAuth } from "@/lib/auth-context";
import { PageHeader } from "@/components/page-header";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  AlertCircle, Package, Printer, Tag as TagIcon, RotateCcw, LayoutTemplate, Activity,
  Percent, TrendingUp,
} from "lucide-react";
import {
  LineChart, Line, XAxis, YAxis, Tooltip, ResponsiveContainer, CartesianGrid,
  BarChart, Bar, Legend, PieChart, Pie, Cell,
} from "recharts";

export const Route = createFileRoute("/app/")({
  head: () => ({ meta: [{ title: "Dashboard — Etiquetas" }] }),
  component: Dashboard,
});

type Period = "7d" | "30d" | "90d" | "365d";
const periodToDays = (p: Period) => ({ "7d": 7, "30d": 30, "90d": 90, "365d": 365 }[p]);

function Dashboard() {
  const { user } = useAuth();
  const { companyId, memberships, isLoading } = useActiveCompany();
  const [period, setPeriod] = useState<Period>("30d");
  const [branchId, setBranchId] = useState<string>("__all__");
  const [labelType, setLabelType] = useState<string>("__all__");

  const fromDate = new Date(Date.now() - periodToDays(period) * 86400_000).toISOString();

  const { data: summary } = useQuery({
    queryKey: ["dash-summary", companyId, branchId],
    enabled: !!companyId,
    queryFn: async () => {
      let q = supabase.from("dashboard_label_summary").select("*").eq("company_id", companyId!);
      if (branchId !== "__all__") q = q.eq("branch_id", branchId);
      const { data, error } = await q;
      if (error) throw error;
      return (data ?? []).reduce(
        (acc, r) => ({
          total_labels: acc.total_labels + Number(r.total_labels ?? 0),
          total_nutritional: acc.total_nutritional + Number(r.total_nutritional ?? 0),
          total_gondola: acc.total_gondola + Number(r.total_gondola ?? 0),
          total_reprints: acc.total_reprints + Number(r.total_reprints ?? 0),
          total_cancelled: acc.total_cancelled + Number(r.total_cancelled ?? 0),
          total_batches: acc.total_batches + Number(r.total_batches ?? 0),
        }),
        { total_labels: 0, total_nutritional: 0, total_gondola: 0, total_reprints: 0, total_cancelled: 0, total_batches: 0 },
      );
    },
  });

  const { data: byPeriod } = useQuery({
    queryKey: ["dash-period", companyId, branchId, labelType, period],
    enabled: !!companyId,
    queryFn: async () => {
      let q = supabase.from("dashboard_prints_by_period").select("*").eq("company_id", companyId!).gte("period_day", fromDate.slice(0, 10));
      if (branchId !== "__all__") q = q.eq("branch_id", branchId);
      if (labelType !== "__all__") q = q.eq("label_type", labelType as any);
      const { data, error } = await q;
      if (error) throw error;
      const byDay = new Map<string, number>();
      (data ?? []).forEach((r: any) => {
        byDay.set(r.period_day, (byDay.get(r.period_day) ?? 0) + Number(r.total_labels));
      });
      return Array.from(byDay.entries()).sort(([a], [b]) => a.localeCompare(b)).map(([d, v]) => ({ day: d, total: v }));
    },
  });

  const { data: byTypeData } = useQuery({
    queryKey: ["dash-by-type", companyId, branchId, period],
    enabled: !!companyId,
    queryFn: async () => {
      let q = supabase.from("dashboard_prints_by_period").select("label_type,total_labels").eq("company_id", companyId!).gte("period_day", fromDate.slice(0, 10));
      if (branchId !== "__all__") q = q.eq("branch_id", branchId);
      const { data, error } = await q;
      if (error) throw error;
      const agg = new Map<string, number>();
      (data ?? []).forEach((r: any) => agg.set(r.label_type ?? "—", (agg.get(r.label_type ?? "—") ?? 0) + Number(r.total_labels)));
      return Array.from(agg.entries()).map(([name, value]) => ({ name, value }));
    },
  });

  const { data: topProducts } = useQuery({
    queryKey: ["dash-top-products", companyId, branchId],
    enabled: !!companyId,
    queryFn: async () => {
      let q = supabase.from("dashboard_top_products").select("*").eq("company_id", companyId!).order("total_labels", { ascending: false }).limit(10);
      if (branchId !== "__all__") q = q.eq("branch_id", branchId);
      const { data, error } = await q;
      if (error) throw error;
      return data ?? [];
    },
  });

  const { data: topLayouts } = useQuery({
    queryKey: ["dash-top-layouts", companyId, branchId],
    enabled: !!companyId,
    queryFn: async () => {
      let q = supabase.from("dashboard_top_layouts").select("*").eq("company_id", companyId!).order("total_labels", { ascending: false }).limit(10);
      if (branchId !== "__all__") q = q.eq("branch_id", branchId);
      const { data, error } = await q;
      if (error) throw error;
      return data ?? [];
    },
  });

  const { data: byUser } = useQuery({
    queryKey: ["dash-by-user", companyId, branchId],
    enabled: !!companyId,
    queryFn: async () => {
      let q = supabase.from("dashboard_prints_by_user").select("*").eq("company_id", companyId!).order("total_labels", { ascending: false }).limit(10);
      if (branchId !== "__all__") q = q.eq("branch_id", branchId);
      const { data, error } = await q;
      if (error) throw error;
      return data ?? [];
    },
  });

  const { data: byPrinter } = useQuery({
    queryKey: ["dash-by-printer", companyId, branchId],
    enabled: !!companyId,
    queryFn: async () => {
      let q = supabase.from("dashboard_prints_by_printer").select("*").eq("company_id", companyId!).order("total_labels", { ascending: false }).limit(10);
      if (branchId !== "__all__") q = q.eq("branch_id", branchId);
      const { data, error } = await q;
      if (error) throw error;
      return data ?? [];
    },
  });

  const { data: promotions } = useQuery({
    queryKey: ["dash-promos", companyId],
    enabled: !!companyId,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("dashboard_promotions_summary").select("*").eq("company_id", companyId!)
        .order("total_labels", { ascending: false }).limit(10);
      if (error) throw error;
      return data ?? [];
    },
  });

  const { data: pending } = useQuery({
    queryKey: ["dash-pending-count", companyId],
    enabled: !!companyId,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("product_pending_issues").select("product_id,missing_nutrition,missing_ingredients,missing_allergens,missing_shelf_life,missing_preservation,nutrition_in_review,status_pending")
        .eq("company_id", companyId!);
      if (error) throw error;
      return (data ?? []).filter((r: any) =>
        r.missing_nutrition || r.missing_ingredients || r.missing_allergens ||
        r.missing_shelf_life || r.missing_preservation || r.nutrition_in_review || r.status_pending,
      ).length;
    },
  });

  const { data: branches } = useQuery({
    queryKey: ["branches-for-dash", companyId],
    enabled: !!companyId,
    queryFn: async () => {
      const { data, error } = await supabase.from("branches").select("id,name").eq("company_id", companyId!).order("name");
      if (error) throw error;
      return data ?? [];
    },
  });

  if (!isLoading && memberships.length === 0) {
    return (
      <div className="space-y-6">
        <PageHeader title="Painel" description={`Bem-vindo, ${user?.email}.`} />
        <Card className="border-warning/40 bg-warning/5">
          <CardHeader className="flex-row items-start gap-3">
            <AlertCircle className="size-5 text-warning mt-0.5" />
            <div>
              <CardTitle className="text-base">Conta sem vínculo a empresa</CardTitle>
              <CardDescription>Sua conta existe, mas ainda não foi vinculada a nenhuma empresa.</CardDescription>
            </div>
          </CardHeader>
        </Card>
      </div>
    );
  }

  const COLORS = ["#3b82f6", "#10b981", "#f59e0b", "#ef4444", "#8b5cf6", "#06b6d4", "#ec4899", "#84cc16"];

  return (
    <div className="space-y-6">
      <PageHeader title="Dashboard"
        description="Indicadores de emissão de etiquetas, layouts, usuários e promoções."
        actions={<Link to="/app/reports" className="text-sm text-primary hover:underline">Relatórios completos →</Link>} />

      {/* Filters */}
      <Card>
        <CardContent className="p-4 grid gap-3 md:grid-cols-4">
          <div>
            <Label className="text-xs">Unidade</Label>
            <Select value={branchId} onValueChange={setBranchId}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="__all__">Todas as unidades</SelectItem>
                {branches?.map((b) => <SelectItem key={b.id} value={b.id}>{b.name.replace(/Filial/gi, "Unidade")}</SelectItem>)}
              </SelectContent>
            </Select>
          </div>
          <div>
            <Label className="text-xs">Período</Label>
            <Select value={period} onValueChange={(v) => setPeriod(v as Period)}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="7d">Últimos 7 dias</SelectItem>
                <SelectItem value="30d">Últimos 30 dias</SelectItem>
                <SelectItem value="90d">Últimos 90 dias</SelectItem>
                <SelectItem value="365d">Últimos 12 meses</SelectItem>
              </SelectContent>
            </Select>
          </div>
          <div>
            <Label className="text-xs">Tipo de etiqueta</Label>
            <Select value={labelType} onValueChange={setLabelType}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="__all__">Todos</SelectItem>
                <SelectItem value="nutricional">Nutricional</SelectItem>
                <SelectItem value="gondola">Gôndola</SelectItem>
                <SelectItem value="promocional">Promocional</SelectItem>
                <SelectItem value="atacado">Atacado</SelectItem>
                <SelectItem value="personalizada">Personalizada</SelectItem>
              </SelectContent>
            </Select>
          </div>
          <div className="flex items-end">
            <Input value={`Empresa: ${memberships.find((m) => m.company_id === companyId)?.company_name ?? "—"}`} readOnly />
          </div>
        </CardContent>
      </Card>

      {/* KPIs */}
      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
        <Kpi icon={TagIcon} label="Etiquetas emitidas" value={summary?.total_labels ?? 0} tone="blue" />
        <Kpi icon={Activity} label="Nutricionais" value={summary?.total_nutritional ?? 0} tone="emerald" />
        <Kpi icon={TagIcon} label="Gôndola" value={summary?.total_gondola ?? 0} tone="amber" />
        <Kpi icon={RotateCcw} label="Reimpressões" value={summary?.total_reprints ?? 0} tone="violet" />
        <Kpi icon={Printer} label="Lotes" value={summary?.total_batches ?? 0} tone="sky" />
        <Kpi icon={AlertCircle} label="Pendências regulatórias" value={pending ?? 0}
          tone={pending && pending > 0 ? "red" : "slate"}
          link={{ to: "/app/pending", label: "Ver" }} />
        <Kpi icon={Percent} label="Promoções ativas"
          value={(promotions ?? []).filter((p: any) => p.status === "active").length} tone="pink" />
        <Kpi icon={TrendingUp} label="Canceladas" value={summary?.total_cancelled ?? 0} tone="rose" />
      </div>

      {/* Time series */}
      <Card>
        <CardHeader><CardTitle>Etiquetas por dia</CardTitle></CardHeader>
        <CardContent style={{ height: 280 }}>
          <ResponsiveContainer width="100%" height="100%">
            <LineChart data={byPeriod ?? []}>
              <CartesianGrid strokeDasharray="3 3" />
              <XAxis dataKey="day" tick={{ fontSize: 11 }} />
              <YAxis tick={{ fontSize: 11 }} allowDecimals={false} />
              <Tooltip />
              <Line type="monotone" dataKey="total" stroke="#3b82f6" strokeWidth={2.5} dot={false} />
            </LineChart>
          </ResponsiveContainer>
        </CardContent>
      </Card>

      <div className="grid gap-4 md:grid-cols-2">
        <Card>
          <CardHeader><CardTitle>Produtos mais impressos</CardTitle></CardHeader>
          <CardContent style={{ height: 280 }}>
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={(topProducts ?? []).map((p: any) => ({ name: (p.product_name ?? "—").slice(0, 18), total: Number(p.total_labels) }))}>
                <CartesianGrid strokeDasharray="3 3" />
                <XAxis dataKey="name" tick={{ fontSize: 10 }} angle={-25} textAnchor="end" height={70} />
                <YAxis tick={{ fontSize: 11 }} allowDecimals={false} />
                <Tooltip />
                <Bar dataKey="total" fill="#3b82f6" radius={[6, 6, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </CardContent>
        </Card>
        <Card>
          <CardHeader><CardTitle>Layouts mais utilizados</CardTitle></CardHeader>
          <CardContent style={{ height: 280 }}>
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={(topLayouts ?? []).map((p: any) => ({ name: (p.layout_name ?? "—").slice(0, 18), total: Number(p.total_labels) }))}>
                <CartesianGrid strokeDasharray="3 3" />
                <XAxis dataKey="name" tick={{ fontSize: 10 }} angle={-25} textAnchor="end" height={70} />
                <YAxis tick={{ fontSize: 11 }} allowDecimals={false} />
                <Tooltip />
                <Bar dataKey="total" fill="#10b981" />
              </BarChart>
            </ResponsiveContainer>
          </CardContent>
        </Card>
      </div>

      <div className="grid gap-4 md:grid-cols-2">
        <Card>
          <CardHeader><CardTitle>Etiquetas por tipo</CardTitle></CardHeader>
          <CardContent style={{ height: 260 }}>
            <ResponsiveContainer width="100%" height="100%">
              <PieChart>
                <Pie data={byTypeData ?? []} dataKey="value" nameKey="name" outerRadius={90} label>
                  {(byTypeData ?? []).map((_, i) => <Cell key={i} fill={COLORS[i % COLORS.length]} />)}
                </Pie>
                <Legend />
                <Tooltip />
              </PieChart>
            </ResponsiveContainer>
          </CardContent>
        </Card>
        <Card>
          <CardHeader><CardTitle>Impressões por usuário</CardTitle></CardHeader>
          <CardContent>
            <div className="divide-y">
              {(byUser ?? []).map((u: any) => (
                <div key={u.user_id ?? Math.random()} className="flex items-center justify-between py-2">
                  <div>
                    <div className="text-sm font-medium">{u.full_name ?? u.email ?? "—"}</div>
                    <div className="text-xs text-muted-foreground">{u.email ?? ""}</div>
                  </div>
                  <Badge variant="secondary">{Number(u.total_labels).toLocaleString("pt-BR")}</Badge>
                </div>
              ))}
              {(byUser ?? []).length === 0 && <div className="py-6 text-sm text-muted-foreground text-center">Sem dados.</div>}
            </div>
          </CardContent>
        </Card>
      </div>

      <div className="grid gap-4 md:grid-cols-2">
        <Card>
          <CardHeader><CardTitle><Printer className="size-4 inline mr-2" />Impressões por impressora</CardTitle></CardHeader>
          <CardContent>
            <div className="divide-y">
              {(byPrinter ?? []).map((p: any) => (
                <div key={p.printer_config_id ?? Math.random()} className="flex items-center justify-between py-2">
                  <div className="text-sm">{p.printer_name ?? "—"}</div>
                  <Badge variant="secondary">{Number(p.total_labels).toLocaleString("pt-BR")}</Badge>
                </div>
              ))}
              {(byPrinter ?? []).length === 0 && <div className="py-6 text-sm text-muted-foreground text-center">Sem dados.</div>}
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardHeader>
            <CardTitle><Percent className="size-4 inline mr-2" />Promoções — etiquetas emitidas</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="divide-y">
              {(promotions ?? []).map((p: any) => (
                <div key={p.promotion_id} className="flex items-center justify-between py-2">
                  <div>
                    <div className="text-sm font-medium">{p.promotion_name}</div>
                    <div className="text-xs text-muted-foreground">
                      {p.total_products} produtos · {p.status}
                    </div>
                  </div>
                  <Badge variant="secondary">{Number(p.total_labels).toLocaleString("pt-BR")}</Badge>
                </div>
              ))}
              {(promotions ?? []).length === 0 && <div className="py-6 text-sm text-muted-foreground text-center">Sem promoções.</div>}
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}

type KpiTone = "blue" | "emerald" | "amber" | "violet" | "sky" | "red" | "pink" | "rose" | "slate";
const TONE_STYLES: Record<KpiTone, { card: string; icon: string }> = {
  blue:    { card: "border-blue-200/60 dark:border-blue-900/40",       icon: "bg-blue-500/10 text-blue-600 dark:text-blue-400" },
  emerald: { card: "border-emerald-200/60 dark:border-emerald-900/40", icon: "bg-emerald-500/10 text-emerald-600 dark:text-emerald-400" },
  amber:   { card: "border-amber-200/60 dark:border-amber-900/40",     icon: "bg-amber-500/10 text-amber-600 dark:text-amber-400" },
  violet:  { card: "border-violet-200/60 dark:border-violet-900/40",   icon: "bg-violet-500/10 text-violet-600 dark:text-violet-400" },
  sky:     { card: "border-sky-200/60 dark:border-sky-900/40",         icon: "bg-sky-500/10 text-sky-600 dark:text-sky-400" },
  red:     { card: "border-red-300/60 dark:border-red-900/40",         icon: "bg-red-500/10 text-red-600 dark:text-red-400" },
  pink:    { card: "border-pink-200/60 dark:border-pink-900/40",       icon: "bg-pink-500/10 text-pink-600 dark:text-pink-400" },
  rose:    { card: "border-rose-200/60 dark:border-rose-900/40",       icon: "bg-rose-500/10 text-rose-600 dark:text-rose-400" },
  slate:   { card: "border-border",                                    icon: "bg-muted text-muted-foreground" },
};

function Kpi({
  icon: Icon, label, value, tone = "slate", link,
}: { icon: any; label: string; value: number | string; tone?: KpiTone; link?: { to: string; label: string } }) {
  const t = TONE_STYLES[tone];
  return (
    <Card className={`transition-shadow hover:shadow-md ${t.card}`}>
      <CardContent className="p-5 flex items-start gap-4">
        <div className={`size-10 rounded-lg grid place-items-center ${t.icon}`}>
          <Icon className="size-5" />
        </div>
        <div className="flex-1 min-w-0">
          <div className="text-sm text-muted-foreground">{label}</div>
          <div className="text-2xl font-semibold leading-tight">{Number(value).toLocaleString("pt-BR")}</div>
          {link && <Link to={link.to as any} className="text-xs text-primary hover:underline">{link.label} →</Link>}
        </div>
      </CardContent>
    </Card>
  );
}
