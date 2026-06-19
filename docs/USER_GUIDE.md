# Guia do Usuário — IGA Gestão de Etiquetas

## 1. Como acessar o sistema
1. Abra a URL do sistema fornecida pela sua empresa.
2. Informe e-mail e senha na tela de login (`/auth`).
3. Caso tenha acesso a mais de uma empresa, selecione a empresa ativa no seletor no topo da barra lateral.

## 2. Como cadastrar um produto
1. No menu lateral, acesse **Cadastros → Produtos**.
2. Clique em **Novo produto**.
3. Preencha código, nome, categoria, marca, unidade e demais atributos.
4. (Opcional) Vincule ingredientes e alergênicos.
5. Salve. O produto aparecerá na lista e em **Painel de Pendências** caso falte alguma informação obrigatória.

## 3. Como cadastrar uma informação nutricional
1. Acesse **Nutricional → Informações Nutricionais**.
2. Clique em **Nova informação**.
3. Preencha porção, medida caseira e os valores nutricionais (kcal, carboidratos, proteínas, gorduras, sódio, etc.).
4. Salve. Cada salvamento gera uma nova versão; versões antigas permanecem para auditoria.
5. Vincule ao produto na tela do produto correspondente.

## 4. Como emitir uma etiqueta nutricional
1. Acesse **Operação → Emitir Etiquetas**.
2. Selecione o tipo *Nutricional*.
3. Escolha o produto. O sistema sugere o melhor layout disponível.
4. Defina quantidade, impressora e (se aplicável) lote/validade.
5. Clique em **Pré-visualizar** para conferir e em **Emitir** para gerar.
6. O PDF abre automaticamente para download/impressão.

## 5. Como emitir uma etiqueta de gôndola
1. Acesse **Operação → Emitir Etiquetas**.
2. Selecione o tipo *Gôndola*.
3. Escolha o produto — o preço vigente (e promoção, se houver) é carregado automaticamente.
4. Pré-visualize e emita. O PDF é gerado com preço destacado, código de barras e QR.

## 6. Como consultar o histórico
1. Acesse **Operação → Histórico de Emissões**.
2. Use os filtros (período, produto, layout, impressora, usuário).
3. Clique em um lote para ver detalhes, reimprimir ou cancelar.
4. Reimpressão sempre exige motivo e preserva o snapshot original (auditoria).

## 7. Como gerar PDF
- O PDF é gerado automaticamente ao emitir uma etiqueta.
- Para baixar novamente, abra o histórico → clique no lote → **Baixar PDF**.

## 8. Como interpretar o painel de pendências
1. Acesse **Operação → Pendências Regulatórias**.
2. Cada linha mostra um produto e o tipo de pendência:
   - **Sem nutricional**: produto não possui informação nutricional vigente.
   - **Sem categoria/marca**: cadastro incompleto.
   - **Sem alergênicos**: produto obrigatório sem declaração.
3. Clique em **Resolver** para ser levado ao cadastro correspondente.

## Dicas
- Use o **dashboard** (`/app`) para acompanhar emissões diárias, top produtos e reimpressões.
- Exportações (CSV/PDF) ficam disponíveis em **Relatórios**; toda exportação fica registrada na auditoria.
- Se um botão não aparece para você, é porque seu perfil não tem permissão — fale com o administrador.
