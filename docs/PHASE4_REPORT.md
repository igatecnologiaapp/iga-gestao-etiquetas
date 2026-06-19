# Fase 4 — Emissão de Etiquetas (Relatório Técnico)

## 1. Tabelas criadas
- `print_batches` — lote de emissão (produto, layout, versão, impressora, qtd, lote, fabricação, validade, peso, status, sugestão de layout, requested_by). RLS por `company_id`.
- `printed_labels` — etiqueta unitária dentro do lote, com `unique_label_code` (UNIQUE), `sequential_number`, `qr_code_payload` (JSONB), `barcode_value`, `status`, `reprint_of`.
- `label_snapshots` — snapshot histórico por etiqueta (produto, nutricional, layout/versão/elements/format, impressora, dados da emissão).
- `print_events` — auditoria operacional dedicada (generated, cancelled, reprinted, layout_changed, layout_suggested, no_layout_suggestion, previewed).

## 2. Alterações em tabelas existentes
- `label_categories.label_type` (enum) — mapeamento das 9 categorias semeadas para o novo enum.
- `label_layouts.label_type` (enum) — opcional, permite filtrar layouts por tipo de etiqueta.

## 3. Novos enums
- `label_type`: nutricional, gondola, promocional, logistica, producao, identificacao, validade, outros.
- `print_batch_status`: draft, generated, cancelled, reprinted.
- `printed_label_status`: generated, cancelled, reprinted.
- `print_event_type`: generated, cancelled, reprinted, layout_changed, layout_suggested, no_layout_suggestion, previewed.

## 4. RLS aplicada
Todas as 4 tabelas com RLS habilitada:
- SELECT: `is_company_member(auth.uid(), company_id)` — qualquer perfil da empresa, incluindo Consulta.
- INSERT: `has_any_role` em {administrador, supervisor, operador} — Consulta não emite.
- UPDATE: {administrador, supervisor} (cancelamento, marcação de reprint).
- DELETE: somente administrador.
- `print_events` aceita INSERT por administrador/supervisor/operador.

## 5. Função e regra de sugestão automática
`public.suggest_label_layout(company_id, branch_id, product_id, label_type)` retorna `(layout_id, source)` aplicando a hierarquia:
1. `layout_associations.target_type='product'` → `source='product'`
2. `target_type='category'` (categoria do produto)
3. `target_type='brand'`
4. `target_type='branch'`
5. `target_type='company'`
6. `label_layouts.is_default=true` cuja categoria corresponde ao `label_type` → `label_category_default`
7. Qualquer layout ativo cuja categoria/tipo corresponde → `label_category_any`

Filtra por `status='ativo'` e respeita `label_type` quando preenchido. Quando nenhum layout é encontrado, o frontend permite seleção manual e registra `no_layout_suggestion`. Troca manual registra `layout_changed` e marca `layout_overridden=true` no lote.

## 6. Componentes e telas criadas
- `src/lib/label-emission.ts` — utilitários (tipos, sugestão, validade calculada, `uniqueLabelCode`).
- `src/routes/app.print-labels.tsx` — emissão (filial, tipo, produto, layout sugerido/manual, impressora, qtd, lote, fabricação, validade, peso, pré-visualização, validações).
- `src/routes/app.print-history.tsx` — listagem com filtros: período, tipo, status, produto, lote.
- `src/routes/app.print-history.$id.tsx` — detalhe: produto/layout/impressora, etiquetas geradas, eventos, snapshot, cancelar e reimprimir com motivo.
- `src/components/app-shell.tsx` — novo grupo "Emissão" no sidebar.
- Reutiliza `LabelPreview`, `PageHeader`, `Card`, `Dialog`, `Select`, `Badge`, `Table`.

