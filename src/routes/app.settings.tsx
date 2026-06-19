import { createFileRoute } from "@tanstack/react-router";
import { useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { toast } from "sonner";
import { useUserCompanies } from "@/hooks/use-user-companies";

export const Route = createFileRoute("/app/settings")({
  head: () => ({ meta: [{ title: "Configurações — Etiquetas" }] }),
  component: SettingsPage,
});

function SettingsPage() {
  const qc = useQueryClient();
  const { data: companies } = useUserCompanies();
  const adminCompanies = (companies ?? []).filter((c) => c.role === "administrador");
  const [companyId, setCompanyId] = useState<string>("");
  if (!companyId && adminCompanies.length) setCompanyId(adminCompanies[0].company_id);

  const [key, setKey] = useState("");
  const [value, setValue] = useState("{}");
  const [description, setDescription] = useState("");

  const { data, isLoading } = useQuery({
    queryKey: ["settings", companyId],
    enabled: !!companyId,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("system_settings").select("*").eq("company_id", companyId).order("key");
      if (error) throw error;
      return data;
    },
  });

  const upsertMut = useMutation({
    mutationFn: async () => {
      let parsed: any;
      try { parsed = JSON.parse(value); } catch { throw new Error("Valor JSON inválido"); }
      const { data: userRes } = await supabase.auth.getUser();
      const { error } = await supabase.from("system_settings").upsert({
        company_id: companyId, key, value: parsed,
        description: description || null, updated_by: userRes.user!.id,
      }, { onConflict: "company_id,key" });
      if (error) throw error;
    },
    onSuccess: () => {
      toast.success("Configuração salva");
      setKey(""); setValue("{}"); setDescription("");
      qc.invalidateQueries({ queryKey: ["settings"] });
    },
    onError: (e: any) => toast.error("Erro", { description: e.message }),
  });

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold">Configurações gerais</h1>
        <p className="text-muted-foreground">Pares chave/valor por empresa. Estrutura preparada para fases futuras (impressoras padrão, layouts padrão, etc.).</p>
      </div>

      {adminCompanies.length === 0 ? (
        <Card><CardHeader>
          <CardTitle>Acesso restrito</CardTitle>
          <CardDescription>Apenas Administradores podem editar configurações.</CardDescription>
        </CardHeader></Card>
      ) : (
        <>
          <div className="space-y-1.5 max-w-sm">
            <Label>Empresa</Label>
            <Select value={companyId} onValueChange={setCompanyId}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                {adminCompanies.map((c) => (
                  <SelectItem key={c.company_id} value={c.company_id}>{c.company_name}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <Card>
            <CardHeader><CardTitle>Nova / atualizar configuração</CardTitle></CardHeader>
            <CardContent>
              <form className="grid gap-3 md:grid-cols-3"
                onSubmit={(e) => { e.preventDefault(); upsertMut.mutate(); }}>
                <div className="space-y-1.5">
                  <Label>Chave</Label>
                  <Input required value={key} onChange={(e) => setKey(e.target.value)} placeholder="ex.: default_printer" />
                </div>
                <div className="space-y-1.5 md:col-span-2">
                  <Label>Descrição</Label>
                  <Input value={description} onChange={(e) => setDescription(e.target.value)} />
                </div>
                <div className="space-y-1.5 md:col-span-3">
                  <Label>Valor (JSON)</Label>
                  <Textarea rows={4} value={value} onChange={(e) => setValue(e.target.value)} className="font-mono text-sm" />
                </div>
                <div className="md:col-span-3">
                  <Button type="submit" disabled={!key || upsertMut.isPending}>
                    {upsertMut.isPending ? "Salvando…" : "Salvar"}
                  </Button>
                </div>
              </form>
            </CardContent>
          </Card>

          <Card>
            <CardHeader><CardTitle>Configurações da empresa</CardTitle></CardHeader>
            <CardContent>
              <Table>
                <TableHeader><TableRow>
                  <TableHead>Chave</TableHead><TableHead>Valor</TableHead><TableHead>Descrição</TableHead><TableHead>Atualizado em</TableHead>
                </TableRow></TableHeader>
                <TableBody>
                  {isLoading && <TableRow><TableCell colSpan={4} className="text-muted-foreground">Carregando…</TableCell></TableRow>}
                  {!isLoading && data?.length === 0 && (
                    <TableRow><TableCell colSpan={4} className="text-muted-foreground">Sem configurações.</TableCell></TableRow>
                  )}
                  {data?.map((r: any) => (
                    <TableRow key={r.id}>
                      <TableCell className="font-mono text-xs">{r.key}</TableCell>
                      <TableCell className="font-mono text-xs max-w-xs truncate">{JSON.stringify(r.value)}</TableCell>
                      <TableCell className="text-sm">{r.description ?? "—"}</TableCell>
                      <TableCell className="text-xs text-muted-foreground">{new Date(r.updated_at).toLocaleString("pt-BR")}</TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </CardContent>
          </Card>
        </>
      )}
    </div>
  );
}
