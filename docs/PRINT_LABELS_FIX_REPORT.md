# Correções — Tela "Emissão de Etiquetas"

## Ponto 1 — Seleção de impressora

**Limitação técnica:** navegadores web não expõem a lista de impressoras instaladas no sistema operacional (não há API padrão `navigator.printers`). Listar impressoras reais exigiria um agente local (impressão direta via USB/IP) que não faz parte do escopo atual.

**Solução aplicada (segura, sem dados falsos):**
- O seletor lista apenas as impressoras cadastradas em `printer_configs` da empresa.
- Rótulo renomeado para **"Impressora preferencial"** + nota explicativa indicando que a impressão usa o diálogo nativo do SO ao abrir o PDF.
- A impressora escolhida continua sendo persistida em `print_batches.printer_config_id` e no snapshot da emissão (rastreabilidade).
- O fluxo "Pré-visualizar PDF" abre o blob — o usuário aciona Ctrl+P/diálogo nativo e escolhe a impressora física.

**Arquivo alterado:** `src/routes/app.print-labels.tsx` (somente JSX do campo de impressora).

## Ponto 2 — Layout "Nutricional padrão 10x10" em branco

**Causa raiz:** o layout `65400b98-0cfa-4e42-a133-07118ad0f1a2` (status `ativo`, 100×100 mm) tinha **0 elementos** na versão vigente (`ed1d57a6-...`) e `label_type = NULL`. Sem elementos, `LabelPreview` renderizava a folha em branco e o PDF saía vazio.

**Solução aplicada (migration):**
1. `UPDATE label_layouts SET label_type = 'nutricional'` no layout 10x10 (passa a aparecer corretamente na sugestão automática).
2. Inseridos **12 elementos** escalonados para caber em 100×100 mm com margens de 2 mm:
   - `product_name` (10pt bold), `brand` (7pt), `ingredients` (5.5pt, 10mm de altura)
   - `nutrition_facts` (5.5pt, 42mm — bloco principal)
   - `allergens` (6pt bold), `preservation` (5.5pt)
   - linha lote / fabricação / validade (5.5pt, 3 colunas)
   - `weight` (5.5pt)
   - `barcode` (55×9 mm) e `qrcode` (10×9 mm) na base
3. Nenhum outro layout foi tocado — `Layout Nutricional Padrão 10x15` permanece com seus 12 elementos originais.

## Validações realizadas

- ✅ Build compila sem erros.
- ✅ Consulta confirma 12 elementos populados na versão vigente.
- ✅ Layout 10x15 e demais layouts ativos sem alteração.
- ✅ Sugestão automática (`suggest_label_layout`) agora retorna o 10x10 para emissões nutricionais quando aplicável.
- ✅ Geração de PDF e snapshots de emissão permanecem inalterados (mesmo pipeline).

## Não foi alterado

Banco (schema), RLS, permissões, autenticação, auditoria, fluxo de emissão, geração de PDF, snapshots, outros layouts, integrações.

## Riscos residuais

- Em produtos com tabela nutricional muito extensa, o bloco de 42 mm pode estourar; o `LabelPreview` já trata com overflow oculto. Se necessário, ajustar fonte para 5pt em revisão futura.
- Seleção real de impressora física só será possível com agente local de impressão (fora do escopo).
