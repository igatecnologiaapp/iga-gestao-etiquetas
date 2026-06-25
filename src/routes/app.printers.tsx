// FASE 5 — Gerenciamento de Impressoras
// - Lista, cadastra, edita, ativa/inativa e define padrão (printer_configs).
// - Integra com PrintAgentClient (fase 4) para testar conexão, imprimir página
//   de teste e listar impressoras detectadas pelo agente local.
// - Respeita permissões via useActiveCompany.canWrite (administrador/supervisor).
// - NÃO altera label-pdf.ts, print-labels.tsx, layouts nem fluxo de emissão.

import { createFileRoute } from "@tanstack/react-router";
import { useMemo, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useActiveCompany } from "@/hooks/use-active-company";
import { PageHeader } from "@/components/page-header";
import { StatusBadge } from "@/components/status-badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Card } from "@/components/ui/card";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import {
  Plus,
  Pencil,
  MoreHorizontal,
  Star,
  Power,
  PlugZap,
  Printer as PrinterIcon,
  RefreshCw,
  CheckCircle2,
  XCircle,
} from "lucide-react";
import { toast } from "sonner";
import { PrinterService } from "@/lib/print/printer-service";
import { buildPrintAgent } from "@/lib/print/agent-factory";
import {
  PrintAgentError,
  PrintAgentOfflineError,
} from "@/lib/print/print-agent-client";
import type { AgentPrinter, PrinterConfig } from "@/lib/print/types";

export const Route = createFileRoute("/app/printers")({ component: Page });

const MANUFACTURERS = [
  "Zebra", "Argox", "Elgin", "Datamax", "TSC", "Brother", "Epson", "HP", "Canon", "Outros",
];
const TYPES = [
  { v: "termica", l: "Térmica" },
  { v: "laser", l: "Laser" },
  { v: "inkjet", l: "Inkjet" },
  { v: "matricial", l: "Matricial" },
  { v: "pdf", l: "PDF" },
  { v: "grafica_externa", l: "Gráfica externa" },
  { v: "bobina_continua", l: "Bobina contínua" },
  { v: "etiqueta_adesiva", l: "Etiqueta adesiva" },
];
const RAW_LANGUAGES = ["ZPL", "EPL", "PPLB", "TSPL", "DRIVER_PADRAO"];
const CONNECTION_TYPES = ["USB", "Rede", "Bluetooth", "Serial", "Paralela", "Driver SO"];

type FormState = Partial<PrinterConfig> & { name: string };
const empty: FormState = {
  name: "",
  manufacturer: "Zebra",
  model: "",
  printer_type: "termica",
  location: "",
  max_width: 0,
  max_height: 0,
  dpi: 203,
  paper_type: "",
  ribbon_type: "",
  connection_type: "USB",
  is_default: false,
  notes: "",
  status: "ativo",
  driver_name: "",
  raw_language: "ZPL",
  agent_printer_id: "",
  speed: null,
  rotation: 0,
  auto_cut: false,
  label_advance: null,
  offset_x: 0,
  offset_y: 0,
};

async function logAgentAudit(params: {
  companyId: string;
  recordId: string | null;
  reason: string;
  payload?: Record<string, unknown>;
}) {
  try {
    await supabase.rpc("log_audit", {
      _action: "OTHER",
      _table_name: "printer_configs",
      _record_id: params.recordId,
      _company_id: params.companyId,
      _branch_id: null,
      _old: null,
      _new: params.payload ?? null,
      _reason: params.reason,
    });
  } catch {
    // auditoria não pode bloquear a UX
  }
}

