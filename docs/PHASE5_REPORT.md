# Fase 5 — Etiquetas Nutricionais, PDF e Impressão (Relatório Técnico)

## 1. Serviço único de PDF
Arquivo: `src/lib/label-pdf.ts`. API:
- `buildLabelsPdf({ format, elements, labels })` → `Promise<Blob>`.
- `buildFormatFromSnapshot(layoutSnapshot)` / `buildLabelDataFromSnapshot(snapshot, opts)` — adapters de snapshots para o serviço.
- `downloadBlob(blob, filename)` / `openBlob(blob)` — entrega ao navegador.

Características:
- Render fiel em milímetros (conversões mm/cm/in/px).
- Múltiplas etiquetas por página quando o formato definir `columns`/`rows`/`spacing_h`/`spacing_v` (folha A4 com centralização); caso contrário, página por etiqueta com tamanho exato do formato.
- Render por elemento da Central de Layouts: textos, linhas, caixas, imagens/logo, QR Code, código de barras e a tabela nutricional formatada (`nutrition_facts`).

## 2. Bibliotecas utilizadas (client-side)
- `jspdf@4.2.x` — geração do PDF no navegador.
- `qrcode@1.5.x` — QR Code (dataURL PNG, EC nível M).
- `jsbarcode@3.12.x` — código de barras (CODE128 com `displayValue`).

## 3. QR Code
Payload JSON contendo: `id` (unique_label_code), `product`, `internal_code`, `lot`, `mfg`, `exp`, `company_id`, `emitted_at`, e quando reimpresso `reprint=true`, `reprinted_at`, `reprint_reason`. Conteúdo é construído a partir do `emission_snapshot` original — reimpressão usa o mesmo payload do snapshot.

## 4. Código de barras
Regra: usar `EAN` do produto quando existir; caso contrário, usar `unique_label_code`. O valor textual aparece sob o código (CODE128 com `displayValue: true`).

## 5. Tabela nutricional
Renderizada via função `renderNutritionTable` no PDF e via componente `NutritionMini` no preview HTML. Linhas: valor energético, carboidratos, açúcares totais e adicionados, proteínas, gorduras totais/saturadas/trans, fibra, sódio. Coluna `%VD` calcula automaticamente quando a `nutrition_facts.daily_values` não fornece valor explícito (referências RDC: 200/50/22/55/25/2000 etc.).

## 6. Modelos nutricionais prontos
Migração semeia (idempotente, por empresa que tenha categoria `nutricional` + formatos 10x10 e 10x15):
- **Nutricional Padrão 10x10** — `is_default=true`, versão 1 com 12 elementos cobrindo nome, marca, código, tabela nutricional, ingredientes, alergênicos, conservação, lote, fabricação, validade, barcode e QR.
- **Nutricional Padrão 10x15** — versão 1 com 13 elementos (inclui campo `weight`).

## 7. Componentes alterados / criados
- **Criado** `src/lib/label-pdf.ts` (serviço de PDF + adapters).
- **Alterado** `src/components/label-preview.tsx` — passou a renderizar QR e código de barras reais (via `qrcode` e `jsbarcode`), miniatura da tabela nutricional, e a aceitar prop `data` com valores reais. Compatível com chamadas antigas (sem `data`).
- **Alterado** `src/routes/app.print-labels.tsx` — preview usa dados reais; novo botão "Pré-visualizar PDF" gera PDF antes da emissão.
- **Alterado** `src/routes/app.print-history.tsx` — botão "Baixar PDF do lote" por linha.
- **Alterado** `src/routes/app.print-history.$id.tsx` — botões "Visualizar PDF" e "Baixar PDF"; preview do snapshot usa dados reais; novos eventos `pdf_generated` / `pdf_downloaded` listados.

## 8. Novos eventos / enum
`print_event_type` recebeu dois valores adicionais sem remover existentes:
- `pdf_generated` — registrado quando o PDF é aberto/pré-visualizado.
- `pdf_downloaded` — registrado quando o usuário baixa o PDF.

