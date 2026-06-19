import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useActiveCompany } from "@/hooks/use-active-company";
import { PageHeader } from "@/components/page-header";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { StatusBadge } from "@/components/status-badge";
import { AlertCircle } from "lucide-react";

export const Route = createFileRoute("/app/pending")({
  head: () => ({ meta: [{ title: "Pendências Regulatórias — Etiquetas" }] }),
  component: PendingPage,
});

type IssueRow = {
  product_id: string; company_id: string; name: string; status: string;
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
