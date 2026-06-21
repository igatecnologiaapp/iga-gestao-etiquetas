import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/lib/auth-context";

export type AppRole = "administrador" | "supervisor" | "operador" | "consulta";

export type CompanyMembership = {
  company_id: string;
  company_name: string;
  role: AppRole;
  status: string;
};

export function useUserCompanies() {
  const { user } = useAuth();
  return useQuery({
    queryKey: ["user-companies", user?.id],
    enabled: !!user,
    queryFn: async (): Promise<CompanyMembership[]> => {
      const { data, error } = await supabase
        .from("user_company_roles")
        .select("company_id, role, companies(name, status)")
        .eq("user_id", user!.id);
      if (error) throw error;
      return (data ?? [])
        .map((r: any) => ({
          company_id: r.company_id,
          role: r.role,
          company_name: r.companies?.name ?? "—",
          status: r.companies?.status ?? "ativo",
        }))
        // Empresas inativas não aparecem em caixas de seleção operacionais.
        .filter((m) => m.status === "ativo");
    },
  });
}

export function isAdminInAny(memberships: CompanyMembership[] | undefined) {
  return !!memberships?.some((m) => m.role === "administrador");
}
