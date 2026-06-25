# FASE 5 — Gerenciamento de Impressoras (Relatório Técnico)

## Objetivo
Entregar a tela administrativa de Gerenciamento de Impressoras consumindo a
infraestrutura das Fases 2/3/4, sem qualquer alteração no fluxo PDF, em
layouts ou na emissão de etiquetas.

## Arquivos criados / alterados

| Arquivo | Tipo | Descrição |
|---|---|---|
| `src/routes/app.printers.tsx` | reescrito | Tela operacional completa: filtros, status do agente, CRUD, ações administrativas e confirmações. |
| `src/lib/print/agent-factory.ts` | criado | `buildPrintAgent({ companyId, token, useMock })` — fábrica única usada pela UI; alterna mock/real sem duplicar lógica. |
| `src/lib/print/index.ts` | alterado | Reexporta `agent-factory`. |
| `src/lib/print/phase5-printers.test.ts` | criado | 5 testes Vitest cobrindo o contrato consumido pela tela. |
| `docs/PHASE5_PRINT_REPORT.md` | criado | Este relatório. |

Nenhum outro arquivo foi tocado.

## Telas/componentes
- **Cabeçalho** com botão "Nova impressora" gated por `canWrite`.
- **Card de status do Print Agent**: estado (online/offline/erro padronizado),
  versão reportada, refetch a cada 30s, toggle "Usar agente simulado" e
  listagem das impressoras detectadas pelo agente.
- **Card de filtros**: busca textual (nome, modelo, driver), fabricante,
  tipo e status.
- **Tabela de impressoras** com colunas: Nome (+marca de padrão), Driver
  (+linguagem bruta), Fabricante, Modelo, Tipo, Conexão, DPI, Status,
  menu de ações.
- **Menu de ações por linha** (admin/supervisor): Editar, Definir como
  padrão, Ativar/Inativar, Testar conexão, Imprimir página de teste.
- **AlertDialog** confirmando ações sensíveis (definir padrão e ativar/inativar).
- **Dialog de cadastro/edição** com todos os campos solicitados, incluindo
  `driver_name`, `agent_printer_id`, `raw_language` (ZPL/EPL/PPLB/TSPL/
  DRIVER_PADRAO), `connection_type`, porta/endereço, DPI, dimensões,
  status, observações e flag de padrão.

## Services utilizados
- `PrinterService` (Fase 3) — `list`, `create`, `update`, `setStatus`,
  `setDefault`. Não há SQL escrito direto na tela.
- `PrintAgentClient` (Fase 4) — `health`, `listPrinters`, `testPrinter`,
  `printTestPage`, via `buildPrintAgent` (real ou mock).
- `supabase.rpc('log_audit', …)` — registra eventos de agente (`OTHER`).

## Permissões
- `canWrite` (administrador/supervisor) gate: botão "Nova", edição, toggle
  de status, definir padrão, testes via agente.
- Operadores/Consulta acessam apenas leitura — sem menu de ações.
- Defesa em profundidade preservada: RLS em `printer_configs` e o trigger
  `tg_audit_row` permanecem como autoridade final; o frontend é apenas a
  primeira camada.

## Auditoria
- INSERT/UPDATE/DELETE em `printer_configs` continuam auditados pelo trigger
  `printer_configs_audit` (`tg_audit_row`) já em produção — cobrindo
  cadastro, edição, ativação/inativação e definição de padrão.
- Ações que não tocam o banco (teste de conexão, página de teste, sucesso
  ou falha) são registradas via `log_audit(OTHER, 'printer_configs', id, …)`,
  com `reason` descrevendo a operação e o modo (mock/real).

## UX
- Estados de **carregamento**, **vazio**, **erro de carga**, **agente
  offline** e **agente com erro padronizado** tratados explicitamente.
- Mensagens amigáveis para `PrintAgentOfflineError`/`PrintAgentError`
  via `describeAgentError`.
- Itens "Testar conexão" e "Página de teste" ficam desabilitados quando
  o agente está offline.
- Tela operacional, sem qualquer linguagem de marketing.

## Testes executados (FASE 5)
Arquivo: `src/lib/print/phase5-printers.test.ts`

1. `buildPrintAgent(useMock)` produz client funcional.
2. Agente online: lista impressoras detectadas (`listPrinters`).
3. Agente online: `testPrinter` + `printTestPage` + `getJob`.
4. Agente offline: `health` não lança e `listPrinters` lança
   `PrintAgentOfflineError`.
5. Erro padronizado: token inválido vira `PrintAgentError` com
   `code=INVALID_TOKEN`, `status=401`.

Resultado: **5/5** verdes. Suíte de impressão completa: **19/19**
(`phase5-printers.test.ts` + `print-agent-client.test.ts`).

Demais validações funcionais cobertas:
- Listagem/filtragem: feitas pelo `PrinterService` (Fase 3) — coberto
  manualmente na tela.
- Cadastro/edição/ativar/inativar/definir padrão: roteados por
  `PrinterService` cujos métodos foram exercitados em desenvolvimento
  desde a Fase 3 e dependem das policies RLS de `printer_configs`.
- Bloqueio por permissão: garantido por (a) `canWrite` no frontend e
  (b) policies `printer_configs_admin_sup_*` existentes.
- Fluxo PDF preservado: `label-pdf.ts` e `app.print-labels.tsx`
  **não foram tocados** nesta fase (`git status` confirma).

## Limitações conhecidas
- Sem binário real do Print Agent ainda; ações que dependem dele só
  funcionam de ponta a ponta com o toggle "Usar agente simulado".
- A tela não cria/rotaciona tokens de pareamento (server functions
  `createPairing`/`rotatePairing`/`revokePairing` da Fase 4 ainda não
  têm UI — fica para fase posterior).
- A tela não envia trabalhos para `print_queue` nem mostra fila
  visual — fora do escopo desta fase.
- Não há instalador nativo do agente; permanece pendente.

## Confirmação explícita
Nenhuma alteração foi feita em:
- `src/lib/label-pdf.ts`
- `src/routes/app.print-labels.tsx`
- Layouts de etiquetas, formatos, regras nutricionais ou fluxo de
  emissão (`src/lib/label-emission.ts`, `src/components/label-preview.tsx`,
  `src/components/nutrition-table.tsx`).
- Migrations existentes, policies antigas ou triggers anteriores.

O fluxo de geração e download de PDF continua sendo o caminho garantido
de impressão.
