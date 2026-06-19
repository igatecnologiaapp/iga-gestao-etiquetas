import { createFileRoute } from "@tanstack/react-router";
import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { useUserCompanies } from "@/hooks/use-user-companies";

export const Route = createFileRoute("/app/audit")({
  head: () => ({ meta: [{ title: "Auditoria — Etiquetas" }] }),
  component: AuditPage,
});

function AuditPage() {
  const { data: companies } = useUserCompanies();
  const [companyId, setCompanyId] = useState<string>("all");
  const [table, setTable] = useState<string>("all");
  const [search, setSearch] = useState("");

  const { data, isLoading } = useQuery({
    queryKey: ["audit", companyId, table],
    queryFn: async () => {
      let q = supabase
        .from("audit_logs")
        .select("*, user_profiles(email, full_name)")
        .order("created_at", { ascending: false })
        .limit(200);
      if (companyId !== "all") q = q.eq("company_id", companyId);
      if (table !== "all") q = q.eq("table_name", table);
      const { data, error } = await q;
      if (error) throw error;
      return data;
    },
  });

  const filtered = (data ?? []).filter((r: any) => {
    if (!search) return true;
    const t = search.toLowerCase();
    return (
      r.table_name?.toLowerCase().includes(t) ||
      r.record_id?.toLowerCase?.().includes(t) ||
      r.user_profiles?.email?.toLowerCase().includes(t)
    );
  });

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold">Auditoria</h1>
        <p className="text-muted-foreground">Trilha de ações críticas. Você vê suas próprias ações e, se for Admin/Supervisor, ações da empresa.</p>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-4 gap-3">
        <div className="space-y-1.5">
          <Label>Empresa</Label>
          <Select value={companyId} onValueChange={setCompanyId}>
            <SelectTrigger><SelectValue /></SelectTrigger>
            <SelectContent>
              <SelectItem value="all">Todas</SelectItem>
              {companies?.map((c) => (
                <SelectItem key={c.company_id} value={c.company_id}>{c.company_name}</SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
        <div className="space-y-1.5">
          <Label>Tabela</Label>
          <Select value={table} onValueChange={setTable}>
            <SelectTrigger><SelectValue /></SelectTrigger>
            <SelectContent>
              <SelectItem value="all">Todas</SelectItem>
              {["companies", "branches", "user_company_roles", "user_branch_access", "system_settings"].map((t) => (
                <SelectItem key={t} value={t}>{t}</SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
        <div className="space-y-1.5 md:col-span-2">
          <Label>Buscar</Label>
          <Input placeholder="tabela, registro ou usuário…" value={search} onChange={(e) => setSearch(e.target.value)} />
        </div>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Eventos recentes</CardTitle>
          <CardDescription>Últimos 200 registros conforme filtros.</CardDescription>
        </CardHeader>
        <CardContent className="overflow-x-auto">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Data/Hora</TableHead>
                <TableHead>Usuário</TableHead>
                <TableHead>Ação</TableHead>
                <TableHead>Tabela</TableHead>
                <TableHead>Registro</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {isLoading && <TableRow><TableCell colSpan={5} className="text-muted-foreground">Carregando…</TableCell></TableRow>}
              {!isLoading && filtered.length === 0 && (
                <TableRow><TableCell colSpan={5} className="text-muted-foreground">Nenhum evento.</TableCell></TableRow>
              )}
              {filtered.map((r: any) => (
                <TableRow key={r.id}>
                  <TableCell className="font-mono text-xs whitespace-nowrap">
                    {new Date(r.created_at).toLocaleString("pt-BR")}
                  </TableCell>
                  <TableCell>
                    <div className="text-sm">{r.user_profiles?.email ?? "—"}</div>
                  </TableCell>
                  <TableCell><Badge variant={r.action === "DELETE" ? "destructive" : "secondary"}>{r.action}</Badge></TableCell>
                  <TableCell className="font-mono text-xs">{r.table_name}</TableCell>
                  <TableCell className="font-mono text-xs">{r.record_id ?? "—"}</TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </CardContent>
      </Card>
    </div>
  );
}
