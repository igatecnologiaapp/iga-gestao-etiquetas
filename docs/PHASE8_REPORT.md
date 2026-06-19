# FASE 8 — Performance, Segurança e Validação Técnica

Data: 2026-06-19  
Status: Concluída

## 1. Resumo executivo

A Fase 8 foi uma fase de hardening: revisão de RLS, permissões, índices,
auditoria e fluxos críticos. Não foram introduzidas novas funcionalidades
de negócio. As Fases 1 a 7 permanecem 100% preservadas.

## 2. Segurança — RLS

Todas as **33 tabelas do schema `public` permanecem com RLS habilitado**:

allergens, audit_logs, branches, brands, categories, companies, ingredients,
label_categories, label_custom_fields, label_formats, label_layout_elements,
label_layout_versions, label_layouts, label_snapshots, layout_associations,
nutrition_facts, permissions, print_batches, print_events, printed_labels,
printer_configs, product_allergens, product_ingredients, product_price_history,
product_prices, products, promotion_products, promotions, role_permissions,
system_settings, user_branch_access, user_company_roles, user_profiles.

Padrões verificados:
- Isolamento por `company_id` em todas as tabelas multiempresa.
- Isolamento por `branch_id` em `printer_configs`, `print_batches`,
  `printed_labels`, `product_prices`, `promotion_products` quando aplicável.
- Escrita restrita a `administrador` / `supervisor` em cadastros sensíveis
  (`companies`, `branches`, `user_company_roles`, `role_permissions`,
  `label_layouts`, `label_layout_versions`, `printer_configs`).
- `Operador` pode emitir etiquetas (insert em `print_batches`,
  `printed_labels`, `print_events`) e ler cadastros, mas não pode alterar
  layouts, preços ou promoções.
- `Consulta` tem somente SELECT em cadastros e histórico; sem acesso a
  emissão, exportação administrativa ou auditoria.

## 3. Segurança — Funções SECURITY DEFINER

Auditadas 9 funções `SECURITY DEFINER`. Todas declaram
`SET search_path = public` (sem search_path mutável).

Migration aplicada (`20260619_fase8_hardening`):
- `REVOKE EXECUTE … FROM anon, PUBLIC` em `has_role`, `has_any_role`,
  `is_global_admin`, `is_company_member`, `log_audit`,
  `get_active_promotion_for_product`, `suggest_label_layout`.
- `GRANT EXECUTE … TO authenticated` mantido para uso interno.
- Funções de trigger (`tg_set_updated_at`, `tg_audit_row`,
  `handle_new_user`) não têm EXECUTE público.

Os WARN remanescentes do linter ("Signed-In Users Can Execute SECURITY
DEFINER Function") são esperados e aceitos: essas funções precisam ser
chamadas via RPC/policies pelo papel `authenticated` (são a base do RBAC).
Foram mantidas com `STABLE` + search_path fixo, retornando apenas booleano,
sem efeitos colaterais — sem risco de elevação de privilégio.

## 4. Performance — Índices

Já existiam 50+ índices em campos críticos (`company_id`, `branch_id`,
`created_at`, `label_type`, `status`, FKs de batches/labels/eventos).

Índices adicionados nesta fase:

| Índice | Tabela |
| --- | --- |
| `idx_nutrition_facts_company_status` | nutrition_facts |
| `idx_categories_company_parent` | categories |
| `idx_brands_company` | brands |
| `idx_ingredients_company` | ingredients |
| `idx_allergens_company` | allergens |
| `idx_product_allergens_product` | product_allergens |
| `idx_product_ingredients_product` | product_ingredients |
| `idx_product_prices_product` | product_prices |
| `idx_promotion_products_product` | promotion_products |
| `idx_promotion_products_promotion` | promotion_products |
| `idx_products_status` | products |
| `idx_audit_logs_record` | audit_logs |

Todos via `CREATE INDEX IF NOT EXISTS` — migração idempotente.

## 5. Consultas e React Query

- Todas as telas usam `@tanstack/react-query` com `queryKey` específico
  por empresa/filial; cache invalidado em mutações via `invalidateQueries`.
- Dashboards (`/app`) e relatórios (`/app/reports`) consomem **views
  agregadas** (`dashboard_*`) com `security_invoker = true`, respeitando RLS.
- Listagens grandes (`/app/print-history`, `/app/products`, `/app/audit`)
  aplicam filtros por período + `LIMIT` no servidor.
- Exportações CSV/PDF (`src/lib/report-export.ts`) respeitam exatamente
  o filtro corrente (empresa, filial, período, tipo) e registram
  `audit_logs` via `log_audit`.

## 6. Auditoria

`audit_logs` é populado em:
- Cadastros (criação/edição/inativação) via `tg_audit_row` em
  produtos, categorias, marcas, ingredientes, alergênicos, layouts,
  preços, promoções, usuários e permissões.
- Emissão e reimpressão (`print_events` + `log_audit('PRINT'|'REPRINT')`).
- Cancelamento de lotes (`log_audit('CANCEL')`).
- Geração e download de PDF (`print_event_type: pdf_generated`,
  `pdf_downloaded`).
- Exportação de relatórios (`log_audit('EXPORT')`).
- Alterações de preço (`product_price_history` + audit log).
- Alterações de associação de layouts e permissões.

Snapshots em `label_snapshots` permanecem **imutáveis** — não há policy
de UPDATE/DELETE para `authenticated`; apenas INSERT na emissão.

## 7. Fluxos validados por perfil

| Fluxo | Admin | Supervisor | Operador | Consulta |
| --- | :-: | :-: | :-: | :-: |
| Login + sessão | ✅ | ✅ | ✅ | ✅ |
| Cadastro de produto | ✅ | ✅ | ❌ | ❌ |
| Cadastro de informação nutricional | ✅ | ✅ | ❌ | ❌ |
| Aparição em pendências | ✅ | ✅ | ✅ | ✅ |
| Bloqueio de etiqueta incompleta | ✅ | ✅ | ✅ | n/a |
| Criar/editar layout | ✅ | ✅ | ❌ | ❌ |
| Emitir etiqueta nutricional | ✅ | ✅ | ✅ | ❌ |
| Gerar PDF | ✅ | ✅ | ✅ | ❌ |
| Reimpressão com motivo | ✅ | ✅ | ✅ | ❌ |
| Etiqueta de gôndola | ✅ | ✅ | ✅ | ❌ |
| Criar promoção | ✅ | ✅ | ❌ | ❌ |
| Exportar relatório | ✅ | ✅ | ❌ | ❌ |
| Dashboard com filtros | ✅ | ✅ | parcial | parcial |
| Auditoria/Preços/Usuários | ✅ | parcial | ❌ | ❌ |

## 8. Riscos remanescentes

- WARN do linter sobre SECURITY DEFINER executável por `authenticated`
  são aceitos por design (helpers do RBAC).
- Não há rate limiting nas RPCs `suggest_label_layout` e
  `get_active_promotion_for_product` — recomendado em fase futura.
- Realtime ainda não habilitado (não é objetivo do MVP).
- Não há paginação infinita nas telas de produtos/histórico — usam
  `LIMIT` fixo + filtros; adequado para o volume atual.

## 9. Recomendações para próxima fase

**Fase 9 — Multi-canal e Integrações**:
- API pública `/api/public/labels` para emissão programática (com HMAC).
- Webhooks de ERP/PDV para sincronização de preços.
- Integração com filas de impressão (spooler ZPL).
- Rate limiting nas RPCs públicas.
- Realtime para dashboard operacional ao vivo.
