// Assistente de Configuração de Impressoras — Wizard end-to-end.
// Etapas: 1) Health do agente · 2) Detectar impressoras reais · 3) Selecionar/criar
// printer_configs com agent_printer_id automático · 4) Vincular layouts compatíveis
// · 5) Config técnica (DPI/escala/margens/offsets) · 6) Teste de impressão real
// (POST /printers/{id}/test-page) · 7) Ativar e marcar padrão.
//
// Tudo passa por RLS; auditoria é registrada via insert em audit_logs.

import { useEffect, useMemo, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Checkbox } from "@/components/ui/checkbox";
import {
  Wifi, WifiOff, Loader2, RefreshCcw, Search, Printer as PrinterIcon,
  Link2, Settings2, FlaskConical, CheckCircle2, ArrowLeft, ArrowRight, AlertTriangle,
} from "lucide-react";
import { toast } from "sonner";
import { usePrintAgent } from "@/lib/print/use-print-agent";
import { PrinterService } from "@/lib/print/printer-service";
import { PrinterCompatibilityService } from "@/lib/print/printer-compatibility-service";
import { ROTATION_VALUES } from "@/lib/print/printer-config-validation";
import type { AgentPrinter, PrinterConfig } from "@/lib/print/types";

interface Props {
  companyId: string;
  open: boolean;
  onClose: () => void;
}

type StepId = 1 | 2 | 3 | 4 | 5 | 6 | 7;
const STEPS: { id: StepId; title: string; icon: any }[] = [
  { id: 1, title: "Agente local", icon: Wifi },
  { id: 2, title: "Detectar impressoras", icon: Search },
  { id: 3, title: "Selecionar impressora", icon: PrinterIcon },
  { id: 4, title: "Layouts compatíveis", icon: Link2 },
  { id: 5, title: "Configurações técnicas", icon: Settings2 },
  { id: 6, title: "Teste de impressão", icon: FlaskConical },
  { id: 7, title: "Ativar e finalizar", icon: CheckCircle2 },
];

async function logAudit(
  companyId: string,
  reason: string,
  recordId: string | null,
  meta: Record<string, unknown>,
) {
  try {
    await supabase.from("audit_logs").insert({
      company_id: companyId,
      action: "OTHER" as any,
      table_name: "printer_configs",
      record_id: recordId,
      reason,
      new_values: meta as any,
    } as any);
  } catch {
    /* não bloqueia */
  }
}

