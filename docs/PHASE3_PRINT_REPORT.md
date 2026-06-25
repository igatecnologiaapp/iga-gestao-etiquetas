# FASE 3 — Serviços TS de Impressão (Relatório)

## Entregas

### Arquivos criados
- `src/lib/print/types.ts` — tipos compartilhados (`PrinterConfig`, `PrintQueueJob`, `AgentHealth`, etc.).
- `src/lib/print/printer-service.ts` — `PrinterService` (CRUD `printer_configs`).
- `src/lib/print/print-agent-client.ts` — `PrintAgentClient` HTTP + `createMockPrintAgent` + `PrintAgentOfflineError`.
- `src/lib/print/print-queue-service.ts` — `PrintQueueService` (CRUD `print_queue`).
- `src/lib/print/index.ts` — barrel.
- `src/lib/print/print-agent-client.test.ts` — 6 casos cobrindo online/offline/falha/job.

### Arquivos alterados
Nenhum — fluxo PDF (`label-pdf.ts`, `print-labels.tsx`, `label-emission.ts`) e UI atual (`app.printers.tsx`) permanecem **intactos**.

## Métodos disponíveis

### PrinterService
`list`, `getById`, `getDefault`, `create`, `update`, `setStatus`, `setDefault`, `remove`.

### PrintAgentClient (contrato `http://127.0.0.1:17777`)
`health()`, `listPrinters()`, `testConnection()`, `submit(req)`, `getJob(jobId)`. Erros de rede/timeout viram `PrintAgentOfflineError` → permite fallback PDF sem try/catch genérico.

### PrintQueueService
`list`, `getById`, `enqueue`, `markSent`, `updateStatus`, `recordFailure`, `cancel`, `requeue` (reimpressão cria novo job, preserva histórico).

## Mocks
`createMockPrintAgent({ online, printers, failSubmit })` — `AgentTransport` que simula `/health`, `/printers`, `/print`, `/jobs/:id` sem rede. Usado pelos testes e disponível para a UI durante FASE 5/7 antes do binário existir.

## Segurança
- Todas as operações usam o cliente Supabase do navegador → RLS aplica policies da FASE 2 (`pc *`, `pq *`).
- `enqueue` força `user_id = auth.uid()` (exigência da policy `pq insert members`).
- Auditoria automática via trigger `print_queue_audit` (instalado na FASE 2).
- Sem uso de `service_role` neste módulo.

## Limitações pendentes (esperadas)
- **Binário Print Agent** ainda não existe — `PrintAgentClient` apenas fala o contrato.
- Tipos do Supabase (`src/integrations/supabase/types.ts`) ainda não conhecem `print_queue` / colunas novas → cast pontual `as any` (mesmo padrão de `app.printers.tsx`). Será resolvido quando os types forem regenerados.
- Sem UI nova (escopo das FASES 5, 7, 9).
- Sem retry automático / política de reenvio (escopo da FASE 7).

## Próxima fase sugerida
**FASE 4** — Formalizar o contrato do Print Agent em `docs/PRINT_AGENT_PROTOCOL.md` e adicionar pareamento por token de empresa.