## 7. Regras de validação antes da emissão
- Produto obrigatório e ativo.
- Layout obrigatório, ativo, com versão vigente.
- Quantidade > 0.
- Impressora ativa (filtro aplicado).
- Peso obrigatório quando `product.variable_weight=true`.
- Elementos obrigatórios do layout (`required=true`): lot/manufacture_date/expiry/weight.
- Para `label_type='nutricional'`, bloqueia via view `product_pending_issues`:
  - missing_nutrition, missing_ingredients, missing_allergens, missing_shelf_life,
    missing_preservation, nutrition_in_review, status_pending.

## 8. Regras de snapshot
- 1 snapshot por etiqueta (`label_snapshots.printed_label_id`).
- Inclui: produto completo, nutricional vigente, layout + versão + elements + formato, impressora, dados da emissão.
- Reimpressão **reutiliza** o snapshot original — imutabilidade histórica garantida.
- Alterações futuras em produto/layout não afetam etiquetas já emitidas.

## 9. Identificação única e códigos
- `unique_label_code` = `<COMPANY4>-<BATCH6>-<SEQ5>-<TS36>` (UNIQUE global).
- `sequential_number` = 1..N por lote.
- `qr_code_payload` (JSONB): id único, produto, código interno, lote, fabricação, validade, company_id, emitted_at.
- `barcode_value`: EAN do produto quando existir, caso contrário `unique_label_code`.

## 10. Auditoria
- `audit_logs` via trigger `tg_audit_row()` em `print_batches`, `printed_labels`, `label_snapshots`.
- `print_events`: generated, layout_suggested, no_layout_suggestion, layout_changed, cancelled, reprinted.

## 11. Reimpressão
- Disponível para admin/supervisor/operador.
- Motivo obrigatório.
- Cria novas linhas em `printed_labels` com `reprint_of` apontando para original e sequencial contínuo.
- Reaproveita snapshots originais, adicionando `reprinted_at` e `reprint_reason`.
- Atualiza status do lote para `reprinted` e gera evento `reprinted`.

## 12. Permissões por perfil
| Ação | Admin | Supervisor | Operador | Consulta |
|---|---|---|---|---|
| Ver histórico (company) | ✓ | ✓ | ✓ | ✓ |
| Emitir lote | ✓ | ✓ | ✓ | ✗ |
| Trocar layout manualmente | ✓ | ✓ | ✓ | ✗ |
| Reimprimir | ✓ | ✓ | ✓ | ✗ |
| Cancelar lote | ✓ | ✓ | ✗ | ✗ |
| Excluir lote/etiqueta | ✓ | ✗ | ✗ | ✗ |

> Caso a política exija que Operador NÃO troque layout, condicionar o `Select` de layout a `canWrite` apenas.

## 13. Índices
`company_id, branch_id, product_id, label_layout_id, print_batch_id, printed_label_id, status, created_at`.

## 14. Fluxos testados (UI)
- Sugestão sem associações → `label_category_default` ou `label_category_any`.
- Bloqueio de emissão nutricional em produto incompleto (via `product_pending_issues`).
- Emissão de N etiquetas cria N `printed_labels`, N snapshots, 1 evento `generated`.
- Reimpressão com motivo → novo evento `reprinted`, novas etiquetas com `reprint_of`.
- Cancelamento → lote/etiquetas viram `cancelled`, evento registrado.

## 15. Pendências / não-objetivos da fase
- Geração real de PDF/ZPL (apenas preview HTML).
- Renderização gráfica do QR Code/Barcode (payload textual).
- Driver de impressora real.
- Snapshot de ingredientes/alergênicos é stub (campos prontos, basta popular).

## 16. Compatibilidade com fases anteriores
- Nenhuma tabela, política, trigger, enum ou rota das Fases 1–3 foi removida ou renomeada.
- Novas colunas (`label_type`) são nullable; não alteram comportamento existente.
- Sidebar ganhou grupo "Emissão" sem mexer nos demais.

## 17. Próxima fase recomendada
**Fase 5 — Renderização e impressão real**: PDF a partir do snapshot, QR/Barcode reais, drivers por tipo de impressora (ZPL/PDF/gráfica externa), fila e re-tentativas.
