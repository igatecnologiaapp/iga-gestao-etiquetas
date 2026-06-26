# FASE 12 — Impressão em Lote

## Arquivos criados
- `src/lib/print/batch-print.ts` — orquestrador de lote (validação, agrupamento via `batch_group_id`, envio sequencial, fallback).
- `src/lib/print/batch-print.test.ts` — 12 testes (validação por item, lote válido, inválidos não enviados, agente offline, falha parcial, progresso, listagem de falhos).
- `src/routes/app.print-batch.tsx` — tela operacional `/app/print-batch`.
- `docs/PHASE12_PRINT_REPORT.md` — este relatório.

## Arquivos alterados
- `src/components/app-shell.tsx` — novo item “Impressão em Lote” no grupo **Emissão**.

## Tela / seção criada
- Rota: **`/app/print-batch`** (menu lateral → Emissão → Impressão em Lote).
- Estrutura:
  - Atalhos para Fila / Histórico / Dashboard.
  - Painel do Print Agent (status + alerta quando offline).
  - Lista de itens (montador): produto, layout, impressora, quantidade, observação.
  - Ações por item: adicionar, duplicar, remover, editar quantidade/layout/impressora.
  - Resumo do lote: total / enviados / falhas / fallback PDF / inválidos + `batch_group_id`.
  - Ações pós-execução: reimprimir falhos, gerar PDF dos falhos, ver na fila.
  - Diálogos de confirmação para **Enviar lote** e **Limpar lote**.

## Estratégia de batch/lote
- `batch_group_id` (UUID) é gerado uma vez por execução e propagado em
  `payload.batch_group_id` (e `payload.batch_item_id`) de cada job enfileirado
  via `PrintQueueService.enqueue`. Permite agrupar/filtrar jobs no histórico
  e na fila sem alterar o schema de `print_queue` (a coluna `batch_id`
  permanece reservada para `print_batches` legados).
- Envio **sequencial** ao Print Agent (sem paralelismo): evita race no
  dispositivo físico e mantém estado coerente por item.
- Cada item gera **1 job na `print_queue`** (auditável). Itens inválidos
  **não geram jobs** — bloqueio precoce antes da fila.

## Services reusados (sem duplicação)
- `runDirectPrint` / `validateDirectPrint` (FASE 7) — validação técnica completa
  por item (impressora ativa, agent_printer_id, DPI, compatibilidade,
  validação dimensional via Layout Engine FASE 8).
- `PrintQueueService.enqueue / markSent / recordFailure` (FASE 3).
- `PrintAgentClient` (FASE 4) — incluindo modo mock.
- `PrinterCompatibilityService.listByPrinter` (FASE 6).
- `buildLabelsPdf / openBlob` de `label-pdf.ts` — usado **apenas como
  fallback**, sem alterações no módulo.

## Validações por item
Antes do envio cada item é avaliado por `validateBatchItem`, que delega para
`validateDirectPrint`:
- Empresa, produto, layout, impressora selecionados.
- Impressora ativa.
- `agent_printer_id` presente.
- Compatibilidade impressora ↔ layout (quando há registros em
  `printer_layout_compatibility`).
- Quantidade 1–5000.
- Configurações técnicas (DPI, velocidade, escala, margens, rotação,
  raw_language) via `validateTechnicalConfig`.
- Integridade dimensional do layout via `validateLayoutDimensions`
  (Layout Engine).

Itens inválidos exibem motivos em lista vermelha sob o cartão e **não são
enviados**.

## Fallback PDF
- Quando `runDirectPrint` retorna `fallback: true` (Print Agent offline,
  token inválido, ENQUEUE_FAILED), o item recebe status `fallback_pdf` no
  resumo.
- Ações pós-lote permitem:
  - **PDF dos falhos**: gera um PDF por item caído usando
    `buildLabelsPdf` (mesmo motor do fluxo PDF tradicional).
  - **Reimprimir falhos**: recarrega os itens caídos como novo lote para
    reenviar (revalidação obrigatória + novo `batch_group_id`).
- Fluxo PDF de `label-pdf.ts` **não foi alterado**.

## Testes executados
`bunx vitest run` — **123/123 verdes** (9 arquivos).
- `batch-print.test.ts`: 12 testes (incluindo agente offline com 100% fallback,
  falha parcial mista, agrupamento por `batch_group_id`).
- Suítes existentes (direct-print, queue, agent, analytics, history,
  layout-engine, config-validation, nutrition) permanecem inalteradas e
  passando.

## Permissões
- Tela bloqueada para `isReadOnly` ou sem `canCreateProduct` (mesma regra de
  emissão individual).
- `PrintAgentPanel` só permite gerenciar pareamentos para `administrador`.
- RLS de `print_queue` (FASE 2) aplica `company_id` no servidor — o
  frontend não é fonte de autoridade.

## Limitações conhecidas
- Os `elements` do layout não são carregados nesta tela (lista enxuta de
  itens). A validação dimensional cobre o formato e impressora; a validação
  fina de elementos obrigatórios continua sendo feita na emissão individual.
  O PDF de fallback gerado por esta tela usa apenas o formato (sem elementos
  resolvidos) — adequado para fila contingencial, não para etiquetas
  nutricionais regulatórias finais. Para etiquetas com regras nutricionais,
  recomenda-se a emissão individual em caso de fallback regulatório.
- O lote não cria registro em `print_batches` (histórico legado segue
  intacto). O agrupamento se dá por `payload.batch_group_id` na
  `print_queue`.
- Cancelamento em massa durante o envio não foi exposto (envio é
  sequencial e rápido). Itens já enviados podem ser cancelados pela
  Fila de Impressão.
- Sem instalador nativo do Print Agent nesta fase (fora do escopo).

## Confirmação de preservação
✅ `src/lib/label-pdf.ts` **não foi alterado** — fluxo PDF intacto.
✅ Preview (`label-preview.tsx`) **não foi tocado**.
✅ Layouts (editor, regras, motor dimensional) **inalterados**.
✅ Emissão individual (`/app/print-labels`) **inalterada**.
✅ Fila (`/app/print-queue`) **inalterada** — jobs do lote aparecem
   naturalmente com `payload.batch_group_id`.
✅ Histórico (`/app/print-history`) **inalterado**.
✅ Dashboard (`/app/print-dashboard`) **inalterado**.
✅ Policies RLS antigas **inalteradas**.

Aguardando autorização para iniciar a **FASE 13 — Adapters por driver
(ZPL/EPL/TSPL)**.