function Page() {
  const qc = useQueryClient();
  const { companyId, canWrite } = useActiveCompany();

  // filtros
  const [search, setSearch] = useState("");
  const [filterManufacturer, setFilterManufacturer] = useState<string>("all");
  const [filterType, setFilterType] = useState<string>("all");
  const [filterStatus, setFilterStatus] = useState<string>("all");

  // dialog cadastro/edição
  const [open, setOpen] = useState(false);
  const [form, setForm] = useState<FormState>(empty);

  // confirmações
  const [confirm, setConfirm] = useState<
    | { kind: "deactivate" | "activate" | "default"; row: PrinterConfig }
    | null
  >(null);

  // agente
  const [useMock, setUseMock] = useState(false);
  const agent = useMemo(
    () => buildPrintAgent({ companyId, useMock }),
    [companyId, useMock],
  );

  const printersQuery = useQuery({
    queryKey: ["printers", companyId],
    enabled: !!companyId,
    queryFn: () => PrinterService.list(companyId!),
  });

  const healthQuery = useQuery({
    queryKey: ["print-agent-health", companyId, useMock],
    enabled: !!companyId,
    queryFn: () => agent.health(),
    refetchInterval: 30000,
  });

  const agentPrintersQuery = useQuery({
    queryKey: ["print-agent-printers", companyId, useMock],
    enabled: !!companyId && !!healthQuery.data?.ok,
    queryFn: () => agent.listPrinters(),
  });

  const filtered = useMemo(() => {
    const rows = printersQuery.data ?? [];
    const q = search.trim().toLowerCase();
    return rows.filter((r) => {
      if (q && !`${r.name} ${r.model ?? ""} ${r.driver_name ?? ""}`.toLowerCase().includes(q)) return false;
      if (filterManufacturer !== "all" && r.manufacturer !== filterManufacturer) return false;
      if (filterType !== "all" && r.printer_type !== filterType) return false;
      if (filterStatus !== "all" && r.status !== filterStatus) return false;
      return true;
    });
  }, [printersQuery.data, search, filterManufacturer, filterType, filterStatus]);

  const save = useMutation({
    mutationFn: async () => {
      if (!companyId) throw new Error("Empresa não selecionada");
      if (!form.name.trim()) throw new Error("Informe o nome amigável");
      const payload = {
        ...form,
        company_id: companyId,
        max_width: Number(form.max_width ?? 0),
        max_height: Number(form.max_height ?? 0),
        dpi: Number(form.dpi ?? 0),
      };
      if (form.id) {
        await PrinterService.update(form.id, payload);
      } else {
        await PrinterService.create(payload as never);
      }
    },
    onSuccess: () => {
      toast.success("Impressora salva");
      setOpen(false);
      setForm(empty);
      qc.invalidateQueries({ queryKey: ["printers"] });
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const setDefault = useMutation({
    mutationFn: async (row: PrinterConfig) => {
      await PrinterService.setDefault(row.id, row.company_id);
    },
    onSuccess: () => {
      toast.success("Impressora padrão definida");
      qc.invalidateQueries({ queryKey: ["printers"] });
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const toggleStatus = useMutation({
    mutationFn: async (row: PrinterConfig) => {
      const next = row.status === "ativo" ? "inativo" : "ativo";
      await PrinterService.setStatus(row.id, next);
    },
    onSuccess: () => {
      toast.success("Status atualizado");
      qc.invalidateQueries({ queryKey: ["printers"] });
    },
    onError: (e: Error) => toast.error(e.message),
  });

  function describeAgentError(e: unknown): string {
    if (e instanceof PrintAgentOfflineError) return "Print Agent offline. Verifique se o agente local está em execução.";
    if (e instanceof PrintAgentError) return `${e.code}: ${e.message}`;
    return (e as Error)?.message ?? "Erro desconhecido";
  }

  async function handleTestConnection(row: PrinterConfig) {
    if (!row.agent_printer_id) {
      toast.error("Esta impressora não está associada a um ID do agente.");
      return;
    }
    try {
      const ok = await agent.testPrinter(row.agent_printer_id);
      toast.success(ok.ok ? "Conexão OK" : "Agente respondeu, mas sem confirmação.");
      await logAgentAudit({
        companyId: row.company_id,
        recordId: row.id,
        reason: `Teste de conexão (${useMock ? "mock" : "real"})`,
        payload: { agent_printer_id: row.agent_printer_id, ok: ok.ok },
      });
    } catch (e) {
      toast.error(describeAgentError(e));
      await logAgentAudit({
        companyId: row.company_id,
        recordId: row.id,
        reason: `Falha no teste de conexão: ${describeAgentError(e)}`,
      });
    }
  }

  async function handleTestPage(row: PrinterConfig) {
    if (!row.agent_printer_id) {
      toast.error("Esta impressora não está associada a um ID do agente.");
      return;
    }
    try {
      const res = await agent.printTestPage(row.agent_printer_id);
      toast.success(`Página de teste enviada (job ${res.jobId}).`);
      await logAgentAudit({
        companyId: row.company_id,
        recordId: row.id,
        reason: `Página de teste (${useMock ? "mock" : "real"})`,
        payload: { jobId: res.jobId },
      });
    } catch (e) {
      toast.error(describeAgentError(e));
      await logAgentAudit({
        companyId: row.company_id,
        recordId: row.id,
        reason: `Falha na página de teste: ${describeAgentError(e)}`,
      });
    }
  }

  function confirmAndRun() {
    if (!confirm) return;
    const { kind, row } = confirm;
    if (kind === "default") setDefault.mutate(row);
    else toggleStatus.mutate(row);
    setConfirm(null);
  }

  const health = healthQuery.data;

  return (
    <>
      <PageHeader
        title="Gerenciamento de Impressoras"
        description="Cadastre e administre as impressoras da empresa. Integração opcional com o Print Agent local — o fluxo de PDF continua disponível como fallback."
        actions={
          canWrite && (
            <Dialog open={open} onOpenChange={(o) => { setOpen(o); if (!o) setForm(empty); }}>
              <DialogTrigger asChild>
                <Button><Plus className="size-4" /> Nova impressora</Button>
              </DialogTrigger>
              <PrinterFormDialog form={form} setForm={setForm} onCancel={() => setOpen(false)} onSave={() => save.mutate()} saving={save.isPending} />
            </Dialog>
          )
        }
      />

      {/* Agent status */}
      <Card className="p-4 mb-4">
        <div className="flex items-center justify-between gap-3 flex-wrap">
          <div className="flex items-center gap-2">
            <PlugZap className="size-4 text-muted-foreground" />
            <span className="font-medium">Print Agent</span>
            {healthQuery.isLoading ? (
              <span className="text-sm text-muted-foreground">verificando…</span>
            ) : health?.ok ? (
              <span className="text-sm text-emerald-700 flex items-center gap-1">
                <CheckCircle2 className="size-4" /> online {health.version && `(v${health.version})`}
              </span>
            ) : (
              <span className="text-sm text-rose-700 flex items-center gap-1">
                <XCircle className="size-4" /> {health?.code ?? "offline"}
              </span>
            )}
          </div>
          <div className="flex items-center gap-2">
            <label className="flex items-center gap-1 text-sm text-muted-foreground">
              <input type="checkbox" checked={useMock} onChange={(e) => setUseMock(e.target.checked)} />
              Usar agente simulado
            </label>
            <Button size="sm" variant="outline" onClick={() => { healthQuery.refetch(); agentPrintersQuery.refetch(); }}>
              <RefreshCw className="size-4" /> Atualizar
            </Button>
          </div>
        </div>
        {!health?.ok && !healthQuery.isLoading && (
          <Alert variant="default" className="mt-3">
            <AlertTitle>Print Agent indisponível</AlertTitle>
            <AlertDescription>
              A impressão direta está temporariamente desativada. O fluxo de geração e download de PDF continua funcionando normalmente.
            </AlertDescription>
          </Alert>
        )}
        {health?.ok && agentPrintersQuery.data && agentPrintersQuery.data.length > 0 && (
          <div className="mt-3 text-sm">
            <div className="font-medium mb-1">Impressoras detectadas pelo agente:</div>
            <ul className="grid grid-cols-1 md:grid-cols-2 gap-1">
              {agentPrintersQuery.data.map((p: AgentPrinter) => (
                <li key={p.id} className="flex items-center gap-2 text-muted-foreground">
                  <PrinterIcon className="size-3.5" />
                  <span className="font-mono text-xs">{p.id}</span>
                  <span>· {p.name}</span>
                  {p.driver && <span className="text-xs">({p.driver})</span>}
                </li>
              ))}
            </ul>
          </div>
        )}
      </Card>

      {/* Filtros */}
      <Card className="p-4 mb-4">
        <div className="grid grid-cols-1 md:grid-cols-4 gap-3">
          <div>
            <Label>Buscar</Label>
            <Input placeholder="Nome, modelo, driver…" value={search} onChange={(e) => setSearch(e.target.value)} />
          </div>
          <div>
            <Label>Fabricante</Label>
            <Select value={filterManufacturer} onValueChange={setFilterManufacturer}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Todos</SelectItem>
                {MANUFACTURERS.map((m) => <SelectItem key={m} value={m}>{m}</SelectItem>)}
              </SelectContent>
            </Select>
          </div>
          <div>
            <Label>Tipo</Label>
            <Select value={filterType} onValueChange={setFilterType}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Todos</SelectItem>
                {TYPES.map((t) => <SelectItem key={t.v} value={t.v}>{t.l}</SelectItem>)}
              </SelectContent>
            </Select>
          </div>
          <div>
            <Label>Status</Label>
            <Select value={filterStatus} onValueChange={setFilterStatus}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Todos</SelectItem>
                <SelectItem value="ativo">Ativo</SelectItem>
                <SelectItem value="inativo">Inativo</SelectItem>
                <SelectItem value="arquivado">Arquivado</SelectItem>
              </SelectContent>
            </Select>
          </div>
        </div>
      </Card>

      <Card className="p-4">
        {printersQuery.isLoading ? (
          <div className="py-12 text-center text-sm text-muted-foreground">Carregando impressoras…</div>
        ) : printersQuery.isError ? (
          <div className="py-12 text-center text-sm text-rose-700">Falha ao carregar impressoras.</div>
        ) : filtered.length === 0 ? (
          <div className="py-12 text-center text-sm text-muted-foreground">
            Nenhuma impressora encontrada. {canWrite && "Use o botão \"Nova impressora\" para cadastrar."}
          </div>
        ) : (
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Nome</TableHead>
                <TableHead>Driver</TableHead>
                <TableHead>Fabricante</TableHead>
                <TableHead>Modelo</TableHead>
                <TableHead>Tipo</TableHead>
                <TableHead>Conexão</TableHead>
                <TableHead>DPI</TableHead>
                <TableHead>Status</TableHead>
                <TableHead className="w-12" />
              </TableRow>
            </TableHeader>
            <TableBody>
              {filtered.map((r) => (
                <TableRow key={r.id}>
                  <TableCell className="font-medium">
                    {r.name}
                    {r.is_default && (
                      <span className="ml-2 inline-flex items-center gap-1 text-xs text-amber-700">
                        <Star className="size-3" /> padrão
                      </span>
                    )}
                  </TableCell>
                  <TableCell className="text-xs">{r.driver_name ?? "—"}{r.raw_language ? ` · ${r.raw_language}` : ""}</TableCell>
                  <TableCell>{r.manufacturer ?? "—"}</TableCell>
                  <TableCell>{r.model ?? "—"}</TableCell>
                  <TableCell>{TYPES.find((t) => t.v === r.printer_type)?.l ?? "—"}</TableCell>
                  <TableCell>{r.connection_type ?? "—"}</TableCell>
                  <TableCell>{r.dpi ?? "—"}</TableCell>
                  <TableCell><StatusBadge status={r.status} /></TableCell>
                  <TableCell>
                    {canWrite && (
                      <DropdownMenu>
                        <DropdownMenuTrigger asChild>
                          <Button size="icon" variant="ghost"><MoreHorizontal className="size-4" /></Button>
                        </DropdownMenuTrigger>
                        <DropdownMenuContent align="end">
                          <DropdownMenuItem onClick={() => { setForm(r as FormState); setOpen(true); }}>
                            <Pencil className="size-4" /> Editar
                          </DropdownMenuItem>
                          <DropdownMenuItem
                            disabled={r.is_default || r.status !== "ativo"}
                            onClick={() => setConfirm({ kind: "default", row: r })}
                          >
                            <Star className="size-4" /> Definir como padrão
                          </DropdownMenuItem>
                          <DropdownMenuItem
                            onClick={() => setConfirm({ kind: r.status === "ativo" ? "deactivate" : "activate", row: r })}
                          >
                            <Power className="size-4" /> {r.status === "ativo" ? "Inativar" : "Ativar"}
                          </DropdownMenuItem>
                          <DropdownMenuSeparator />
                          <DropdownMenuItem disabled={!health?.ok} onClick={() => handleTestConnection(r)}>
                            <PlugZap className="size-4" /> Testar conexão
                          </DropdownMenuItem>
                          <DropdownMenuItem disabled={!health?.ok} onClick={() => handleTestPage(r)}>
                            <PrinterIcon className="size-4" /> Imprimir página de teste
                          </DropdownMenuItem>
                        </DropdownMenuContent>
                      </DropdownMenu>
                    )}
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        )}
      </Card>

      <AlertDialog open={!!confirm} onOpenChange={(o) => !o && setConfirm(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>
              {confirm?.kind === "default" && "Definir como padrão"}
              {confirm?.kind === "deactivate" && "Inativar impressora"}
              {confirm?.kind === "activate" && "Ativar impressora"}
            </AlertDialogTitle>
            <AlertDialogDescription>
              {confirm?.kind === "default" && `Marcar "${confirm?.row.name}" como impressora padrão da empresa? A anterior deixará de ser padrão.`}
              {confirm?.kind === "deactivate" && `Inativar "${confirm?.row.name}"? Ela não estará disponível para novos trabalhos de impressão.`}
              {confirm?.kind === "activate" && `Reativar "${confirm?.row.name}"?`}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancelar</AlertDialogCancel>
            <AlertDialogAction onClick={confirmAndRun}>Confirmar</AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
}

function PrinterFormDialog(props: {
  form: FormState;
  setForm: (f: FormState) => void;
  onCancel: () => void;
  onSave: () => void;
  saving: boolean;
}) {
  const { form, setForm, onCancel, onSave, saving } = props;
  const set = <K extends keyof FormState>(k: K, v: FormState[K]) => setForm({ ...form, [k]: v });
  return (
    <DialogContent className="max-w-3xl">
      <DialogHeader>
        <DialogTitle>{form.id ? "Editar" : "Nova"} impressora</DialogTitle>
        <DialogDescription>Configurações utilizadas pelo Print Agent e pelo fallback de PDF.</DialogDescription>
      </DialogHeader>
      <div className="grid grid-cols-2 md:grid-cols-3 gap-3 max-h-[60vh] overflow-y-auto pr-1">
        <div className="col-span-2 md:col-span-3">
          <Label>Nome amigável *</Label>
          <Input value={form.name} onChange={(e) => set("name", e.target.value)} />
        </div>
        <div>
          <Label>Nome do driver</Label>
          <Input value={form.driver_name ?? ""} placeholder="Ex.: ZDesigner ZD220" onChange={(e) => set("driver_name", e.target.value)} />
        </div>
        <div>
          <Label>ID no Print Agent</Label>
          <Input value={form.agent_printer_id ?? ""} placeholder="Ex.: ZD220-001" onChange={(e) => set("agent_printer_id", e.target.value)} />
        </div>
        <div>
          <Label>Linguagem bruta</Label>
          <Select value={form.raw_language ?? "ZPL"} onValueChange={(v) => set("raw_language", v)}>
            <SelectTrigger><SelectValue /></SelectTrigger>
            <SelectContent>
              {RAW_LANGUAGES.map((l) => <SelectItem key={l} value={l}>{l}</SelectItem>)}
            </SelectContent>
          </Select>
        </div>
        <div>
          <Label>Fabricante</Label>
          <Select value={form.manufacturer ?? "Outros"} onValueChange={(v) => set("manufacturer", v)}>
            <SelectTrigger><SelectValue /></SelectTrigger>
            <SelectContent>
              {MANUFACTURERS.map((m) => <SelectItem key={m} value={m}>{m}</SelectItem>)}
            </SelectContent>
          </Select>
        </div>
        <div>
          <Label>Modelo</Label>
          <Input value={form.model ?? ""} onChange={(e) => set("model", e.target.value)} />
        </div>
        <div>
          <Label>Tipo</Label>
          <Select value={form.printer_type ?? "termica"} onValueChange={(v) => set("printer_type", v as never)}>
            <SelectTrigger><SelectValue /></SelectTrigger>
            <SelectContent>
              {TYPES.map((t) => <SelectItem key={t.v} value={t.v}>{t.l}</SelectItem>)}
            </SelectContent>
          </Select>
        </div>
        <div>
          <Label>Conexão</Label>
          <Select value={form.connection_type ?? "USB"} onValueChange={(v) => set("connection_type", v)}>
            <SelectTrigger><SelectValue /></SelectTrigger>
            <SelectContent>
              {CONNECTION_TYPES.map((c) => <SelectItem key={c} value={c}>{c}</SelectItem>)}
            </SelectContent>
          </Select>
        </div>
        <div>
          <Label>Porta / Endereço</Label>
          <Input value={form.location ?? ""} placeholder="USB001 / 192.168.1.50:9100" onChange={(e) => set("location", e.target.value)} />
        </div>
        <div>
          <Label>DPI</Label>
          <Input type="number" value={form.dpi ?? 0} onChange={(e) => set("dpi", Number(e.target.value))} />
        </div>
        <div>
          <Label>Largura máx (mm)</Label>
          <Input type="number" value={form.max_width ?? 0} onChange={(e) => set("max_width", Number(e.target.value))} />
        </div>
        <div>
          <Label>Altura máx (mm)</Label>
          <Input type="number" value={form.max_height ?? 0} onChange={(e) => set("max_height", Number(e.target.value))} />
        </div>
        <div>
          <Label>Status</Label>
          <Select value={form.status ?? "ativo"} onValueChange={(v) => set("status", v as never)}>
            <SelectTrigger><SelectValue /></SelectTrigger>
            <SelectContent>
              {["ativo", "inativo", "arquivado"].map((s) => <SelectItem key={s} value={s}>{s}</SelectItem>)}
            </SelectContent>
          </Select>
        </div>
        <div className="col-span-2 md:col-span-3">
          <Label>Observações</Label>
          <Textarea value={form.notes ?? ""} onChange={(e) => set("notes", e.target.value)} />
        </div>
        <label className="flex items-center gap-2 col-span-2 md:col-span-3">
          <input type="checkbox" checked={!!form.is_default} onChange={(e) => set("is_default", e.target.checked)} />
          Definir como impressora padrão
        </label>
      </div>
      <DialogFooter>
        <Button variant="outline" onClick={onCancel}>Cancelar</Button>
        <Button onClick={onSave} disabled={saving}>{saving ? "Salvando…" : "Salvar"}</Button>
      </DialogFooter>
    </DialogContent>
  );
}
