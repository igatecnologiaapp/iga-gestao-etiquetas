# Módulo Profissional de Impressão Direta — Plano Incremental

## Escopo

Implementar gerenciamento de impressoras + impressão direta via **Print Agent local**, mantendo o fluxo atual de PDF como fallback. Trabalho será dividido em **fases entregáveis e validáveis**, não em um único PR gigante.

Esta proposta é o plano técnico (FASE 1 — Diagnóstico) + roadmap das fases seguintes. **Nenhum código será alterado até sua aprovação.**

---

## FASE 1 — Diagnóstico (entregue agora, sem código)

Mapeamento da arquitetura atual relevante ao módulo:

### Impressão / PDF
- `src/lib/label-pdf.ts` — geração de PDF (jsPDF), `renderNutritionTable`, `elementValue`, snapshot.
- `src/components/label-preview.tsx` — preview visual sincronizado com PDF.
- `src/routes/app.print-labels.tsx` — tela principal de emissão (seleção produto/layout/quantidade, geração de PDF, impressão via `window.print`).
- `src/routes/app.print-history.tsx` + `app.print-history.$id.tsx` — histórico e reimpressão a partir de `label_snapshots`.
- `src/lib/label-emission.ts` — orquestração da emissão (lotes, snapshots).

### Layouts
- `src/routes/app.layouts.tsx` e `app.layouts.$id.tsx` — Central de Layouts (editor visual).
- `src/lib/nutrition-layout-rules.ts` — regras de validação (altura mínima nutricional).
- Tabelas: `label_layouts`, `label_layout_elements`, `label_layout_versions`, `label_formats`, `label_categories`, `layout_associations`, `label_snapshots`.

### Impressoras (estado atual)
- Tabela `printer_configs` já existe (25 colunas) com policies — usada hoje apenas como cadastro informativo (`src/routes/app.printers.tsx`).
- **Não há** integração com SO, drivers, fila, ou envio direto.

### Dados / Segurança
- Multi-tenant por `company_id`, RLS ativa em todas as tabelas relevantes.
- Roles via `user_company_roles` + `has_role()` / `has_any_role()`.
- Auditoria via `audit_logs` + trigger `tg_audit_row` + função `log_audit`.

### Fluxo atual de impressão
1. Usuário seleciona produto + layout + quantidade em `/app/print-labels`.
2. `buildLabelDataFromSnapshot` monta dados → `generateLabelPdf` gera PDF → `window.open` ou `iframe.print()`.
3. Snapshot persistido em `label_snapshots` para reimpressão.
4. Histórico em `print_batches` + `printed_labels` + `print_events`.

### Pontos de menor risco para encaixe
- **Print Agent Client** é um serviço novo, isolado em `src/lib/print-agent/` — não toca PDF.
- **Envio**: novo botão "Imprimir direto" em `/app/print-labels` ao lado do existente; fallback automático.
- **Cadastro de impressoras**: estender `printer_configs` (adicionar `driver_name`, `raw_language`, `agent_printer_id`) sem quebrar UI atual.

### Mudanças de banco previstas
- `printer_configs`: +colunas `driver_name`, `raw_language`, `agent_printer_id`, `offset_x`, `offset_y`, `rotation`, `speed`, `auto_cut`.
- Nova `printer_layout_compatibility` (printer_id, layout_id ou format_id).
- Nova `print_queue` (jobs em andamento; `print_batches` permanece para histórico consolidado).
- Auditoria: reusar `audit_logs` (não criar nova tabela).

### Rollback
- Cada fase em migration própria + flags de feature (`settings.print_agent_enabled` por empresa).
- Botão "Imprimir direto" oculto quando flag off → comportamento idêntico ao atual.

---

## Roadmap de Fases (entregas incrementais)

| Fase | Entrega | Risco |
|------|---------|-------|
| **2** | Migration: ampliar `printer_configs` + `printer_layout_compatibility` + `print_queue` | Baixo |
| **3** | Serviços TS: `PrinterService`, `PrintAgentClient` (com mocks), `PrintQueueService` | Baixo |
| **4** | Contrato Print Agent (HTTP local `http://127.0.0.1:17777` + token pareamento) — apenas client + interfaces, **sem instalador** | Baixo |
| **5** | UI Gerenciamento de Impressoras (estender `app.printers.tsx`): detectar via agent, testar conexão, página de teste, padrão | Médio |
| **6** | Configurações avançadas por impressora (DPI, offsets, rotação, linguagem) | Baixo |
| **7** | Botão "Imprimir direto" em `print-labels` com fallback PDF automático | Médio |
| **8** | Validação dimensional 100% (sem fit-to-page no envio ao agent) | Médio |
| **9** | Tela de Fila de impressão (`/app/print-queue`) | Baixo |
| **10** | Filtros estendidos no histórico + auditoria de ações de impressora | Baixo |
| **11** | Dashboard de impressão (`/app/print-dashboard`) | Baixo |
| **12** | Impressão em lote multi-produto/multi-layout | Médio |
| **13** | Adapters por driver (ZPL/EPL/TSPL) — interface + Zebra ZPL como primeiro driver | Médio |
| **14** | Revisão final RLS + permissões UI + testes | Baixo |
| **15** | Suite de testes Vitest cobrindo serviços + fluxo end-to-end mock | Baixo |

### Print Agent (entregável separado)
Esta proposta cobre o **lado web** (cliente + contratos + fallback). O **binário Print Agent local** (Windows/Mac/Linux) é um projeto separado, fora do escopo Lovable, mas o contrato HTTP estará especificado em `docs/PRINT_AGENT_PROTOCOL.md` para implementação posterior em Node/Electron/.NET.

---

## Contrato Print Agent (preview)

```
GET  http://127.0.0.1:17777/health           → { version, status }
GET  http://127.0.0.1:17777/printers         → [{ id, name, driver, default }]
POST http://127.0.0.1:17777/print            → { jobId }
GET  http://127.0.0.1:17777/jobs/:id         → { status, error? }
```
Header: `Authorization: Bearer <token-pareado-por-empresa>`. CORS restrito a origens da aplicação.

---

## Decisão necessária antes de implementar

Dado o tamanho (15 fases, ~3-5 migrations, ~20 arquivos novos), peço autorização **por fase**, não global.

**Confirma que eu inicie pela FASE 2 (migration de schema)** ou prefere ajustar o escopo/ordem antes?
