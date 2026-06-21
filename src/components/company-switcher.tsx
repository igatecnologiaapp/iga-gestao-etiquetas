import { useActiveCompany } from "@/hooks/use-active-company";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import { AlertCircle, Building2 } from "lucide-react";

export function CompanySwitcher() {
  const { companyId, memberships, setActive } = useActiveCompany();
  if (memberships.length === 0) {
    return (
      <div className="flex items-center gap-2 text-amber-600 text-sm">
        <AlertCircle className="size-4" />
        <span className="hidden sm:inline">Nenhuma empresa ativa vinculada</span>
      </div>
    );
  }
  return (
    <div className="flex items-center gap-2">
      <Building2 className="size-4 text-muted-foreground" />
      <Select value={companyId ?? undefined} onValueChange={setActive}>
        <SelectTrigger className="h-8 w-[220px]">
          <SelectValue placeholder="Selecione a empresa" />
        </SelectTrigger>
        <SelectContent>
          {memberships.map((m) => (
            <SelectItem key={m.company_id} value={m.company_id}>
              {m.company_name} <span className="text-xs text-muted-foreground ml-1">({m.role})</span>
            </SelectItem>
          ))}
        </SelectContent>
      </Select>
    </div>
  );
}
