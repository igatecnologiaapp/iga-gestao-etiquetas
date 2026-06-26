# FASE 8 — Motor de Layout e Padronização Dimensional

Data: 2026-06-25
Status: Concluída

## 1. Resumo

Centralizamos a lógica dimensional da impressão direta em um motor puro,
sem alterar preview, PDF ou fluxo de emissão. Conversões cm/mm/px/pt agora
vivem em um único lugar, e o orquestrador da FASE 7 passou a delegar a
validação dimensional ao motor.

## 2. Arquivos criados/alterados

- **Novo** `src/lib/print/layout-engine.ts` — motor dimensional puro
  (conversões, geometria efetiva, validação, payload).
- **Novo** `src/lib/print/layout-engine.test.ts` — 27 testes.
- **Alterado** `src/lib/print/direct-print.ts` — `validateDirectPrint`
  delega a `validateLayoutDimensions`; `buildAgentPayload` agora inclui o
  bloco `dimensional` produzido por `buildDimensionalPayload`.
- **Alterado** `src/lib/print/direct-print.test.ts` — mensagem de erro
  alinhada ao motor (`área útil`).

Nenhum outro arquivo do app (preview, PDF, editor, emissão, snapshots)
foi tocado.

## 3. Regras de conversão (centralizadas)

| De → Para | Função | Notas |
|---|---|---|
| cm → mm | `toMm(v, "cm")` | × 10 |
| in → mm | `toMm(v, "in")` | × 25.4 |
| pt → mm | `toMm(v, "pt")` | 72pt = 1in |
| px → mm | `toMm(v, "px", dpi)` | requer DPI > 0 |
| mm → px | `mmToPx(v, dpi)` | base ISO 25.4 |
| mm → pt | `mmToPt(v)` | base 72/in |
| mm → cm | `mmToCm(v)` | ÷ 10 |

Constantes: `MM_PER_INCH = 25.4`, `PT_PER_INCH = 72`.

## 4. Formatos padrão suportados

- **Nutricional 10×10 cm** → `nutricional_10x10`
- **Nutricional 10×15 cm** → `nutricional_10x15`
- **Gôndola 10×3 cm** → `gondola_10x3`

`detectStandardFormat(w_mm, h_mm)` aplica tolerância de ±1 mm.

## 5. Validações implementadas

- Layout sem formato / dimensões ≤ 0
- Layout sem elementos
- Coordenadas + tamanho fora da **área útil real** (margens aplicadas)
- Margens que reduzem a área útil a zero ou negativo
- DPI inválido
- Escala fora de 10–400% (warning se ≠ 100%)
- Rotação fora de {0, 90, 180, 270}
- Largura/altura excedendo `max_width`/`max_height` da impressora
- Tipo do layout divergente do formato físico detectado (warning)

Margem efetiva = `max(margem_layout, margem_impressora)` — prevalece a maior.

## 6. Payload dimensional final

Bloco `dimensional` agora enviado ao Print Agent dentro de `buildAgentPayload`:

```
{
  width_mm, height_mm, width_cm, height_cm,
  width_px, height_px,
  dpi, scale, rotation,
  offset_x, offset_y,
  margins: { top, right, bottom, left },
  printable_area: { x, y, width, height },
  layout_type, detected_format,
  element_bounds: [{ element_id, x_mm, y_mm, width_mm, height_mm, within_printable_area }],
  raw_language,
  unit_conversion_info: { source_unit, mm_per_inch, pt_per_inch }
}
```

Estrutura preparada para futuras saídas em **ZPL / EPL / PPLB / TSPL** —
o motor entrega coordenadas em mm e px, área útil física, rotação e DPI;
basta um renderer por linguagem (fase futura).

## 7. Escala 100%

Default é 100%. Qualquer valor diferente é aplicado **explicitamente** e
registrado no payload (`dimensional.scale`), com warning na validação.
Não há redimensionamento implícito.

## 8. Testes executados

`bunx vitest run src/lib/print/` → **57/57 verdes**.

- `layout-engine.test.ts` (27): conversões, formatos, geometria, escala,
  margens, rotação, offsets, elementos fora da área, layout > impressora,
  payload completo.
- `direct-print.test.ts` (9): integração orquestrador + motor.
- `print-agent-client.test.ts` (14) e `printer-config-validation.test.ts`
  (7) inalterados — confirma que FASES 3/4/6 seguem verdes.

## 9. Preservação confirmada

- ✅ Preview (`src/components/label-preview.tsx`) **não alterado**.
- ✅ PDF (`src/lib/label-pdf.ts`) **não alterado**.
- ✅ Emissão (`src/routes/app.print-labels.tsx`) **não alterada** — usa
  o mesmo `runDirectPrint` da FASE 7, que agora apenas valida melhor.
- ✅ Fallback PDF preservado para falhas operacionais; layout inválido
  bloqueia o envio direto **e** o fallback (não mascara erro grave).
- ✅ Layouts cadastrados, policies e schema **não alterados**.

## 10. Limitações conhecidas

- Geradores ZPL/EPL/TSPL/PPLB ainda não implementados — payload está
  preparado; render acontecerá em fase posterior.
- Tolerância de ±1 mm para detecção de formato; layouts personalizados
  fora dos três padrões caem em `detected_format: null` (sem erro).
- Margens da impressora e do layout são combinadas pelo máximo; não há
  ainda UI para visualizar a margem efetiva (planejado para FASE 11).

## 11. Próximo

Aguardando autorização para iniciar a FASE 9.
