import { useEffect, useState, useCallback } from "react";
import { useUserCompanies, type AppRole, type CompanyMembership } from "./use-user-companies";

const KEY = "active_company_id";

export function useActiveCompany() {
  const { data: memberships, isLoading } = useUserCompanies();
  const [companyId, setCompanyId] = useState<string | null>(
    typeof window !== "undefined" ? localStorage.getItem(KEY) : null,
  );

  useEffect(() => {
    if (!memberships?.length) return;
    if (!companyId || !memberships.some((m) => m.company_id === companyId)) {
      const next = memberships[0].company_id;
      setCompanyId(next);
      localStorage.setItem(KEY, next);
    }
  }, [memberships, companyId]);

  const setActive = useCallback((id: string) => {
    setCompanyId(id);
    localStorage.setItem(KEY, id);
  }, []);

  const current: CompanyMembership | undefined = memberships?.find(
    (m) => m.company_id === companyId,
  );

  return {
    companyId,
    role: current?.role as AppRole | undefined,
    memberships: memberships ?? [],
    isLoading,
    setActive,
    canWrite: current?.role === "administrador" || current?.role === "supervisor",
    canDelete: current?.role === "administrador",
    canCreateProduct:
      current?.role === "administrador" ||
      current?.role === "supervisor" ||
      current?.role === "operador",
    isReadOnly: current?.role === "consulta",
  };
}
