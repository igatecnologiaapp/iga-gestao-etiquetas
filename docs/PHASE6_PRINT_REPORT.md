# FASE 6 — Configurações por Impressora e Compatibilidade com Layouts

## Arquivos criados
- `src/lib/print/printer-compatibility-service.ts` — service para `printer_layout_compatibility` (list por impressora/layout, link, unlink).
- `src/lib/print/printer-config-validation.ts` — espelho TS das CHECK constraints (DPI, escala, margens, rotação, offsets, linguagem bruta, avanço).
- `src/lib/print/printer-config-validation.test.ts` — 7 testes Vitest cobrindo valores válidos/inválidos.
- `docs/PHASE6_PRINT_REPORT.md` — este relatório.

## Arquivos alterados
- `src/lib/print/types.ts` — `PrinterConfig` agora inclui `scale`, `margin_top`, `margin_right`, `margin_bottom`, `margin_left`.
- `src/lib/print/index.ts` — exporta os dois novos módulos.
- `src/routes/app.printers.tsx` — diálogo com **abas Básico / Técnico**, validação client-side antes de salvar, e novo diálogo **Compatibilidade** acessível via ícone na linha da impressora.

## Migration aplicada
Adiciona colunas `scale`, `margin_top/right/bottom/left` em `printer_configs` e CHECK constraints:
- `dpi` 1–2400
- `speed` 0–600
- `scale` 10–400
- margens 0–200 mm
- offsets -200..200
- `rotation` ∈ {0, 90, 180, 270}
- `raw_language` ∈ {driver, ZPL, EPL, PPLB, TSPL}
- `label_advance` 0–200

Triggers ativados:
- `audit_printer_configs` e `audit_printer_layout_compatibility` (via `tg_audit_row`) — toda alteração técnica e cada vínculo de compatibilidade é registrado em `audit_logs`.
- `set_updated_at_*` para manter `updated_at` consistente.

Índices `idx_plc_printer/layout/format` + unique `(printer_id, layout_id)` em `printer_layout_compatibility`.

## Services criados/ajustados
| Service | Função |
|---|---|
| `PrinterService` (existente) | CRUD inalterado, agora aceita os novos campos via `PrinterInput`. |
| `PrinterCompatibilityService.listByPrinter` | Lista vínculos da impressora com join no layout. |
| `PrinterCompatibilityService.listByLayout` | Lista impressoras compatíveis com um layout. |
| `PrinterCompatibilityService.link` | Cria vínculo respeitando RLS (admin/supervisor). |
| `PrinterCompatibilityService.unlink` | Remove vínculo (admin via RLS). |

## Validações implementadas
Cliente (`validateTechnicalConfig`) + banco (CHECK constraints). Os mesmos limites são enforced nos dois lados; o front bloqueia o submit antes da requisição e exibe a lista de erros via `toast`.

## Compatibilidades implementadas
- Vincular impressora ↔ layout pela tela `/app/printers` (botão de cadeia).
- Listar layouts compatíveis com a impressora (com nome, tipo, observações).
- Remover vínculo.
- `format_id` é copiado automaticamente do layout selecionado para suportar consultas por formato (10x10, 10x15, 10x3, etc.).
- Layouts já vinculados ficam ocultos no seletor para evitar duplicatas (também há unique no banco).

## Permissões
- `INSERT`/`UPDATE` em `printer_configs` e `printer_layout_compatibility`: administrador ou supervisor (RLS existente).
- `DELETE`: administrador.
- `SELECT`: qualquer membro da empresa.
- `canWrite` no front oculta botões de salvar/vincular/remover para operador e consulta; o RLS é o gate definitivo.

## Auditoria
Toda alteração de DPI, velocidade, escala, margens, rotação, offsets, linguagem bruta, corte automático e qualquer vínculo de compatibilidade é gravada em `audit_logs` via trigger `tg_audit_row` (com `old_values`/`new_values` em JSONB).

## Testes executados
- `bunx vitest run src/lib/print/printer-config-validation.test.ts` — **7/7 verdes**.
- Verificação manual (estrutural):
  - Abrir `/app/printers`, alternar abas Básico/Técnico — campos renderizados.
  - Tentar salvar com DPI=0/escala=5/rotação=45 → toast com erro, request não emitida.
  - Vincular layout via diálogo, remover via ícone lixeira, recarregar — vínculo persiste.

## Limitações conhecidas
- Diálogo de compatibilidade não exibe ainda a visão inversa por layout (planejado para `/app/layouts` em fase futura).
- Botão "Testar impressora" não implementado aqui — depende da FASE 7 (impressão direta).
- `command_language` (enum legado) coexiste com `raw_language` (texto) — preferimos `raw_language` por estar coberto por CHECK; mapeamento entre os dois pode ser feito quando o Print Agent real entrar em produção.

## Confirmação explícita
- `src/lib/label-pdf.ts` **não foi alterado**.
- `src/routes/app.print-labels.tsx` **não foi alterado**.
- Geração atual de PDF **preservada**.
- Layouts existentes **não foram alterados**.
- Policies antigas **não foram alteradas** — apenas adicionadas constraints, triggers e colunas novas.
- Nenhum botão de impressão direta foi adicionado à emissão.