export function PrinterSetupWizard({ companyId, open, onClose }: Props) {
  const qc = useQueryClient();
  const agent = usePrintAgent(companyId);
  const [step, setStep] = useState<StepId>(1);

  // Etapa 2 — impressoras detectadas
  const [detected, setDetected] = useState<AgentPrinter[] | null>(null);
  const [detectLoading, setDetectLoading] = useState(false);
  const [detectError, setDetectError] = useState<string | null>(null);

  // Etapa 3 — seleção
  const [selectedAgentPrinter, setSelectedAgentPrinter] = useState<AgentPrinter | null>(null);
  const [friendlyName, setFriendlyName] = useState("");
  const [savedPrinter, setSavedPrinter] = useState<PrinterConfig | null>(null);

  // Etapa 4 — layouts
  const [selectedLayouts, setSelectedLayouts] = useState<Set<string>>(new Set());

  // Etapa 5 — config técnica
  const [tech, setTech] = useState({
    dpi: 203, scale: 100, margin_top: 0, margin_left: 0,
    offset_x: 0, offset_y: 0, rotation: 0,
    auto_cut: false, label_advance: 0,
  });

  // Etapa 6 — teste
  const [testStatus, setTestStatus] = useState<"idle" | "running" | "ok" | "fail">("idle");
  const [testError, setTestError] = useState<string | null>(null);

  // Etapa 7 — ativação
  const [activateDefault, setActivateDefault] = useState(false);

  useEffect(() => {
    if (open) {
      setStep(1);
      setDetected(null);
      setDetectError(null);
      setSelectedAgentPrinter(null);
      setFriendlyName("");
      setSavedPrinter(null);
      setSelectedLayouts(new Set());
      setTestStatus("idle");
      setTestError(null);
      setActivateDefault(false);
    }
  }, [open]);

  // Layouts ativos para vinculação (etapa 4)
  const layouts = useQuery({
    queryKey: ["wizard-layouts", companyId],
    enabled: open && step >= 4,
    queryFn: async () => {
      const { data, error } = await (supabase.from("label_layouts" as any) as any)
        .select("id,name,label_type,format_id,status")
        .eq("company_id", companyId).eq("status", "ativo").order("name");
      if (error) throw error;
      return data as Array<{ id: string; name: string; label_type: string | null; format_id: string | null }>;
    },
  });

  // === Ações ===
  async function detectPrinters() {
    setDetectLoading(true); setDetectError(null);
    try {
      const list = await agent.client.listPrinters();
      setDetected(list);
      await logAudit(companyId, "wizard.detect_printers", null, { count: list.length });
      if (list.length === 0) setDetectError("Nenhuma impressora foi detectada na estação.");
    } catch (e: any) {
      setDetected([]);
      setDetectError(e?.message ?? "Falha ao consultar o agente local.");
    } finally {
      setDetectLoading(false);
    }
  }

  const savePrinter = useMutation({
    mutationFn: async () => {
      if (!selectedAgentPrinter) throw new Error("Selecione uma impressora detectada.");
      const name = friendlyName.trim() || selectedAgentPrinter.name;
      // Já existe printer_configs com mesmo agent_printer_id nesta empresa? Atualiza.
      const existing = await PrinterService.list(companyId, { includeAgentOnly: true });
      const dup = existing.find((p) => p.agent_printer_id === selectedAgentPrinter.id);
      const patch: any = {
        name,
        agent_printer_id: selectedAgentPrinter.id,
        driver_name: selectedAgentPrinter.driver ?? null,
        status: "ativo",
      };
      let saved: PrinterConfig;
      if (dup) {
        saved = await PrinterService.update(dup.id, patch);
      } else {
        saved = await PrinterService.create({
          ...patch,
          company_id: companyId,
          printer_type: "termica",
          dpi: 203, scale: 100, rotation: 0, auto_cut: false,
          offset_x: 0, offset_y: 0,
          margin_top: 0, margin_right: 0, margin_bottom: 0, margin_left: 0,
        } as any);
      }
      await logAudit(companyId, "wizard.bind_agent_printer_id", saved.id, {
        agent_printer_id: selectedAgentPrinter.id,
        driver: selectedAgentPrinter.driver ?? null,
        name,
      });
      return saved;
    },
    onSuccess: (saved) => {
      setSavedPrinter(saved);
      setTech({
        dpi: saved.dpi ?? 203, scale: saved.scale ?? 100,
        margin_top: saved.margin_top ?? 0, margin_left: saved.margin_left ?? 0,
        offset_x: saved.offset_x ?? 0, offset_y: saved.offset_y ?? 0,
        rotation: saved.rotation ?? 0, auto_cut: !!saved.auto_cut,
        label_advance: saved.label_advance ?? 0,
      });
      qc.invalidateQueries({ queryKey: ["printers"] });
      setStep(4);
    },
    onError: (e: any) => toast.error(e?.message ?? "Falha ao salvar impressora."),
  });

  const saveLayouts = useMutation({
    mutationFn: async () => {
      if (!savedPrinter) throw new Error("Impressora não definida.");
      const current = await PrinterCompatibilityService.listByPrinter(savedPrinter.id);
      const currentIds = new Set(current.map((c) => c.layout_id).filter(Boolean) as string[]);
      const toAdd = [...selectedLayouts].filter((id) => !currentIds.has(id));
      const layoutsList = layouts.data ?? [];
      for (const layoutId of toAdd) {
        const l = layoutsList.find((x) => x.id === layoutId);
        await PrinterCompatibilityService.link({
          company_id: companyId,
          printer_id: savedPrinter.id,
          layout_id: layoutId,
          format_id: l?.format_id ?? null,
        });
      }
      await logAudit(companyId, "wizard.link_layouts", savedPrinter.id, {
        added: toAdd, total_selected: selectedLayouts.size,
      });
    },
    onSuccess: () => { setStep(5); },
    onError: (e: any) => toast.error(e?.message ?? "Falha ao vincular layouts."),
  });

  const saveTech = useMutation({
    mutationFn: async () => {
      if (!savedPrinter) throw new Error("Impressora não definida.");
      const updated = await PrinterService.update(savedPrinter.id, tech as any);
      setSavedPrinter(updated);
      await logAudit(companyId, "wizard.update_tech_config", savedPrinter.id, tech);
    },
    onSuccess: () => { setStep(6); qc.invalidateQueries({ queryKey: ["printers"] }); },
    onError: (e: any) => toast.error(e?.message ?? "Falha ao salvar configurações."),
  });

  async function runTestPrint() {
    if (!savedPrinter?.agent_printer_id) return;
    setTestStatus("running"); setTestError(null);
    try {
      await agent.client.printTestPage(savedPrinter.agent_printer_id);
      setTestStatus("ok");
      await PrinterService.update(savedPrinter.id, {
        last_test_at: new Date().toISOString(),
        last_status: "ok",
      } as any).catch(() => undefined);
      await logAudit(companyId, "wizard.test_print_ok", savedPrinter.id, {
        agent_printer_id: savedPrinter.agent_printer_id,
      });
    } catch (e: any) {
      setTestStatus("fail");
      setTestError(e?.message ?? "Falha ao executar teste de impressão.");
      await logAudit(companyId, "wizard.test_print_fail", savedPrinter.id, {
        error: e?.message ?? "unknown",
      });
    }
  }

  const activate = useMutation({
    mutationFn: async () => {
      if (!savedPrinter) throw new Error("Impressora não definida.");
      await PrinterService.setStatus(savedPrinter.id, "ativo");
      if (activateDefault) await PrinterService.setDefault(savedPrinter.id, companyId);
      await logAudit(companyId, "wizard.activate_printer", savedPrinter.id, {
        is_default: activateDefault,
      });
    },
    onSuccess: () => {
      toast.success("Impressora ativada e pronta para impressão direta.");
      qc.invalidateQueries({ queryKey: ["printers"] });
      onClose();
    },
    onError: (e: any) => toast.error(e?.message ?? "Falha ao ativar impressora."),
  });

  const canAdvance = useMemo(() => {
    switch (step) {
      case 1: return !!agent.health?.ok;
      case 2: return (detected ?? []).length > 0;
      case 3: return !!savedPrinter;
      case 4: return true; // pode pular sem layouts, mas alerta
      case 5: return true;
      case 6: return testStatus === "ok";
      case 7: return true;
    }
  }, [step, agent.health, detected, savedPrinter, testStatus]);

  return (
    <Dialog open={open} onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="max-w-3xl max-h-[92vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Assistente de Configuração de Impressoras</DialogTitle>
        </DialogHeader>

        {/* Stepper */}
        <ol className="flex flex-wrap gap-2 text-xs mb-2">
          {STEPS.map((s) => {
            const Icon = s.icon;
            const active = s.id === step;
            const done = s.id < step;
            return (
              <li
                key={s.id}
                className={`flex items-center gap-1 rounded-full px-2 py-1 border ${
                  active ? "bg-primary text-primary-foreground border-primary"
                  : done ? "bg-emerald-50 text-emerald-700 border-emerald-200"
                  : "bg-muted text-muted-foreground"
                }`}
              >
                <Icon className="size-3" /> {s.id}. {s.title}
              </li>
            );
          })}
        </ol>

        <div className="space-y-4 py-2">
          {step === 1 && (
            <div className="space-y-3">
              <p className="text-sm text-muted-foreground">
                Verificando se o Print Agent local está instalado e em execução em <code>http://127.0.0.1:17777</code>.
              </p>
              <Card className="p-3 flex items-center gap-3">
                {agent.loading ? <Loader2 className="size-5 animate-spin" />
                  : agent.health?.ok ? <Wifi className="size-5 text-emerald-600" />
                  : <WifiOff className="size-5 text-amber-600" />}
                <div className="flex-1">
                  <div className="font-medium">
                    {agent.loading ? "Verificando..."
                      : agent.health?.ok ? `Agente conectado${agent.health.version ? ` · v${agent.health.version}` : ""}`
                      : "Agente não encontrado ou offline"}
                  </div>
                  {!agent.health?.ok && agent.health?.code && (
                    <div className="text-xs text-muted-foreground">Código: {agent.health.code}</div>
                  )}
                </div>
                <Button variant="outline" size="sm" onClick={() => agent.refresh()} disabled={agent.loading}>
                  <RefreshCcw className="size-4" /> Verificar
                </Button>
              </Card>
              {!agent.health?.ok && (
                <Alert>
                  <AlertTriangle className="size-4" />
                  <AlertTitle>Como resolver</AlertTitle>
                  <AlertDescription className="text-sm space-y-1">
                    <p>1. Baixe o instalador na seção <strong>Print Agent</strong> desta tela.</p>
                    <p>2. Instale como Administrador (cria o serviço Windows <code>LovablePrintAgent</code>).</p>
                    <p>3. Gere um código de pareamento e digite na estação. Depois clique em "Verificar".</p>
                    {!agent.hasToken && <p>4. Cole o token desta estação no painel do Print Agent.</p>}
                  </AlertDescription>
                </Alert>
              )}
            </div>
          )}

          {step === 2 && (
            <div className="space-y-3">
              <div className="flex items-center justify-between">
                <p className="text-sm text-muted-foreground">
                  Consulta a lista real de impressoras instaladas no computador via <code>GET /printers</code>.
                </p>
                <Button onClick={detectPrinters} disabled={detectLoading}>
                  {detectLoading ? <Loader2 className="size-4 animate-spin" /> : <Search className="size-4" />}
                  Detectar Impressoras
                </Button>
              </div>
              {detectError && (
                <Alert variant="destructive">
                  <AlertTriangle className="size-4" />
                  <AlertDescription>{detectError}</AlertDescription>
                </Alert>
              )}
              {detected && detected.length > 0 && (
                <Card className="p-2">
                  <Table>
                    <TableHeader><TableRow>
                      <TableHead>Nome</TableHead><TableHead>Driver</TableHead>
                      <TableHead>Padrão</TableHead><TableHead>Status</TableHead>
                    </TableRow></TableHeader>
                    <TableBody>
                      {detected.map((p) => (
                        <TableRow key={p.id}>
                          <TableCell className="font-medium">{p.name}</TableCell>
                          <TableCell>{p.driver ?? "—"}</TableCell>
                          <TableCell>{p.default ? <Badge>padrão</Badge> : "—"}</TableCell>
                          <TableCell>{p.status ?? "—"}</TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                </Card>
              )}
            </div>
          )}

          {step === 3 && (
            <div className="space-y-3">
              <p className="text-sm text-muted-foreground">
                Selecione a impressora física. O <code>agent_printer_id</code> será vinculado automaticamente.
              </p>
              <div>
                <Label>Impressora detectada</Label>
                <Select
                  value={selectedAgentPrinter?.id ?? ""}
                  onValueChange={(v) => {
                    const p = (detected ?? []).find((x) => x.id === v) ?? null;
                    setSelectedAgentPrinter(p);
                    if (p && !friendlyName) setFriendlyName(p.name);
                  }}
                >
                  <SelectTrigger><SelectValue placeholder="Selecione..." /></SelectTrigger>
                  <SelectContent>
                    {(detected ?? []).map((p) => (
                      <SelectItem key={p.id} value={p.id}>{p.name} {p.driver ? `(${p.driver})` : ""}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div>
                <Label>Nome amigável (para uso no sistema)</Label>
                <Input value={friendlyName} onChange={(e) => setFriendlyName(e.target.value)} placeholder="Ex.: Zebra ZD220 — Balcão 1" />
              </div>
              <Button onClick={() => savePrinter.mutate()} disabled={!selectedAgentPrinter || savePrinter.isPending}>
                {savePrinter.isPending ? <Loader2 className="size-4 animate-spin" /> : <PrinterIcon className="size-4" />}
                Salvar e vincular
              </Button>
              {savedPrinter && (
                <Alert>
                  <CheckCircle2 className="size-4" />
                  <AlertTitle>Vinculada</AlertTitle>
                  <AlertDescription className="text-xs">
                    <code>agent_printer_id</code> = {savedPrinter.agent_printer_id}
                  </AlertDescription>
                </Alert>
              )}
            </div>
          )}

          {step === 4 && (
            <div className="space-y-3">
              <p className="text-sm text-muted-foreground">
                Selecione os layouts compatíveis com esta impressora (ex.: Nutricional 10x10, 10x15, Gôndola 10x3).
              </p>
              {layouts.isLoading ? <Loader2 className="size-4 animate-spin" /> : (
                <Card className="p-2 max-h-72 overflow-y-auto">
                  <Table>
                    <TableHeader><TableRow>
                      <TableHead className="w-10"></TableHead>
                      <TableHead>Layout</TableHead><TableHead>Tipo</TableHead>
                    </TableRow></TableHeader>
                    <TableBody>
                      {(layouts.data ?? []).map((l) => (
                        <TableRow key={l.id}>
                          <TableCell>
                            <Checkbox
                              checked={selectedLayouts.has(l.id)}
                              onCheckedChange={(c) => {
                                const next = new Set(selectedLayouts);
                                if (c) next.add(l.id); else next.delete(l.id);
                                setSelectedLayouts(next);
                              }}
                            />
                          </TableCell>
                          <TableCell>{l.name}</TableCell>
                          <TableCell>{l.label_type ?? "—"}</TableCell>
                        </TableRow>
                      ))}
                      {(layouts.data ?? []).length === 0 && (
                        <TableRow><TableCell colSpan={3} className="text-center text-muted-foreground">Nenhum layout ativo.</TableCell></TableRow>
                      )}
                    </TableBody>
                  </Table>
                </Card>
              )}
              {selectedLayouts.size === 0 && (
                <Alert>
                  <AlertTriangle className="size-4" />
                  <AlertDescription className="text-xs">
                    Sem layouts vinculados, a impressão direta ficará restrita.
                  </AlertDescription>
                </Alert>
              )}
              <Button onClick={() => saveLayouts.mutate()} disabled={saveLayouts.isPending}>
                {saveLayouts.isPending ? <Loader2 className="size-4 animate-spin" /> : <Link2 className="size-4" />}
                Salvar vínculos
              </Button>
            </div>
          )}

          {step === 5 && (
            <div className="space-y-3">
              <p className="text-sm text-muted-foreground">Ajuste DPI, escala, margens e offsets físicos da impressora.</p>
              <div className="grid grid-cols-2 md:grid-cols-3 gap-3">
                <div><Label>DPI</Label><Input type="number" min={72} max={2400} value={tech.dpi}
                  onChange={(e) => setTech({ ...tech, dpi: Number(e.target.value) || 0 })} /></div>
                <div><Label>Escala (%)</Label><Input type="number" min={10} max={400} value={tech.scale}
                  onChange={(e) => setTech({ ...tech, scale: Number(e.target.value) || 100 })} /></div>
                <div><Label>Rotação (°)</Label>
                  <Select value={String(tech.rotation)} onValueChange={(v) => setTech({ ...tech, rotation: Number(v) })}>
                    <SelectTrigger><SelectValue /></SelectTrigger>
                    <SelectContent>{ROTATION_VALUES.map((r) => <SelectItem key={r} value={String(r)}>{r}°</SelectItem>)}</SelectContent>
                  </Select>
                </div>
                <div><Label>Margem sup. (mm)</Label><Input type="number" min={0} value={tech.margin_top}
                  onChange={(e) => setTech({ ...tech, margin_top: Number(e.target.value) || 0 })} /></div>
                <div><Label>Margem esq. (mm)</Label><Input type="number" min={0} value={tech.margin_left}
                  onChange={(e) => setTech({ ...tech, margin_left: Number(e.target.value) || 0 })} /></div>
                <div><Label>Avanço (mm)</Label><Input type="number" min={0} value={tech.label_advance}
                  onChange={(e) => setTech({ ...tech, label_advance: Number(e.target.value) || 0 })} /></div>
                <div><Label>Offset horizontal</Label><Input type="number" value={tech.offset_x}
                  onChange={(e) => setTech({ ...tech, offset_x: Number(e.target.value) || 0 })} /></div>
                <div><Label>Offset vertical</Label><Input type="number" value={tech.offset_y}
                  onChange={(e) => setTech({ ...tech, offset_y: Number(e.target.value) || 0 })} /></div>
                <label className="flex items-center gap-2 col-span-full">
                  <Checkbox checked={tech.auto_cut} onCheckedChange={(c) => setTech({ ...tech, auto_cut: !!c })} />
                  Corte automático
                </label>
              </div>
              <Button onClick={() => saveTech.mutate()} disabled={saveTech.isPending}>
                {saveTech.isPending ? <Loader2 className="size-4 animate-spin" /> : <Settings2 className="size-4" />}
                Salvar configurações
              </Button>
            </div>
          )}

          {step === 6 && (
            <div className="space-y-3">
              <p className="text-sm text-muted-foreground">
                Envia uma etiqueta de teste real à impressora via <code>POST /printers/{`{id}`}/test-page</code>.
              </p>
              <Card className="p-3 flex items-center gap-3">
                <FlaskConical className="size-5" />
                <div className="flex-1 text-sm">
                  Impressora: <strong>{savedPrinter?.name}</strong> · agent_id: <code>{savedPrinter?.agent_printer_id}</code>
                </div>
                <Button onClick={runTestPrint} disabled={testStatus === "running"}>
                  {testStatus === "running" ? <Loader2 className="size-4 animate-spin" /> : <FlaskConical className="size-4" />}
                  Imprimir teste
                </Button>
              </Card>
              {testStatus === "ok" && (
                <Alert>
                  <CheckCircle2 className="size-4" />
                  <AlertTitle>Teste enviado com sucesso</AlertTitle>
                  <AlertDescription className="text-xs">
                    Verifique fisicamente se a etiqueta saiu correta antes de avançar.
                  </AlertDescription>
                </Alert>
              )}
              {testStatus === "fail" && testError && (
                <Alert variant="destructive">
                  <AlertTriangle className="size-4" />
                  <AlertTitle>Falha no teste</AlertTitle>
                  <AlertDescription className="text-xs">{testError}</AlertDescription>
                </Alert>
              )}
            </div>
          )}

          {step === 7 && (
            <div className="space-y-3">
              <p className="text-sm text-muted-foreground">Confirme a ativação e, opcionalmente, defina como impressora padrão.</p>
              <Card className="p-3 space-y-1 text-sm">
                <div>Nome: <strong>{savedPrinter?.name}</strong></div>
                <div>Driver: {savedPrinter?.driver_name ?? "—"}</div>
                <div>Identificador agente: <code>{savedPrinter?.agent_printer_id}</code></div>
                <div>Layouts vinculados: {selectedLayouts.size}</div>
                <div>Teste de impressão: {testStatus === "ok" ? "OK" : "—"}</div>
              </Card>
              <label className="flex items-center gap-2 text-sm">
                <Checkbox checked={activateDefault} onCheckedChange={(c) => setActivateDefault(!!c)} />
                Definir como impressora padrão da empresa
              </label>
              <Button onClick={() => activate.mutate()} disabled={activate.isPending}>
                {activate.isPending ? <Loader2 className="size-4 animate-spin" /> : <CheckCircle2 className="size-4" />}
                Ativar impressora
              </Button>
            </div>
          )}
        </div>

        <DialogFooter className="flex items-center justify-between gap-2 sm:justify-between">
          <Button variant="ghost" onClick={() => step > 1 && setStep((step - 1) as StepId)} disabled={step === 1}>
            <ArrowLeft className="size-4" /> Voltar
          </Button>
          <div className="flex gap-2">
            <Button variant="outline" onClick={onClose}>Fechar</Button>
            {step < 7 && (
              <Button onClick={() => canAdvance && setStep((step + 1) as StepId)} disabled={!canAdvance}>
                Avançar <ArrowRight className="size-4" />
              </Button>
            )}
          </div>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
