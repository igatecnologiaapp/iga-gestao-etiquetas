# FASE 4 — Contrato do Print Agent — Relatório Técnico

## Objetivo
Definir e implementar a base contratual segura entre o sistema web e o
Print Agent local, **sem alterar o fluxo PDF atual** e sem exigir ainda
um instalador nativo.

## Arquivos criados / alterados

### Novos
- `docs/PRINT_AGENT_PROTOCOL.md` — Especificação completa do protocolo v1
  (endpoints, payloads, erros padronizados, segurança, fluxo de status,
  modelo de pareamento, riscos).
- `docs/PHASE4_PRINT_REPORT.md` — este relatório.
- `src/lib/print/pairing.functions.ts` — Server functions
  (`listPairings`, `createPairing`, `revokePairing`, `rotatePairing`),
  todas com `requireSupabaseAuth` + verificação de admin global/empresa.
- Migration `print_agent_pairings` — tabela + RLS + triggers de auditoria.

### Alterados (apenas o necessário)
- `src/lib/print/types.ts` — Novos tipos: `AgentErrorCode`, `AgentErrorBody`,
  `AgentCancelResponse`, `PrintAgentPairing`, `PrintAgentPairingCreated`.
  Adicionados campos opcionais `code` em `AgentHealth`/`AgentJobStatus`.
- `src/lib/print/print-agent-client.ts` — Reflete o contrato documentado:
  - Header `X-Company-Id` opcional.
  - Erros HTTP convertidos em `PrintAgentError` com `code` padronizado.
  - Novos métodos: `testPrinter`, `printTestPage`, `cancelJob`.
  - `PrintAgentOfflineError` agora carrega `code` (`AGENT_OFFLINE` | `TIMEOUT`).
  - Mock estendido para simular token ausente/inválido, cancelamento e
    cancelável/não cancelável.
- `src/lib/print/index.ts` — Reexporta `pairing.functions`.

### NÃO alterados (garantia explícita)
- `src/lib/label-pdf.ts`
- `src/routes/app.labels.print-labels.tsx`
- Layouts nativos (`label_layouts`, `label_layout_elements`)
- Policies/triggers de tabelas pré-existentes
- Edge functions

## Contrato definido (resumo)
- Base: `http://127.0.0.1:17777` (loopback).
- Auth: `Authorization: Bearer pat_…` + `X-Company-Id: <uuid>`.
- Origens: lista branca (Lovable preview + published + localhost dev).
- Endpoints: `/health`, `/printers`, `/printers/:id/test`,
  `/printers/:id/test-page`, `/print`, `/jobs/:id`, `/jobs/:id/cancel`.
- Erros: corpo JSON `{ code, message, details? }` com 12 códigos padronizados.

## Estratégia de pareamento
1. Admin (global ou da empresa) chama `createPairing({ companyId, label })`.
2. Servidor gera `pat_<64 hex>`, calcula SHA-256, persiste **apenas o hash**
   + prefixo de 12 chars + `created_by`.
3. Token bruto retornado **uma única vez** ao admin (será exibido em UI
   futura para configurar o agente local).
4. `revokePairing` marca `status='revoked'` + auditoria.
5. `rotatePairing` revoga o atual e cria um novo registro vinculado à
   mesma empresa, sem afetar outras estações.
6. Tudo registrado em `audit_logs` via trigger `tg_audit_row`.

## Segurança implementada
- Token bruto nunca armazenado em texto aberto (somente SHA-256).
- RLS restringe leitura/escrita a admins global ou da empresa.
- Server functions revalidam permissões via `is_global_admin` + `has_role`
  (não dependem só de RLS — defesa em profundidade).
- Sem service role no frontend.
- CORS/origem documentados como obrigação do agente.
- Auditoria automática em INSERT/UPDATE/DELETE.
- Nenhuma policy antiga foi alterada.

## Integração com FASE 3
- `PrintAgentClient` ganhou métodos `cancelJob`, `testPrinter`,
  `printTestPage` e header `X-Company-Id`, mantendo retrocompatibilidade
  com o `enqueue/markSent/recordFailure` do `print-queue-service`.
- `PrinterService` e `PrintQueueService` permanecem como estavam.
- Mocks evoluídos para cobrir os novos cenários (token, cancel, erros).

## Testes executados
Arquivo: `src/lib/print/print-agent-client.test.ts` (14 testes).

Cenários cobertos:
- ✅ Agente online (`/health` ok).
- ✅ Agente offline (`code=AGENT_OFFLINE`, sem throw em `health()`).
- ✅ Listagem de impressoras.
- ✅ Submit + getJob (fluxo feliz).
- ✅ Submit com falha → `PrintAgentError(code=INTERNAL_ERROR, status=500)`.
- ✅ Token ausente → `MISSING_TOKEN` 401.
- ✅ Token inválido → `INVALID_TOKEN` 401.
- ✅ Token válido autentica.
- ✅ Timeout → `code=TIMEOUT`.
- ✅ Cancel feliz (status passa a `canceled`).
- ✅ Cancel de id inexistente → `JOB_NOT_FOUND` 404.
- ✅ Cancel bloqueado → `JOB_NOT_CANCELABLE` 409.
- ✅ `testConnection()` false offline (fallback PDF preservado).
- ✅ Shape de `PrintAgentError` (code/status/message).

## Riscos conhecidos / limitações
- O binário do Print Agent ainda **não existe**; tudo nesta fase é
  contratual + mock. Sem agente, a UI opera em modo PDF (intacto).
- Server functions de pareamento ainda não têm UI (intencional — fora do
  escopo desta fase). Podem ser invocadas via `useServerFn` quando a tela
  for autorizada.
- `last_seen_at`/`last_seen_ip` ainda não são atualizados (dependem de um
  endpoint server-side que o agente chamará para "ping" — pertence à
  fase do binário real).
- DNS rebinding mitigado via Origin + token, mas exige que o agente
  implemente as checagens documentadas no protocolo.

## Pendências para a próxima fase
- Tela de gestão de pareamentos (criar, listar, revogar, rotacionar) +
  modal "copie agora, não será exibido novamente".
- Endpoint server-side para receber pings/last_seen do agente.
- Implementação do binário Print Agent (Windows/macOS/Linux).
- Instalador assinado + keystore do SO.
- Integração UI no fluxo de impressão: tentar agente → fallback PDF
  com mensagem clara.

## Confirmações finais
- Fluxo PDF atual **não foi tocado**.
- Nenhuma policy antiga foi alterada.
- Service role permanece restrito ao backend.
- Aguardando autorização para a FASE 5.
