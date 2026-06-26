# FASE 10 — Histórico e Auditoria de Impressão

## Arquivos criados
- `src/lib/print/print-history-service.ts` — service de leitura sobre `print_queue` com joins (printer/layout/product) e resolução em lote de `user_profiles`. Expõe `list`, `getById`, `listUsersWithJobs`, helpers `normalizeStatus` / `normalizeSource` / `computeDurationMs` / `reprintOf` / `isReprint` / `formatDuration` e `toCsvRows`.
- `src/lib/print/print-history-service.test.ts` — 12 testes (status/origem/duração/reimpressão/CSV).
- `docs/PHASE10_PRINT_REPORT.md` — este relatório.

## Arquivos alterados
- `src/routes/app.print-history.tsx` — reorganizado em duas abas (`Tabs`):
  - **Jobs (Print Agent / PDF)** — novo, baseado em `print_queue` via `PrintHistoryService`.
  - **Lotes emitidos** — comportamento legado preservado integralmente (mesmas queries, mesmo PDF, mesmo link de detalhes).
  - PageHeader passa a expor atalhos para `/app/print-queue` (Fila) e `/app/print-labels` (Emissão).

## Tela / Seção
Tela única **/app/print-history** com duas abas — sem duplicar a Fila (`/app/print-queue`, FASE 9), que segue dedicada à visão operacional ativa.

## Services
- `PrintHistoryService.list({...})` — única fonte de listagem do histórico. Aplica todos os filtros (período, status, origem, impressora, layout, produto, usuário, apenas reimpressões/falhas/cancelamentos). RLS já segrega por `company_id` e por `user_id` para operadores.
- `PrintHistoryService.getById(id)` — detalhe enriquecido.
- `PrintHistoryService.listUsersWithJobs(companyId)` — popula filtro de usuário a partir dos `user_profiles` referenciados.
- `PrintHistoryService.toCsvRows(rows)` — estrutura tabular reutilizável para exportação (CSV implementado, XLSX preparado para fase futura).
- Helpers de normalização compartilhados (`normalizeStatus`, `normalizeSource`, `formatDuration`).

## Eventos auditados (já cobertos pela infraestrutura existente)
A FASE 10 confirma e usa a auditoria já em vigor — não foi necessário criar novas triggers:

| Evento | Mecanismo |
|---|---|
| Impressão direta iniciada / enviada / concluída / falha / cancelada | `trigger print_queue_audit` (INSERT/UPDATE/DELETE → `audit_logs`) + colunas dedicadas (`started_at`, `finished_at`, `error_message`, `attempts`) |
| Uso de fallback PDF | `print_queue.source = 'pdf_fallback'` + `print_events.event_type='pdf_generated'`/`'pdf_downloaded'` |
| Reimpressão (queue) | Novo registro em `print_queue` com `payload.reprint_of = <job_original_id>` (gerado em FASE 9) |
| Reimpressão (lote legado) | `print_events.event_type='reprinted'` + `printed_labels.reprint_of` |
| Alteração de impressora (config técnica) | `trigger printer_configs_audit` em `printer_configs` |
| Alteração de compatibilidade layout/impressora | `trigger plc_audit` em `printer_layout_compatibility` |
| Alteração / revogação de token Print Agent | `trigger tg_print_agent_pairings_audit` em `print_agent_pairings` |

Todos os eventos acima caem em `public.audit_logs` (insert via `tg_audit_row`), com `user_id = auth.uid()`, `company_id`, payload `old_values`/`new_values`. Nenhum dado auditável é removido por esta fase.

## Filtros implementados (aba Jobs)
- Período (de/até)
- Status (`pending`, `sent`, `printing`, `completed`, `failed`, `canceled`)
- Origem (`print_agent`, `pdf_fallback`, `manual`)
- Impressora (seletor com nomes da empresa ativa)
- Layout (seletor com nomes da empresa ativa)
- Produto (UUID)
- Usuário (seletor populado a partir de `user_profiles`)
- Apenas reimpressões (`payload->reprint_of NOT NULL`)
- Apenas falhas (`status='failed'`)
- Apenas cancelamentos (`status='canceled'`)

