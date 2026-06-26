# FASE 11 — Dashboard de Impressão

## Arquivos criados
- `src/lib/print/print-analytics.ts` — agregações puras (sem rede): `computeMetrics`, `aggregateByPeriod` (day/week/month/year via ISO), `aggregateByDimension` (printer/layout/user/product/company com top-N), `aggregateByEnum` (status/source), `buildDashboardCsv`.
- `src/lib/print/print-analytics.test.ts` — 11 testes unitários.
- `src/routes/app.print-dashboard.tsx` — nova tela `/app/print-dashboard`.
- `docs/PHASE11_PRINT_REPORT.md` — este relatório.

## Arquivos alterados
- `src/components/app-shell.tsx` — adicionada entrada **Dashboard** (ícone `BarChart3`) no grupo "Emissão", entre Histórico e os demais módulos.

## Tela / Seção
Rota nova **`/app/print-dashboard`**. Não duplica `/app/print-history` (FASE 10) nem `/app/print-queue` (FASE 9) — fornece a camada gerencial agregada. Atalhos no header levam a Histórico, Fila e Emissão.

## Cards implementados
- Etiquetas impressas (soma de `quantity`)
- Jobs (total)
- Concluídos / Falhas / Cancelamentos / Reimpressões / Fallback PDF
- Taxa de sucesso (`completed / (completed+failed+canceled)`)
- Taxa de erro (`(failed+canceled) / finished`) — destaque destrutivo quando > 10%
- Tempo médio de impressão (`started_at → finished_at`, formatado em ms/s/min)

## Gráficos implementados
- **Linha:** Impressões por período (jobs / etiquetas / falhas) com granularidade selecionável (diária, semanal, mensal, anual).
- **Barras horizontais:** Impressões por impressora, falhas por impressora, impressões por layout, impressões por usuário, top produtos.
- **Pizza:** Print Agent × PDF fallback.
- **Badges:** distribuição por status com cores semânticas.

Biblioteca: `recharts` (já usada em `src/routes/app.index.tsx`).

## Filtros implementados (atualizam cards + gráficos)
- Período (de/até, default últimos 30 dias)
- Granularidade (dia / semana / mês / ano)
- Status (`pending`, `sent`, `printing`, `completed`, `failed`, `canceled`)
- Origem (`print_agent`, `pdf_fallback`, `manual`)
- Impressora (seletor com nomes da empresa)
- Layout (seletor com nomes da empresa)
- Usuário (seletor populado por `PrintHistoryService.listUsersWithJobs`)
- Empresa: implícita via `useActiveCompany` + RLS (não exposta; respeita escopo).

## Services / consultas
- `PrintHistoryService.list({...limit: 1000})` — reuso integral da FASE 10. RLS já garante:
  - Operador → só vê seus próprios jobs.
  - Supervisor/Administrador → vê toda a empresa.
  - Global admin → conforme `is_company_member`.
- `PrintHistoryService.listUsersWithJobs(companyId)` — popula o filtro de usuário sem expor `user_profiles` em massa.
- `printer_configs` / `label_layouts` — `supabase.from(...).select("id,name")` (policies existentes).
- Agregações 100% client-side via `print-analytics.ts` — função pura, sem dependência de Supabase.

## Estratégia de performance
- Limite duro de **1000 jobs** por carga; query única indexada (`print_queue_company_status_idx`, `print_queue_printer_idx`, `print_queue_user_idx`).
- Filtros aplicados server-side (status/origem/período/impressora/layout/usuário) antes de chegarem ao client.
- Agregações em `useMemo` (rodam apenas quando `jobs.data` muda).
- Sem refetch em foco; chave `useQuery` codifica todos os filtros para cache transparente.
- Limite documentado como **limitação conhecida** — fases futuras podem migrar para `rpc` agregada em SQL quando o volume justificar.

## Permissões
- Tudo passa por RLS de `print_queue`/`printer_configs`/`label_layouts`/`user_profiles` — nenhuma policy nova foi criada.
- Modo "consulta" exibe banner informativo; nada na UI escala permissões além do que o backend autoriza.
- Operador nunca vê jobs alheios; supervisor/administrador escopo limitado à empresa ativa.

## UX
- Estados: carregando / erro / vazio (todos com ícone + mensagem).
- Cards de indicadores com tons semânticos (success/destructive/warn/secondary).
- Destaque visual para taxa de erro alta (> 10%) e contagens de falhas/cancelamentos.
- Atalhos para Histórico, Fila e Nova emissão no header.
- Exportação CSV (BOM UTF-8, separador `;`) com indicadores e série temporal.

## Testes executados
`bunx vitest run` → **111/111 verdes** (8 arquivos).
- `print-analytics.test.ts` (11 testes novos):
  - `computeMetrics` — totais, taxas, vazio
  - `bucketKey` — dia/mês/ano + ISO week
  - `aggregateByPeriod` — ordenação ascendente, soma de quantidades, contagem de falhas
  - `aggregateByDimension` — sort desc, top-N, suporte a user/layout/product
  - `aggregateByEnum` — labels pt-BR para status/source
  - `buildDashboardCsv` — header + indicadores + série temporal
- Suites pré-existentes inalteradas (`print-queue` 11, `direct-print` 9, `print-agent-client` 14, `printer-config-validation` 7, `layout-engine` 27, `print-history-service` 12, `label-nutrition` 20).

Filtros e estados validados por composição: a aba consome exclusivamente `PrintHistoryService` (testado em FASE 10) + `print-analytics` (testado nesta fase).

## Limitações conhecidas
- Agregação totalmente client-side com **teto de 1000 jobs por consulta**. Para tenants com volume maior, criar `rpc` agregada em SQL fica recomendado para FASE 12+.
- Filtro multi-empresa (cross-tenant para global admins) não exposto na UI — sempre limita à empresa ativa.
- Exportação **CSV apenas** (sem XLSX/PDF). Estrutura `buildDashboardCsv` preparada para evoluir.
- Gráfico de Print Agent × PDF reflete apenas jobs presentes em `print_queue`; uso histórico de PDF anterior à FASE 7 (que não passou pelo orquestrador) não está contabilizado.
- "Tempo médio" depende de `started_at`/`finished_at` populados pelo orquestrador — jobs muito antigos sem essas marcações são excluídos da média.

## Preservação confirmada
- ✅ `src/lib/label-pdf.ts` **não foi alterado**.
- ✅ Preview (`src/components/label-preview.tsx`) **não foi alterado**.
- ✅ Layouts cadastrados (`label_layouts`, `label_layout_elements`) **não foram alterados**.
- ✅ Emissão (`src/routes/app.print-labels.tsx`) **não foi alterada**.
- ✅ Fila (`src/routes/app.print-queue.tsx`) **não foi alterada**.
- ✅ Histórico (`src/routes/app.print-history.tsx`) **não foi alterado** — apenas referenciado por atalho.
- ✅ Nenhuma policy, migration ou trigger novos; nenhuma dependência adicionada (`recharts` já estava no projeto).

---
**FASE 11 concluída.** Aguardando autorização para iniciar a FASE 12.
