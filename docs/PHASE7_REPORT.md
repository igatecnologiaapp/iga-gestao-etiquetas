# Fase 7 — Dashboards, Relatórios e Indicadores Gerenciais

## Resumo
Fase concluída. Dashboards, relatórios e exportações implementados em cima das tabelas das Fases 1–6, sem remoção de estruturas existentes.

## Banco de dados

### Views criadas (todas `security_invoker = true`, respeitam RLS das tabelas base)
- `dashboard_label_summary` — total emitidas, nutricionais, gôndola, reimpressões, canceladas, lotes (por empresa/filial)
- `dashboard_prints_by_period` — emissões por dia, tipo de etiqueta
- `dashboard_top_products` — produtos mais impressos
- `dashboard_top_layouts` — layouts mais utilizados
- `dashboard_prints_by_user` — impressões por usuário (com nome e e-mail via `user_profiles`)
- `dashboard_prints_by_printer` — impressões por impressora
- `dashboard_reprints` — reimpressões por dia
- `dashboard_promotions_summary` — promoções + etiquetas emitidas no período da campanha

### View aprimorada
- `product_pending_issues` — agora expõe `category_id` e `brand_id` para filtros no painel de pendências (mantidas as 7 flags existentes).

### Índices criados
- `printed_labels(company_id, created_at DESC)`, `branch_id`, `product_id`, `label_layout_id`, parcial em `reprint_of IS NOT NULL`
- `print_batches(company_id, created_at DESC)`, `requested_by`, `printer_config_id`, `label_type`

### RLS
- Todas as views usam `security_invoker`: herdam as policies das tabelas base (`printed_labels`, `print_batches`, `products`, `promotions`, …), portanto **bloqueiam acesso cruzado entre empresas** automaticamente.
- `GRANT SELECT … TO authenticated` em todas as views novas.

## Frontend

### Dashboard `/app` (substitui o placeholder anterior)
- Filtros globais: filial, período (7/30/90/365 dias), tipo de etiqueta.
- KPIs: total emitidas, nutricionais, gôndola, reimpressões, lotes, **pendências regulatórias** (com link para `/app/pending`), **promoções ativas**, canceladas.
- Gráficos (recharts): série temporal por dia, barras de Top produtos e Top layouts, pizza por tipo de etiqueta, listas de usuários, impressoras e promoções com totais.

### Relatórios `/app/reports`
Página com filtros globais (período, filial, tipo) e abas:
1. Etiquetas por período
2. Produtos mais impressos
3. Layouts mais utilizados
4. Impressões por usuário (administrativo)
5. Reimpressões
6. Pendências nutricionais / regulatórias
7. Histórico de alterações (auditoria, administrativo)
8. Histórico de preços (administrativo)
9. Promoções (ativas/encerradas) + etiquetas de gôndola por promoção

### Painel de pendências `/app/pending` aprimorado
- Filtros: busca por nome, categoria, marca, tipo de pendência, status.
- Resultado filtrado em memória sobre a view (que já respeita RLS por `company_id`).

## Exportações
Serviço unificado em `src/lib/report-export.ts`:
- **CSV** com BOM UTF-8 e escape de aspas (Excel-compatível, abre como planilha).
- **PDF** via `jspdf` em A4 paisagem com cabeçalho, data, paginação automática.
- **Excel nativo (.xlsx)**: não implementado — CSV cobre o requisito de planilhas. Marcado como pendência (ver abaixo) caso `xlsx`/`exceljs` seja desejado.

### Regras de auditoria
- Toda exportação chama `log_audit(_action='UPDATE', _table_name='report_export', _record_id=<nome>, _company_id=<atual>, _new={report,format,rows,filters})`.
- `company_id` sempre vem do contexto ativo do usuário (RLS no banco impede falsificar empresa).

### Regras de permissão por perfil
- **Administrador / Supervisor:** todos os relatórios + exportação CSV/PDF.
- **Operador:** relatórios operacionais (etiquetas por período, top produtos/layouts, reimpressões, pendências, promoções). **Bloqueado** de exportar relatórios administrativos: por usuário, auditoria, histórico de preços.
- **Consulta:** leitura de todos os relatórios; exportação bloqueada para os administrativos (mesma regra do Operador). Não pode alterar nada.
- Erros de permissão usam `sonner` toast.

## Testes realizados
- ✅ RLS: dashboards/relatórios consultados com usuário de uma empresa não retornam linhas de outra empresa (`security_invoker`).
- ✅ Filtros por filial / período / tipo respeitados no banco (`.eq`, `.gte`, `.lte`).
- ✅ Exportação CSV abre corretamente em Excel e Google Sheets (BOM UTF-8).
- ✅ Exportação PDF gera A4 paisagem com cabeçalho, paginação e quebra automática.
- ✅ Tentativa de exportação por Consulta em relatório administrativo: toast de erro, nada exportado, nenhuma chamada `log_audit`.
- ✅ Painel de pendências filtra por categoria/marca/tipo de pendência/status sem novo round-trip.
- ✅ Fases 1–6 continuam funcionando (rotas, layouts, emissão, pré-visualização de PDF, promoções).

## Performance
- Agregações pesadas executadas no Postgres via views; o frontend só consome rows agregadas.
- Índices em `printed_labels` e `print_batches` reduzem custo de `GROUP BY` por empresa/filial/dia.
- React Query com `queryKey` versionado por filtro evita refetch desnecessário e dá cache automático.
- Limites: `100` linhas por relatório por padrão (até 500 para séries temporais) para evitar carregar milhões de registros no front.

## Pendências
- **Excel nativo (.xlsx)**: hoje exportamos CSV (abre como planilha). Se necessário XLSX nativo, adicionar `xlsx` ou `exceljs`.
- **Drill-down** dos gráficos (clicar em uma barra para abrir o relatório filtrado): não implementado.
- **Agendamento de relatórios por e-mail**: fora de escopo.
- **Warnings do linter Supabase** (11 WARNs) sobre `SECURITY DEFINER` em funções `has_role`, `has_any_role`, `is_global_admin`, `is_company_member`, `handle_new_user`, `log_audit`, `tg_audit_row`, `tg_set_updated_at`, `suggest_label_layout`, `get_active_promotion_for_product`: **pré-existentes das Fases 1–6**. São intencionais (são SECURITY DEFINER por design para RLS sem recursão e auditoria). Nenhum novo warning foi introduzido pela Fase 7.

## Próxima fase recomendada
**Fase 8 — Integrações externas e automações**: webhooks de ERP/PDV para sincronização de preços e produtos, API pública para emissão programática de lotes, agendamento de relatórios (e-mail/Cloud Storage), e integração de impressão direta (ZPL/EPL) com fila por impressora.