## Permissões
Reutiliza as policies da FASE 2/9:
- `pq select members` — operador vê apenas jobs próprios (`user_id = auth.uid()`); supervisor/administrador vê todos via `has_any_role`.
- Filtros aplicados client-side **nunca** ampliam visibilidade — toda restrição é server-side via RLS.
- `printer_configs`, `label_layouts`, `products`, `user_profiles` usam policies já existentes.

## UX entregue
- Estados: carregando / vazio (ícone + mensagem) / erro (com mensagem).
- Badges de status (variantes coloridas), badges de origem, badge "Reimpressão" com ícone.
- Linhas com fundo destacado para `failed` e `canceled`.
- Detalhes do job em diálogo (ID, datas, duração, tentativas, agent_job_id, lote, reimpressão, payload técnico recolhível, mensagem de erro destacada).
- Atalho para Fila de Impressão e Emissão de Etiquetas no header.
- Indicadores agregados (Total / Falhas / Cancelamentos / Reimpressões / Fallback PDF).
- Exportação CSV (BOM UTF-8, separador `;`, escape de aspas) — preparada para futura XLSX.

## Testes executados
`bunx vitest run` → **100/100 verdes** (7 arquivos), incluindo:
- `print-history-service.test.ts` (12 testes novos):
  - `normalizeStatus` / `normalizeSource` (status pt-BR, origem pt-BR, fallback `—`)
  - `computeDurationMs` (positivo, sem `finished_at`, fallback para `created_at`, negativo → null)
  - `reprintOf` / `isReprint` (com e sem metadado, ignora valor não-string)
  - `formatDuration` (ms / s / min)
  - `toCsvRows` (header + linhas, escapes de null)
- Suites pré-existentes inalteradas: `print-queue` (11), `direct-print` (9), `print-agent-client` (14), `printer-config-validation` (7), `layout-engine` (27), `label-nutrition` (20).

Filtros e RLS validados via consultas dirigidas pelo próprio service — a UI consome exclusivamente `PrintHistoryService`, sem duplicar lógica.

## Limitações conhecidas
- Exportação **CSV apenas** (sem XLSX). Estrutura `toCsvRows` já normaliza colunas para evoluir sem refactor.
- Detalhamento profundo por evento (ex.: histórico de transições de status) usa `audit_logs` via SQL — interface dedicada a esses logs ficará para uma fase futura de auditoria avançada (FASE 11+).
- Filtro de usuário lista apenas usuários que **possuem jobs** na empresa (evita expor `user_profiles` em massa).
- Reimpressões registradas via fluxo legado (`print_batches` / `print_events.reprinted`) aparecem na aba **Lotes**; reimpressões do Print Agent (FASE 9, `payload.reprint_of`) aparecem na aba **Jobs**. Não foram unificadas para preservar contratos e evitar reescrita do fluxo legado.
- Tempo de impressão refere-se ao intervalo `started_at → finished_at` retornado pelo orquestrador; latências internas do agente não são quebradas em sub-eventos.

## Preservação confirmada
- ✅ `src/lib/label-pdf.ts` **não foi alterado**.
- ✅ Preview (`src/components/label-preview.tsx`) **não foi alterado**.
- ✅ Layouts cadastrados (`label_layouts`, `label_layout_elements`) **não foram alterados**.
- ✅ Emissão (`src/routes/app.print-labels.tsx`) **não foi alterada**.
- ✅ Fila (`src/routes/app.print-queue.tsx`) **não foi alterada** — mantém visão operacional.
- ✅ Aba Lotes preserva queries, ações (download PDF / detalhes) e link para `/app/print-history/$id` originais.
- ✅ Nenhuma policy nova; nenhuma migration nova; nenhum trigger novo.
- ✅ Nenhum dado auditável foi removido.

---
**FASE 10 concluída.** Aguardando autorização para iniciar a FASE 11.
