# FASE 7 — Seleção de Impressora na Emissão e Envio Controlado ao Print Agent

Status: ✅ Concluída

## Arquivos criados

- `src/lib/print/use-print-agent.ts` — hook React que descobre o status do Print Agent local, guarda o token de pareamento em `localStorage` (`print_agent_token:{companyId}`) e oferece modo simulado (`print_agent_mock:{companyId}`) para validação sem agente físico.
- `src/lib/print/direct-print.ts` — orquestrador puro (`validateDirectPrint`, `buildAgentPayload`, `runDirectPrint`) que centraliza validação, montagem de payload, enfileiramento em `print_queue` e tradução de erros do agente em fallback PDF.
- `src/lib/print/direct-print.test.ts` — 9 testes Vitest cobrindo validações e payload.
- `src/components/print/print-agent-panel.tsx` — painel compacto de status: ícone online/offline, badge "simulado", botões para colar / remover token, alternar simulador e atalho para Gerenciamento de Impressoras.
- `docs/PHASE7_PRINT_REPORT.md` (este documento).

## Arquivos alterados

- `src/routes/app.print-labels.tsx`:
  - Carrega `printer_configs` completos (todas as colunas técnicas da FASE 6).
  - Nova query `PrinterCompatibilityService.listByPrinter` → `compatibleLayoutIds`.
  - Hook `usePrintAgent(companyId)` instanciado uma vez na tela.
  - Bloco `directValidation` derivado do orquestrador (mostrado em `Alert` próprio).
  - Alerta dedicado para layout não compatível com a impressora selecionada.
  - `PrintAgentPanel` renderizado dentro do card de emissão.
  - Novo botão **"Imprimir direto"** (mutation `directPrint`) ao lado dos botões existentes; em falha/offline cai automaticamente para `openPdfFallback()` (reaproveita `buildLabelsPdf`).
  - Helper `openPdfFallback` reutilizado pelo botão "Pré-visualizar PDF" — comportamento preservado.

## Services usados

- `PrinterService` (indireto, via consulta direta a `printer_configs`).
- `PrinterCompatibilityService.listByPrinter` — verifica vínculos impressora ↔ layout.
- `PrintQueueService.enqueue` / `markSent` / `updateStatus` / `recordFailure` — ciclo de vida do job em `print_queue`.
- `PrintAgentClient.submit` — envia o job ao agente local (mockável).
- `validateTechnicalConfig` — espelha CHECK constraints (DPI, escala, margens, rotação, offsets, linguagem bruta).

## Payload enviado ao Print Agent

Construído em `buildAgentPayload`:

```jsonc
{
  "company_id": "...",
  "branch_id": "...|null",
  "product_id": "...",
  "layout_id": "...",
  "printer_id": "...",
  "printer": {
    "name": "...", "driver": "...",
    "agent_printer_id": "...",
    "raw_language": "ZPL|EPL|PPLB|TSPL|driver",
    "dpi": 203, "speed": 4, "auto_cut": false, "label_advance": 2
  },
  "quantity": 5,
  "geometry": {
    "width": 100, "height": 150, "unit": "mm", "orientation": "portrait",
    "scale": 100, "rotation": 0, "offset_x": 0, "offset_y": 0,
    "margins": { "top": 1, "right": 1, "bottom": 1, "left": 1 }
  },
  "label": { /* mesmo objeto usado pelo preview/PDF */ },
  "layout": { "id": "...", "name": "...", "label_type": "...", "elements": [...] },
  "origin": "lovable.print-labels",
  "source": "print_agent",
  "batch_id": "...|null"
}
```

## Validações implementadas

- Empresa, produto, layout, impressora obrigatórios.
- Impressora ativa e com `agent_printer_id` definido.
- Configuração técnica respeita todos os intervalos da FASE 6 (DPI, escala, margens, rotação, offsets, linguagem bruta, label_advance).
- Layout ativo, com formato e elementos.
- Coordenadas de cada elemento dentro da área do formato.
- Quantidade entre 1 e 5000.
- Se há lista de compatibilidade definida, o layout precisa pertencer a ela (lista vazia = sem restrição).
- Validações existentes da emissão (peso variável, glúten/lactose, preços, promoções, lote/fabricação/validade obrigatórios pelo layout) **permanecem intactas**.

