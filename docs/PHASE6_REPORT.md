# Fase 6 — Preços, Promoções e Etiquetas de Gôndola

## Resumo
Implementada gestão de preços por produto, promoções com período de vigência, vínculo de produtos a promoções, histórico de alteração de preços e fluxo de emissão de etiquetas de gôndola (modelos Simples, Promocional, Atacado e Personalizada) usando o mesmo serviço de PDF e snapshot já existentes.

## Tabelas criadas
| Tabela | Função |
|---|---|
| `product_prices` | Preço normal, atacado e promocional vigente por produto (com filial opcional). |
| `product_price_history` | Auditoria do histórico de alterações de preço (motivo + responsável). |
| `promotions` | Cabeçalho de promoção (nome, descrição, período, status). |
| `promotion_products` | Produtos vinculados a uma promoção com preços/regras específicos. |

### Enum
`promotion_status` — `draft | scheduled | active | ended | cancelled`

### Funções auxiliares
- `public.get_active_promotion_for_product(_company_id, _product_id)` — retorna promoção ativa vigente do produto.

### Seeds
- Formato de etiqueta `Gôndola 10x3` criado para cada empresa (10 × 3 cm, horizontal).

## Políticas RLS
Todas as tabelas têm RLS habilitada e seguem o padrão das fases anteriores:
| Operação | Quem pode |
|---|---|
| SELECT | Membros da empresa (`is_company_member`) |
| INSERT / UPDATE | `administrador` ou `supervisor` |
| DELETE (`promotions`, `product_prices`) | Apenas `administrador` |
| DELETE (`promotion_products`) | `administrador` ou `supervisor` |
| `product_price_history` | SELECT membro, INSERT writer (somente append) |

GRANTs explícitos para `authenticated` (SELECT/INSERT/UPDATE/DELETE) e `service_role` (ALL).

## Auditoria
Triggers `tg_audit_row` aplicadas em `product_prices`, `promotions` e `promotion_products`. Toda alteração de preço também grava linha em `product_price_history` (motivo opcional, usuário responsável e timestamp).

## Componentes / serviços
- `src/lib/label-pdf.ts` — adicionado `formatBRL` e novos elementos: `regular_price`, `promotional_price`, `previous_price`, `wholesale_price`, `wholesale_min_quantity`, `promotion_name`, `promotion_rules`, `promotion_period`, `promotion_start`, `promotion_end`, `sale_unit`. Snapshot adapter `buildLabelDataFromSnapshot` agora popula automaticamente os campos de preço/promoção a partir do `emission_snapshot`.
- `src/components/label-preview.tsx` — mesmos novos campos refletidos no preview HTML.
- `src/lib/label-emission.ts` — exporta `SHELF_MODELS`, `ShelfModel`, `isShelfLabel`.

## Telas
| Rota | Função |
|---|---|
| `/app/prices` | Lista de produtos com preço normal, atacado e promocional vigente. Edição via diálogo (somente admin/supervisor). Histórico de preços por produto. |
| `/app/promotions` | CRUD de promoções, alternar status (rascunho, agendada, ativa, encerrada, cancelada). Diálogo de produtos vinculados com preços e regras de atacado. |
| `/app/print-labels` | Estendida: ao selecionar tipo Gôndola/Promocional surge seletor de modelo (Simples, Promocional, Atacado, Personalizada), seletor de promoção ativa, painel de preços; validações nutricionais são puladas e novas validações de preço/promoção são aplicadas. |
| `/app/print-history` | Já contemplava filtro por `label_type` — passa a permitir filtrar nutricional vs gôndola. |

Sidebar atualizada com entradas **Preços** e **Promoções** no grupo *Cadastros*.

## Regras de preço
- Preço normal obrigatório por produto antes de emitir etiqueta de gôndola.
- Atacado opcional, mas exigido para o modelo *Gôndola Atacado* (preço + qtd. mínima).
- Promocional vigente pode ser definido manualmente em `product_prices.current_promotional_price` ou derivado de promoção ativa.
- Qualquer alteração que mude valor normal/promocional/atacado grava linha em `product_price_history`.

## Regras de promoção
- Promoção ativa = `status='active'` AND `start_date <= now() <= end_date`.
- Produto pode estar em mais de uma promoção; o emissor lista todas as ativas, o `get_active_promotion_for_product` retorna a de menor preço promocional.
- Operações de status (ativar, agendar, encerrar, cancelar) e exclusão são auditadas via `tg_audit_row`.
- Cancelamento e encerramento preservam o vínculo histórico (não apaga `promotion_products`).

## Regras de PDF para gôndola
- Mesmo serviço `buildLabelsPdf` é usado — o formato vem do layout (`Gôndola 10x3` ou outro 10×3 cm).
- Elementos novos (`regular_price`, `promotional_price`, `previous_price`, `wholesale_price`, etc.) são renderizados como texto comum, respeitando alinhamento, fonte e camada definidos no editor de layouts.
- Snapshot inclui `regular_price`, `promotional_price`, `previous_price`, `wholesale_price`, `wholesale_min_quantity`, `promotion_id`, `promotion_name`, `promotion_rules`, `promotion_start`, `promotion_end`, `sale_unit` e `shelf_model`.
- Reimpressão usa o snapshot original — alterar preços ou cancelar promoção depois não muda o PDF reimpresso.

## Fluxos testados
1. Criar preço normal para produto e ver histórico após nova alteração.
2. Criar promoção (rascunho → agendada → ativa) e vincular produto com preço promocional.
3. Emitir etiqueta nutricional (continua funcionando como na fase 5).
4. Emitir gôndola Simples → bloqueia se produto sem preço normal.
5. Emitir gôndola Promocional → bloqueia se sem promoção ativa; com promoção, gera PDF com preço de/por.
6. Emitir gôndola Atacado → bloqueia sem preço/qtd. mínima de atacado.
7. Reimprimir um lote de gôndola após cancelar a promoção → PDF mantém preço original (snapshot).
8. Filtrar histórico por tipo `gondola` vs `nutricional`.

## Testes por perfil
| Perfil | Preços | Promoções | Emissão gôndola |
|---|---|---|---|
| Administrador | criar/editar/excluir | criar/editar/excluir | sim |
| Supervisor | criar/editar | criar/editar | sim |
| Operador | leitura | leitura | sim (não altera preço/promoção) |
| Consulta | leitura | leitura | bloqueado |

## Pendências encontradas
- Não há layouts pré-prontos de gôndola (simples/promocional/atacado) seedados ainda — usuário pode criá-los na Central de Layouts apontando para o formato `Gôndola 10x3` recém-criado.
- Emissão em lote por categoria/marca/fornecedor está prevista mas ainda não implementada (atualmente é por produto + quantidade). Pode ser adicionada na próxima iteração.
- Dashboard básico de promoções/etiquetas foi mantido fora do escopo desta fase para evitar regressão; pode entrar na Fase 7.

## Próxima fase recomendada
**Fase 7 — Lotes massivos e Dashboard operacional**: emissão massiva por categoria/marca/fornecedor, geração de PDF agendada, dashboard com promoções ativas, etiquetas emitidas por período e produtos mais impressos.
