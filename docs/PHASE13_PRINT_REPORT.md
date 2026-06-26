# FASE 13 — Compatibilidade com Fabricantes, Drivers e Linguagens

## Arquivos criados

- `src/lib/print/drivers/types.ts` — interfaces `PrintDriver`, `AdapterContext`, `AdapterOutput`.
- `src/lib/print/drivers/driver-default.ts` — driver padrão (saída dimensional, sempre disponível).
- `src/lib/print/drivers/zpl.ts` — adapter Zebra (ZPL).
- `src/lib/print/drivers/epl.ts` — adapter Zebra/Eltron legado (EPL).
- `src/lib/print/drivers/pplb.ts` — adapter Argox (PPLB).
- `src/lib/print/drivers/tspl.ts` — adapter TSC/Elgin (TSPL).
- `src/lib/print/drivers/index.ts` — registry, `selectAdapter`, `renderWithAdapter`, validações cruzadas.
- `src/lib/print/drivers/drivers.test.ts` — 15 testes.

## Arquivos alterados

- `src/lib/print/direct-print.ts` — `buildAgentPayload` agora seleciona adapter por linguagem/fabricante, embute bloco `adapter` (linguagem solicitada, efetiva, fallback usado, maturity, avisos) e expõe `raw` quando o adapter produz comandos. `runDirectPrint` repassa o `raw` ao `PrintAgentClient.submit`.

## Linguagens suportadas

| Linguagem | Fabricantes típicos | Maturity | Saída |
|-----------|---------------------|----------|-------|
| `driver`  | qualquer (driver SO) | stable    | dimensional |
| `ZPL`     | Zebra                | prepared  | raw |
| `EPL`     | Zebra/Eltron legado  | prepared  | raw |
| `PPLB`    | Argox                | prepared  | raw |
| `TSPL`    | TSC, Elgin           | prepared  | raw |
| `DPL`     | Datamax              | fallback  | usa driver padrão / sugestão por fabricante |
| `PCL`     | laser/inkjet         | fallback  | usa driver padrão |
| `ESCP`    | Epson matricial      | fallback  | usa driver padrão |

> "Prepared" = estrutura básica do comando é gerada e validada, sem comandos avançados (fontes embutidas, bitmaps). Cabe ao Print Agent decidir emitir o `raw` diretamente ou cair para o payload dimensional.

## Estratégia de fallback

1. `printer.raw_language` reconhecida no registry → adapter direto.
2. Linguagem reconhecida mas não funcional (DPL/PCL/ESCP) → tenta `suggestLanguageForManufacturer(manufacturer)`. Se houver match, usa o adapter sugerido com aviso explícito.
3. Nada se encaixa → `DefaultDriver` com aviso.
4. PDF continua sendo o fallback operacional do orquestrador (`runDirectPrint` → `result.fallback = true`).

## Integração

- **Layout Engine (FASE 8)**: o adapter recebe o `DimensionalPayload` já normalizado, sem duplicar conversões.
- **Orquestrador (FASE 7)**: `buildAgentPayload` chama `renderWithAdapter` e injeta `raw`, `adapter`, `dimensional` no payload final.
- **Impressão em lote (FASE 12)**: usa `runDirectPrint` por item — adapter aplicado automaticamente.
- **PrintAgentClient (FASE 4)**: `submit` agora recebe opcionalmente `raw` (string) além do payload via `metadata.adapter`.
- **Fila/Histórico/Dashboard (FASES 9/10/11)**: preservados — o bloco `adapter` apenas amplia o `payload` JSONB.

## Validações antes de gerar o `raw`

- Dimensões > 0, DPI > 0, rotação ∈ {0,90,180,270}.
- Layout possui elementos.
- Compatibilidade impressora/layout continua sendo aplicada por `validateDirectPrint`.
- Limites de largura/altura da impressora seguem em `validateLayoutDimensions`.
- Se houver erro de validação, o adapter retorna `kind: 'dimensional'` (sem comandos brutos) e o agente cai no driver padrão — nunca emite raw inválido.

## Testes (15 novos, suíte total 138/138)

- Seleção por `raw_language` direto.
- Fallback para driver padrão (linguagem desconhecida).
- Fallback via sugestão por fabricante (DPL → TSPL quando manufacturer=TSC).
- Mapeamentos por fabricante (Zebra/Argox/Elgin/Datamax/Brother/Epson).
- Geração ZPL/EPL/PPLB/TSPL (formato dos comandos, copies, dimensões).
- Validação de DPI, rotação, dimensões e elementos vazios.
- Render integrado: ZPL `raw` + maturity `prepared`, driver padrão `dimensional`, fallback com aviso propagado.

## Como adicionar novo fabricante/linguagem

1. Criar `src/lib/print/drivers/<lang>.ts` exportando um `PrintDriver` com `language`, `maturity`, `validate`, `render`.
2. Registrar em `DRIVER_REGISTRY` e atualizar `DRIVER_MATURITY` em `drivers/index.ts`.
3. Opcional: adicionar regra em `MANUFACTURER_LANGUAGE` para sugerir a linguagem pelo nome do fabricante.
4. Acrescentar testes em `drivers/drivers.test.ts` cobrindo seleção, geração e fallback.

## Limitações conhecidas

- Adapters ZPL/EPL/PPLB/TSPL emitem apenas estrutura básica (cabeçalho, geometria, caixas de elementos, copies). Texto/código de barras/imagens ainda não são serializados em comandos nativos — o Print Agent pode renderizar via driver padrão.
- DPL/PCL/ESCP estão declarados como `fallback`: não há geração de comandos.
- Nenhum comando bruto é enviado a impressora real sem validação prévia (DPI, dimensão, rotação, elementos).
- O instalador nativo do Print Agent permanece fora do escopo (FASE 14+).

## Preservação confirmada

- **PDF**: intocado — `label-pdf.ts` não foi alterado.
- **Preview**: intocado — adapter atua apenas em `buildAgentPayload`.
- **Layouts cadastrados**: nenhuma migração ou ajuste de dados.
- **Emissão individual**: passa pelo mesmo `runDirectPrint`; falhas continuam caindo para PDF.
- **Emissão em lote**: idem.
- **Fila/Histórico/Dashboard**: schemas e consultas preservados.
- **Policies**: sem alterações.