## Estados de UX cobertos

| Estado | Indicação |
|--|--|
| Carregando impressoras / agente | Spinner no painel ("Verificando agente local...") |
| Sem impressora ativa | Select exibe "Nenhuma cadastrada"; botões de impressão direta desabilitados |
| Sem layout compatível | Alert "Layout incompatível" com link para `/app/printers` |
| Agente offline | Painel marca **Offline (código)**, botão direto desabilitado, PDF segue disponível |
| Sem token / token inválido | Alert "Sem token de pareamento" + botão "Colar token" |
| Envio em andamento | Botão exibe "Enviando..." e fica desabilitado |
| Sucesso | Toast "Enviado ao Print Agent (job …)"; `print_queue.status = completed` |
| Erro | Toast com motivo + `print_queue.recordFailure` (mensagem técnica). Se `fallback === true`, abre PDF automaticamente. |

## Auditoria / rastreabilidade

- Cada tentativa cria 1 linha em `print_queue` antes do envio (status `pending`).
- Sucesso → `sent` (com `agent_job_id`, `started_at`) → `completed` (`finished_at`).
- Falha → `failed` com `error_message` no formato `[CÓDIGO] mensagem` e `attempts` incrementado.
- Fallback PDF herda a falha registrada acima; `source` original é `print_agent` (o histórico mostra que a tentativa direta existiu e por que falhou).
- O fluxo de `print_batches` / `printed_labels` / `label_snapshots` / `print_events` da emissão tradicional permanece **sem alteração** — auditoria ANVISA preservada.

## Permissões

- Operadores (`canCreateProduct`) podem disparar impressão direta usando impressoras ativas já cadastradas.
- Configuração técnica continua restrita à tela `/app/printers` (gestão de impressoras/compatibilidade não foi movida).
- Painel só expõe edição de token quando `canWrite || canCreateProduct` (mesma trava do restante da emissão).
- RLS de `print_queue`, `printer_configs`, `printer_layout_compatibility` e `print_agent_pairings` continua sendo o ponto de verdade — nenhuma policy foi alterada nesta fase.

## Testes executados

`bunx vitest run src/lib/print/direct-print.test.ts` — **9 passed**:

1. Aceita input válido.
2. Bloqueia quantidade inválida.
3. Bloqueia impressora inativa.
4. Bloqueia impressora sem `agent_printer_id`.
5. Bloqueia layout incompatível.
6. Aceita quando lista de compatibilidade está vazia (sem restrição).
7. Bloqueia elemento fora da área útil.
8. Bloqueia DPI fora do intervalo.
9. `buildAgentPayload` inclui geometria, impressora e dados da etiqueta.

Os testes da FASE 4 (`print-agent-client.test.ts`, 14) e FASE 6 (`printer-config-validation.test.ts`, 7) continuam verdes — sem regressão.

## Limitações conhecidas

- Polling de status (`/jobs/{id}`) não é executado: o agente é tratado como confirmador síncrono. A FASE 9 (fila visual) introduzirá o ciclo `sent → printing → completed`.
- O token de pareamento é colado manualmente por estação. A distribuição automática (QR / deep-link) será endereçada em fase posterior junto com o instalador nativo (fora do escopo da FASE 7).
- Sem dashboard de impressões nesta fase (proibido pelo escopo).
- O modo simulado é local ao navegador (`localStorage`) — não interfere em outras estações.

## Confirmação de preservação

✅ `src/lib/label-pdf.ts` **não foi alterado**.
✅ Botão "Pré-visualizar PDF" e fluxo `buildLabelsPdf/openBlob` mantidos.
✅ Botão "Confirmar emissão" e gravação em `print_batches`/`printed_labels`/`label_snapshots`/`print_events` mantidos.
✅ Componente `LabelPreview` / `FitPreview` inalterado.
✅ Layouts cadastrados, policies anteriores e RLS não foram tocados.
✅ Tipos gerados do Supabase não foram modificados.