## 9. Snapshot e imutabilidade
- PDF e preview do detalhe leem **somente** do `label_snapshots` (campos `layout_snapshot`, `product_snapshot`, `nutrition_snapshot`, `emission_snapshot`, etc.).
- Não há consulta atual a produtos/layouts ao gerar PDF — alterações posteriores não afetam etiquetas históricas.
- Reimpressão (Fase 4) já reaproveita o snapshot e mantém o mesmo serviço de PDF.

## 10. Validações antes da impressão nutricional
Reaproveita o pipeline da Fase 4 (`product_pending_issues` + `blockingIssuesForNutritional`):
- Produto ativo e sem pendência crítica.
- Informação nutricional vigente (não `em_revisao`).
- Ingredientes, alergênicos, validade e conservação preenchidos.
- Layout ativo, versão vigente, elementos obrigatórios preenchidos.
- Quantidade > 0.
- Geração de PDF a partir do detalhe exige snapshot presente (`disabled` no botão).

## 11. Auditoria
- Auditoria de tabela continua via `tg_audit_row()` sobre `print_batches/printed_labels/label_snapshots`.
- Eventos operacionais novos (`pdf_generated`, `pdf_downloaded`) gravados em `print_events` (RLS por empresa).

## 12. Fluxos testados (manual)
- Pré-visualização real com QR e barcode na tela de emissão.
- Emissão de etiqueta nutricional 10x10 → PDF gerado com tabela nutricional, ingredientes, alergênicos, lote, validade, QR e código de barras.
- Emissão 10x15 com peso preenchido — campo `weight` aparece no PDF.
- Bloqueio mantido: produto incompleto não emite (Fase 4).
- Lote com N etiquetas gera PDF com N renderizações (uma por página quando formato é 10x10/10x15).
- Reimpressão usa snapshot original (PDF refeito é idêntico ao original).
- Eventos `pdf_generated` / `pdf_downloaded` aparecem no histórico.
- Lista `/app/print-history` baixa PDF direto.

## 13. Permissões por perfil
| Ação | Admin | Supervisor | Operador | Consulta |
|---|---|---|---|---|
| Pré-visualizar PDF (emissão) | ✓ | ✓ | ✓ | ✗ |
| Emitir + PDF na confirmação | ✓ | ✓ | ✓ | ✗ |
| Baixar/Visualizar PDF (histórico) | ✓ | ✓ | ✓ | ✓* |
| Cancelar lote | ✓ | ✓ | ✗ | ✗ |
| Reimprimir | ✓ | ✓ | ✓ | ✗ |

*Consulta pode visualizar e baixar PDF de etiquetas já emitidas (somente leitura), em conformidade com a RLS de SELECT.

## 14. Pendências / não-objetivos da fase
- Impressão direta via driver de impressora térmica (ZPL/EPL) não implementada — PDF é a saída oficial nesta fase.
- Logo gráfico no PDF é um placeholder textual; basta colar `image_url` do produto/empresa.
- Snapshots ainda não populam `ingredients_snapshot`/`allergens_snapshot` com as junções; o serviço já lê esses arrays e cai no `commercial_description` quando vazio (compatível com produtos seed).
- Fila/spool de impressão não implementada.

## 15. Compatibilidade com fases anteriores
- Nenhuma tabela, política, trigger, enum, componente ou rota foi removida.
- Novos valores de enum (`pdf_generated`, `pdf_downloaded`) adicionados via `ALTER TYPE ... ADD VALUE IF NOT EXISTS` — compatível com Fase 4.
- `LabelPreview` mantém a assinatura antiga; o novo prop `data` é opcional.

## 16. Próxima fase recomendada
**Fase 6 — Impressão direta e logística**:
- Render server-side de PDF e fila persistente.
- Geração ZPL/EPL para impressoras térmicas (Zebra/Argox/Elgin).
- Workers de impressão por filial + status (queued / sent / acked / failed) e retry.
- Logotipo e marca d'água por empresa.
