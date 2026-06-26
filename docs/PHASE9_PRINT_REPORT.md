# FASE 9 — Fila de Impressão

Data: 2026-06-25
Status: Concluída

## 1. Resumo

Tela operacional para visualizar, reimprimir e cancelar jobs de
`print_queue`. Reusa 100% dos services das fases anteriores
(PrintQueueService, PrintAgentClient, hook do agente). Não toca em
preview, label-pdf, layouts, schema ou policies.

## 2. Arquivos criados/alterados

- **Novo** `src/routes/app.print-queue.tsx` — rota `/app/print-queue`,
  com listagem, filtros, detalhes, reimpressão e cancelamento.
- **Novo** `src/lib/print/print-queue.test.ts` — 11 testes (cancelamento,
  bloqueios, revalidação de reimpressão, agente offline).
- **Alterado** `src/components/app-shell.tsx` — adicionada entrada
  "Fila de Impressão" no grupo **Emissão**.

## 3. Services usados

- `PrintQueueService` (cancel, enqueue para reimpressão)
- `PrintAgentClient` via `usePrintAgent` (health + cancelJob)
- Validação de impressora/layout/compatibilidade via Supabase
  (`printer_configs`, `label_layouts`, `printer_layout_compatibility`)
  — espelhando regras das FASES 6/7/8.
- RLS de `print_queue` permanece como única fonte de verdade para escopo.

## 4. UI

- **Listagem** (200 jobs mais recentes): ID curto, criado em, impressora,
  layout, quantidade, origem, status (badge), ações.
- **Filtros**: status, período (de/até), origem (print_agent / pdf_fallback
  / manual), impressora, layout, produto (UUID), usuário (UUID).
- **Estados**: carregando, erro, vazio.
- **Detalhes**: dialog com ID completo, status, datas, tentativas,
  impressora, layout, batch, agent_job_id, mensagem de erro destacada,
  e payload técnico em `Collapsible`.
- **Alertas**: banner âmbar quando Print Agent estiver offline.
- **Atalhos**: voltar à emissão (`/app/print-labels`); ir para impressoras
  (`/app/printers`, só para `canWrite`).

## 5. Ações implementadas

### Reimpressão
- Confirmação via `AlertDialog`.
- Revalida: impressora ativa, layout ativo, compatibilidade impressora↔layout
  (quando há vínculos cadastrados).
- **Novo job** é criado via `PrintQueueService.enqueue` preservando o
  original; payload herdado recebe `reprint_of: <id>` e `reprint_at`.
- Status, tentativas e mensagens do job original permanecem intactos.

### Cancelamento
- Confirmação via `AlertDialog`.
- Bloqueado para `completed`, `canceled` e `failed`.
- Quando `sent`/`printing` e há `agent_job_id`, chama
  `PrintAgentClient.cancelJob`. `PrintAgentOfflineError` retorna mensagem
  amigável; `PrintAgentError` propaga o motivo do agente.
- DB atualizado para `canceled` com `error_message = "Cancelado pelo
  operador"` (registro auditável preservado).

## 6. Permissões

- RLS de `print_queue` (FASE 2): operador vê/atua nos próprios jobs;
  admin/supervisor têm escopo da empresa; global admin via
  `is_global_admin`.
- `canManage` (admin/supervisor) controla apenas o atalho para
  `/app/printers`. Demais bloqueios são server-side.

## 7. Testes executados

`bunx vitest run src/lib/print/` → **68/68 verdes** (11 novos + 57 da
FASE 8).

- `print-queue.test.ts`:
  - Cancelamento permitido para `pending|sent|printing`.
  - Bloqueio para `completed|canceled|failed`.
  - `PrintAgentClient.cancelJob` ok quando online; lança
    `PrintAgentOfflineError` quando offline.
  - Revalidação de reimpressão: impressora inativa, layout inativo,
    incompatível, job sem impressora/layout.
  - Payload de reimpressão preserva campos originais + `reprint_of`.

## 8. Restrições respeitadas

- ✅ `src/lib/label-pdf.ts` **não alterado**.
- ✅ `src/components/label-preview.tsx` **não alterado**.
- ✅ Layouts cadastrados **não alterados**.
- ✅ Schema e policies **não alterados**.
- ✅ Sem dashboard, histórico analítico, instalador, exclusões físicas.

## 9. Limitações conhecidas

- Listagem hard-cap de 200 jobs; sem paginação infinita.
- Atualização não é em tempo real (Realtime fora do escopo); usuário
  pode forçar `Atualizar`.
- Filtros por produto/usuário aceitam UUID exato (sem typeahead) —
  intencional para manter dependências mínimas nesta fase.
- "Registrar falha manual" e "limpar concluídos" não foram implementados
  por não haver regra explícita aprovada — exclusões físicas ficam fora.

## 10. Próximo

Aguardando autorização para iniciar a FASE 10.
