import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { useState, useMemo } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useActiveCompany } from "@/hooks/use-active-company";
import { PageHeader } from "@/components/page-header";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { StatusBadge } from "@/components/status-badge";
import { AlertCircle } from "lucide-react";

export const Route = createFileRoute("/app/pending")({
  head: () => ({ meta: [{ title: "Pendências Regulatórias — Etiquetas" }] }),
  component: PendingPage,
});

type IssueRow = {
  product_id: string; company_id: string; name: string; status: string;
  category_id: string | null; brand_id: string | null;
  missing_nutrition: boolean; missing_ingredients: boolean; missing_allergens: boolean;
  missing_shelf_life: boolean; missing_preservation: boolean;
  nutrition_in_review: boolean; status_pending: boolean;
};

const issueLabels: Array<[keyof IssueRow, string]> = [
  ["missing_nutrition", "Sem informação nutricional"],
  ["missing_ingredients", "Sem ingredientes"],
  ["missing_allergens", "Sem alergênicos"],
  ["missing_shelf_life", "Sem validade"],
  ["missing_preservation", "Sem conservação"],
  ["nutrition_in_review", "Dados nutricionais em revisão"],
  ["status_pending", "Status pendente / revisão"],
];

function PendingPage() {
  const { companyId } = useActiveCompany();
  const [search, setSearch] = useState("");
  const [issueFilter, setIssueFilter] = useState<string>("__all__");
  const [statusFilter, setStatusFilter] = useState<string>("__all__");
  const [categoryId, setCategoryId] = useState<string>("__all__");
  const [brandId, setBrandId] = useState<string>("__all__");

  const { data: categories } = useQuery({
    queryKey: ["pending-cats", companyId], enabled: !!companyId,
    queryFn: async () => {
      const { data } = await supabase.from("categories").select("id,name").eq("company_id", companyId!).order("name");
      return data ?? [];
    },
  });
  const { data: brands } = useQuery({
    queryKey: ["pending-brands", companyId], enabled: !!companyId,
    queryFn: async () => {
      const { data } = await supabase.from("brands").select("id,name").eq("company_id", companyId!).order("name");
      return data ?? [];
    },
  });

  const { data, isLoading } = useQuery({
    queryKey: ["pending", companyId],
    enabled: !!companyId,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("product_pending_issues")
        .select("*")
        .eq("company_id", companyId!);
      if (error) throw error;
      return (data as any as IssueRow[]).filter((r) =>
        issueLabels.some(([k]) => r[k] === true),
      );
    },
  });

  const filtered = useMemo(() => {
    return (data ?? []).filter((r) => {
      if (search && !r.name.toLowerCase().includes(search.toLowerCase())) return false;
      if (statusFilter !== "__all__" && r.status !== statusFilter) return false;
      if (categoryId !== "__all__" && r.category_id !== categoryId) return false;
      if (brandId !== "__all__" && r.brand_id !== brandId) return false;
      if (issueFilter !== "__all__" && !(r as any)[issueFilter]) return false;
      return true;
    });
  }, [data, search, statusFilter, categoryId, brandId, issueFilter]);


  return (
    <>
      <PageHeader title="Pendências Regulatórias"
        description="Produtos com informações incompletas ou que requerem revisão antes da emissão de etiquetas."
        actions={<Link to="/app/products" className="text-sm text-primary hover:underline">Ir para Produtos →</Link>} />
      <Card className="p-4">
        {isLoading && <div className="py-8 text-center text-muted-foreground">Carregando…</div>}
        {!isLoading && (data?.length ?? 0) === 0 && (
          <div className="py-12 text-center text-muted-foreground flex flex-col items-center gap-2">
            <AlertCircle className="size-8 text-emerald-500" />
            Nenhuma pendência encontrada nesta empresa.
          </div>
        )}
        {!isLoading && (data?.length ?? 0) > 0 && (
          <div className="rounded-md border overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Produto</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead>Motivos</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {data!.map((row) => (
                  <TableRow key={row.product_id}>
                    <TableCell className="font-medium">{row.name}</TableCell>
                    <TableCell><StatusBadge status={row.status} /></TableCell>
                    <TableCell>
                      <div className="flex gap-1.5 flex-wrap">
                        {issueLabels.filter(([k]) => row[k]).map(([k, label]) => (
                          <Badge key={k as string} variant="outline" className="bg-rose-50 text-rose-800 border-rose-200">
                            {label}
                          </Badge>
                        ))}
                      </div>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
        )}
      </Card>
    </>
  );
}
