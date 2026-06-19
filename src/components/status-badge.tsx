import { Badge } from "@/components/ui/badge";

const map: Record<string, { label: string; cls: string }> = {
  ativo: { label: "Ativo", cls: "bg-emerald-100 text-emerald-800 border-emerald-200" },
  inativo: { label: "Inativo", cls: "bg-slate-100 text-slate-700 border-slate-200" },
  pendente: { label: "Pendente", cls: "bg-amber-100 text-amber-800 border-amber-200" },
  revisao_necessaria: { label: "Revisão necessária", cls: "bg-rose-100 text-rose-800 border-rose-200" },
  vigente: { label: "Vigente", cls: "bg-emerald-100 text-emerald-800 border-emerald-200" },
  em_revisao: { label: "Em revisão", cls: "bg-amber-100 text-amber-800 border-amber-200" },
  substituida: { label: "Substituída", cls: "bg-slate-100 text-slate-700 border-slate-200" },
  inativa: { label: "Inativa", cls: "bg-slate-100 text-slate-700 border-slate-200" },
  arquivado: { label: "Arquivado", cls: "bg-slate-200 text-slate-700 border-slate-300" },
};

export function StatusBadge({ status }: { status: string }) {
  const it = map[status] ?? { label: status, cls: "" };
  return <Badge variant="outline" className={it.cls}>{it.label}</Badge>;
}
