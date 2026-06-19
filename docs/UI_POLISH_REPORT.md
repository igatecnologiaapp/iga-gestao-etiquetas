# Ajustes de Interface — Polimento Operacional

## Arquivos alterados
- `src/routes/auth.tsx` — textos, validação de e-mail, mostrar/ocultar senha, área de logotipo.
- `src/components/app-shell.tsx` — sidebar recolhível (desktop) + drawer mobile, persistência em `localStorage`.
- `src/routes/app.print-labels.tsx` — novo componente `FitPreview` que ajusta a etiqueta ao container preservando proporção.

## Ajustes aplicados
1. **Login**: frase substituída por "Gestão e emissão de etiquetas"; subfrase de "Fase 1" removida.
2. **Validação de e-mail**: regex client-side antes do envio; exibe "E-mail inválido." sob o campo (sem expor mensagens técnicas do backend; toast simplificado).
3. **Mostrar senha**: ícone olho dentro do input + link textual abaixo; default oculto; `aria-pressed`.
4. **Logotipo**: área reservada no topo esquerdo (painel lateral em desktop) e bloco visível em mobile dentro do card; estrutura pronta para receber URL de logo da empresa sem refactor.
5. **Sidebar recolhível**: botão "Recolher/Expandir" no rodapé do menu; quando recolhido mantém ícones + tooltips; ordem e grupos preservados integralmente; drawer separado em mobile com botão `Menu` no header.
6. **Pré-visualização**: `FitPreview` usa `ResizeObserver` para calcular o zoom ideal a partir da largura disponível e altura máxima (520px), mantendo proporção real do layout. Formatos 10×3, 10×10 e 10×15 ficam centralizados e proporcionais.

## Não foram alterados
- Banco de dados, migrações, RLS, GRANTs, triggers, auditoria.
- Lógica de emissão (`src/lib/label-emission.ts`), geração de PDF (`src/lib/label-pdf.ts`), snapshots imutáveis.
- Permissões por perfil, relatórios, integrações, layouts.
- Ordem dos itens/grupos do menu.

## Validações
- Build TypeScript: ok (erro `FitPreview` resolvido).
- Login: fluxo Supabase intacto (`signInWithPassword` inalterado).
- Sidebar: estado persiste entre navegações via `localStorage`.
- Preview: aspect ratio derivado de `format.width/height` × `UNIT_PX[unit]`.

## Pendências
- Upload real de logotipo da empresa (estrutura preparada; requer campo no cadastro de empresa — não solicitado nesta rodada).
