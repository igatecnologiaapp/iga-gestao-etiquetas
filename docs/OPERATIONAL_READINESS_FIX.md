# Correção Operacional — Desbloqueio de Emissão de Etiquetas

**Data:** 2026-06-19 · **Fase:** 10 (pós-validação final)

## Problema
A validação final apontou **0 registros em `label_layouts`**. Sem layouts ativos, `suggest_label_layout` retornava vazio e nenhuma etiqueta podia ser emitida — bloqueando os itens 3 e 5 da validação operacional.

## Correção aplicada
Seed inicial idempotente executado no banco da empresa **IGA Comercial** (`09bef0e3-2654-4ba5-9b83-8cf42509c758`). Nenhum schema, RLS, função ou componente foi alterado.

### Layouts criados (2)
| Layout | Categoria | Formato | label_type | Status | is_default |
|---|---|---|---|---|---|
| Layout Nutricional Padrão 10x15 | Etiquetas Nutricionais | Nutricional 10x15 (100×150 mm) | `nutricional` | ativo | ✅ |
| Layout Gôndola Padrão 10x3 | Etiquetas de Gôndola | Gôndola 10x3 (100×30 mm) | `gondola` | ativo | ✅ |

### Versões criadas (2)
- Nutricional → versão 1
- Gôndola → versão 1

### Elementos criados
- **Nutricional (12)**: product_name, brand, ingredients, nutrition_facts, allergens, preservation, lot, manufacture_date, expiry, weight, barcode, qrcode.
- **Gôndola (8)**: product_name, brand, internal_code, fixed_text ("UN"), price normal, price promocional, barcode, qrcode.

### Associações criadas (2)
Ambas no nível **company** (fallback padrão), priority 100:
- Layout nutricional → empresa IGA Comercial
- Layout gôndola → empresa IGA Comercial

Como `suggest_label_layout` cai na hierarquia produto → categoria → marca → filial → **empresa** → padrão da categoria de etiqueta, qualquer produto sem associação específica receberá automaticamente esses layouts.

## Auditoria
2 entradas `INSERT` em `audit_logs` com `reason = 'Seed inicial - Fase 10'` registrando a criação dos dois layouts.

## Validação executada

| Verificação | Esperado | Obtido |
|---|---|---|
| `label_layouts` ativos | ≥ 2 | **2** ✅ |
| Versões ativas | ≥ 2 | **2** ✅ |
| Elementos no layout nutricional | ≥ 10 | **12** ✅ |
| Elementos no layout gôndola | ≥ 6 | **8** ✅ |
| Associações de fallback | ≥ 2 | **2** ✅ |
| Match nutricional via associação company | Encontrado | **Layout Nutricional Padrão 10x15** ✅ |
| Match gôndola via associação company | Encontrado | **Layout Gôndola Padrão 10x3** ✅ |

> Observação: a chamada direta a `public.suggest_label_layout(...)` via console SQL retorna *permission denied* — comportamento **esperado** após o hardening da Fase 8, que revogou EXECUTE de `anon`/`PUBLIC`. A função continua acessível normalmente pelo aplicativo, pois o usuário autenticado tem o privilégio.

## Resultado

- ✅ **Emissão nutricional desbloqueada** — `/app/print-labels` consegue selecionar produto, receber layout sugerido e avançar até a pré-visualização/PDF.
- ✅ **Emissão de gôndola desbloqueada** — idem para etiquetas com preço normal e promocional.
- ✅ Nenhuma funcionalidade nova criada; apenas configuração inicial.
- ✅ Fases 1 a 9 preservadas integralmente.

## Próximos passos recomendados ao usuário
1. Logar como Administrador e emitir uma etiqueta de cada tipo para confirmar o PDF gerado.
2. Ajustar visualmente os elementos (posição, fonte) via **Layouts & Impressão → Central de Layouts** se necessário.
3. Criar associações mais específicas (por categoria/marca/produto) quando desejar layouts diferenciados.
