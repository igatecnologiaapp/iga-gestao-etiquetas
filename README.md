# Gestao Etiquetas

PROMPT MESTRE — SISTEMA DE GESTÃO E EMISSÃO DE ETIQUETAS

Crie um sistema web completo em Lovable + Supabase para gestão, criação, emissão, impressão e rastreabilidade de etiquetas nutricionais e etiquetas de gôndola.

O sistema deverá atender indústrias alimentícias, açougues, casas de carnes, frigoríficos, cozinhas industriais, padarias, varejos alimentícios e fabricantes de alimentos.

OBJETIVO GERAL

Construir uma plataforma escalável, segura, responsiva e multiempresa para:

- Cadastro completo de produtos.

- Cadastro de informações nutricionais.

- Cadastro de ingredientes, alergênicos, conservação e dados legais.

- Emissão de etiquetas nutricionais.

- Emissão de etiquetas de gôndola.

- Impressão individual e em lote.

- Reimpressão controlada.

- Central de Layouts totalmente parametrizável.

- Pré-visualização real das etiquetas.

- Exportação em PDF.

- Dashboards gerenciais.

- Auditoria completa.

- Controle de usuários, perfis e permissões.

- Preparação para integrações futuras com ERP, balanças, impressoras térmicas, WhatsApp, e-mail e APIs externas.

IMPORTANTE:

Não crie apenas telas estáticas. Crie banco de dados, relacionamentos, políticas RLS, componentes reutilizáveis, serviços, validações, auditoria, logs e fluxos funcionais.

A construção deve ser feita por fases, na ordem abaixo, evitando duplicidades, retrabalho, tabelas redundantes e regras críticas apenas no frontend.

REGRAS GERAIS DE ARQUITETURA

Antes de criar telas, defina corretamente a arquitetura inicial:

1. Usar Supabase como fonte única da verdade.

2. Criar banco relacional normalizado.

3. Ativar RLS desde o início nas tabelas sensíveis.

4. Criar ambiente multiempresa desde a primeira fase.

5. Toda tabela operacional deve conter company_id.

6. Quando aplicável, incluir branch_id para filiais.

7. Toda ação relevante deve ser registrada em audit_logs.

8. Toda impressão deve gerar registro histórico.

9. Todo layout deve possuir controle de versão.

10. Toda etiqueta emitida deve possuir ID único.

11. Separar regras de negócio, interface, serviços e consultas.

12. Evitar dependência de localStorage para dados críticos.

13. Validar permissões no backend, não apenas na interface.

14. Criar índices para campos de busca, filtros e relatórios.

15. Preparar a estrutura para milhares de produtos e milhões de etiquetas emitidas.

16. Evitar alterações que quebrem funcionalidades já existentes.

PERFIS DE ACESSO

Criar perfis:

- Administrador

- Supervisor

- Operador

- Consulta

Regras:

- Administrador possui acesso total.

- Supervisor pode gerenciar cadastros, aprovar revisões e acompanhar relatórios.

- Operador pode emitir etiquetas conforme permissão, sem alterar dados críticos.

- Consulta apenas visualiza informações permitidas.

- Permissões devem ser aplicadas por módulo e respeitadas via RLS.

FASE 1 — BASE TÉCNICA, SEGURANÇA E AUDITORIA

Criar:

- Estrutura multiempresa.

- Empresas.

- Filiais.

- Usuários.

- Perfis.

- Permissões.

- Configurações gerais.

- RLS.

- Auditoria.

- Logs de ações críticas.

Tabelas sugeridas:

- companies

- branches

- user_profiles

- roles

- permissions

- role_permissions

- user_branch_access

- system_settings

- audit_logs

Toda auditoria deve registrar:

- company_id

- branch_id, quando aplicável

- usuário

- ação

- tabela afetada

- registro afetado

- valor anterior

- valor novo

- data

- hora

- motivo, quando aplicável

- sessão ou IP, se disponível

FASE 2 — CADASTROS PRINCIPAIS

Criar cadastros de:

- Produtos

- Categorias

- Subcategorias

- Marcas

- Ingredientes

- Alergênicos

- Informações nutricionais

- Dados de conservação

- Dados legais

- Imagens do produto

Cadastro de produto deve conter:

- Código interno

- Código de barras EAN

- SKU

- Nome do produto

- Categoria

- Subcategoria

- Marca

- Unidade de medida

- Peso padrão

- Peso variável

- Descrição comercial

- Ingredientes

- Informação nutricional vinculada

- Alergênicos

- Contém glúten

- Não contém glúten

- Contém lactose

- Não contém lactose

- Conservação

- Modo de preparo

- Prazo de validade

- Temperatura de armazenamento

- Observações legais

- Imagens

- Status: ativo, inativo, pendente, revisão necessária

Categorias iniciais:

- Carnes

- Embutidos

- Espetinhos

- Hambúrgueres

- Congelados

- Temperados

- Industrializados

- Artesanais

- Outros

Regras:

- Código interno não pode duplicar dentro da empresa.

- SKU e EAN devem ser únicos quando preenchidos.

- Produto incompleto não pode gerar etiqueta nutricional.

- Alterações relevantes devem gerar auditoria.

- Criar painel de pendências regulatórias.

FASE 3 — INFORMAÇÃO NUTRICIONAL

Criar componente reutilizável de tabela nutricional.

Campos:

- Valor energético

- Carboidratos

- Açúcares totais

- Açúcares adicionados

- Proteínas

- Gorduras totais

- Gorduras saturadas

- Gorduras trans

- Fibra alimentar

- Sódio

- %VD

- Porção

- Medida caseira

- Quantidade por 100 g ou 100 ml

- Número de porções por embalagem

- Data da atualização

- Responsável

- Versão

- Status: vigente, em revisão, substituída, inativa

Permitir:

- Cadastro manual.

- Importação CSV.

- Importação Excel.

- Duplicação de tabela nutricional.

- Histórico de alterações.

- Controle de versões.

Regras:

- Nunca sobrescrever versão antiga.

- Produto deve apontar para a versão vigente.

- Alteração nutricional deve poder exigir aprovação antes da impressão.

- Criar estrutura para aprovação de revisão nutricional.

- Registrar responsável, motivo, data e hora da alteração.

FASE 4 — CENTRAL DE LAYOUTS

Criar módulo chamado:

Central de Layouts

A Central de Layouts deve funcionar como motor de impressão independente das regras de negócio dos produtos.

Permitir:

- Criar layouts.

- Editar layouts.

- Duplicar layouts.

- Versionar layouts.

- Arquivar layouts.

- Restaurar versões antigas.

- Definir layout padrão.

- Ativar e desativar layouts.

- Organizar por categoria.

- Associar layouts a produtos, categorias, marcas, departamentos, empresas, filiais e impressoras.

Status de layout:

- Ativo

- Inativo

- Arquivado

Categorias nativas:

- Etiquetas Nutricionais

- Etiquetas de Gôndola

- Etiquetas Promocionais

- Etiquetas de Produção

- Etiquetas Logísticas

- Etiquetas de Expedição

- Etiquetas de Identificação

- Etiquetas de Validade

- Outros

Formatos obrigatórios iniciais:

- Nutricional 10x10

- Nutricional 10x15

- Gôndola 10x3

- A4

- Carta

- Zebra padrão

- Argox padrão

- Elgin padrão

- Personalizado

Permitir formatos ilimitados com:

- Largura

- Altura

- Margens

- Espaçamento

- Área útil

- Orientação

- Colunas

- Linhas

- Unidade: cm, mm, polegadas ou pixels

FASE 5 — EDITOR VISUAL E PRÉ-VISUALIZAÇÃO

Criar editor visual Drag and Drop para layouts.

Elementos disponíveis:

- Nome do produto

- Código interno

- SKU

- Código de barras

- QR Code

- Logotipo

- Marca

- Peso

- Lote

- Validade

- Data de fabricação

- Ingredientes

- Conservação

- Alergênicos

- Glúten

- Lactose

- Informações nutricionais

- Preços

- Campos personalizados

- Textos fixos

- Imagens

- Linhas

- Caixas

- Separadores

Permitir:

- Arrastar.

- Redimensionar.

- Alinhar.

- Agrupar.

- Bloquear.

- Duplicar.

- Remover.

- Reordenar camadas.

- Ajustar fonte, cor, tamanho, bordas e alinhamento.

- Usar grade e snap to grid.

- Pré-visualizar com dados reais.

Criar componente reutilizável de pré-visualização de etiquetas contendo:

- Simulação exata da etiqueta.

- Dimensões reais.

- Zoom.

- Ajuste automático.

- Visualização de impressão.

- Visualização em PDF.

- Comparação entre versões.

- Visualização lado a lado.

- Teste antes da impressão.

FASE 6 — IMPRESSORAS E COMPATIBILIDADE

Criar cadastro de impressoras:

- Nome

- Fabricante

- Modelo

- Tipo

- Local ou setor

- Largura máxima

- Altura máxima

- Resolução DPI

- Tipo de papel

- Tipo de bobina

- Tipo de conexão

- Status

- Observações

- Impressora padrão

Fabricantes sugeridos:

- Zebra

- Argox

- Elgin

- Datamax

- TSC

- Brother

- Epson

- HP

- Canon

- Outros

Regras:

- Associar impressoras a formatos compatíveis.

- Validar compatibilidade antes da impressão.

- Permitir impressora padrão por empresa, filial, setor, usuário ou tipo de etiqueta.

FASE 7 — EMISSÃO DE ETIQUETAS

Criar fluxo de emissão:

- Seleção de tipo de etiqueta.

- Seleção de produto.

- Seleção automática ou manual de layout.

- Seleção de impressora.

- Quantidade de etiquetas.

- Peso, quando variável.

- Lote.

- Data de fabricação.

- Validade.

- Pré-visualização.

- Geração de PDF.

- Confirmação de impressão.

- Registro histórico.

Permitir:

- Impressão individual.

- Impressão em lote.

- Reimpressão.

- Impressão por produto.

- Impressão por categoria.

- Impressão por marca.

- Impressão por fornecedor.

- Impressão por promoção ativa.

Criar serviço único para:

- Geração de PDF.

- Registro de impressão.

- Auditoria.

- Seleção de layout.

- Validação de pendências.

Toda etiqueta emitida deve conter:

- ID único.

- Número sequencial.

- QR Code.

- Código de barras.

- Produto.

- Layout.

- Versão do layout.

- Usuário.

- Data e hora.

- Lote.

- Snapshot completo dos dados usados.

FASE 8 — ETIQUETAS NUTRICIONAIS

Criar emissão de etiquetas nutricionais com:

- Formato 10x10.

- Formato 10x15.

- Formatos personalizados.

- Tabela nutricional completa.

- Ingredientes.

- Alergênicos.

- Glúten.

- Lactose.

- Conservação.

- Lote.

- Fabricação.

- Validade.

- Peso.

- QR Code.

- Código de barras.

- Logotipo.

- Alertas frontais quando aplicável.

Regras:

- Bloquear impressão se faltar informação obrigatória.

- Bloquear impressão se informação nutricional estiver pendente de aprovação.

- Registrar versão nutricional usada.

- Registrar versão do layout usado.

- Preservar snapshot histórico.

FASE 9 — ETIQUETAS DE GÔNDOLA

Criar emissão de etiquetas de gôndola.

Formato padrão:

- 10x3 cm

Campos:

- Código do produto

- Código de barras

- Nome do produto

- Marca

- Unidade de venda

- Preço normal

- Preço promocional

- Data inicial da promoção

- Data final da promoção

- QR Code opcional

Modelos:

- Simples

- Promocional

- Atacado

- Personalizado

Criar controle de preços e promoções:

- Preço normal

- Preço promocional

- Preço por quantidade

- Regras da promoção

- Status: ativa, agendada, encerrada, cancelada

- Histórico de alterações de preços

FASE 10 — DASHBOARDS, RELATÓRIOS E PENDÊNCIAS

Criar dashboards com filtros globais por:

- Empresa

- Filial

- Produto

- Categoria

- Marca

- Layout

- Impressora

- Período

- Usuário

Indicadores:

- Etiquetas emitidas por período.

- Quantidade impressa.

- Produtos mais impressos.

- Layouts mais utilizados.

- Impressões por usuário.

- Impressões por impressora.

- Reimpressões.

- Produtos pendentes de informação nutricional.

- Produtos sem ingredientes.

- Produtos sem alergênicos.

- Produtos sem validade.

- Layouts inativos.

- Histórico de alterações.

Relatórios:

- PDF

- Excel

- CSV

FASE 11 — PERFORMANCE E SEGURANÇA

Implementar:

- Paginação em listagens.

- Filtros eficientes no banco.

- Índices nos campos de busca.

- Cache controlado.

- React Query ou equivalente.

- Separação de consultas pesadas.

- Componentização.

- Lazy loading quando aplicável.

- Validações no banco e na aplicação.

- RLS em todas as tabelas sensíveis.

- Logs de ações críticas.

- Serviços reutilizáveis para regras centrais.

Evitar:

- Duplicidade de tabelas.

- Regras críticas repetidas apenas no frontend.

- Carregamento desnecessário de grandes volumes.

- localStorage para dados sensíveis.

- Sobrescrita de versões históricas.

- Exclusão física de dados auditáveis.

FASE 12 — INTEGRAÇÕES FUTURAS

Preparar arquitetura para integração futura com:

- ERP

- Balanças etiquetadoras

- Impressoras Zebra

- Argox

- Elgin

- Datamax

- TSC

- WhatsApp

- E-mail

- APIs externas

- Ficha técnica dos produtos

- Controle de produção

Criar estrutura base para:

- Configurações de integração.

- Logs de integração.

- Webhooks.

- Tokens de APIs externas.

- Templates de e-mail.

- Templates de WhatsApp.

- Integrações desativadas por padrão.

TABELAS PRINCIPAIS SUGERIDAS

Criar ou adaptar, conforme necessidade:

- companies

- branches

- user_profiles

- roles

- permissions

- role_permissions

- audit_logs

- products

- product_categories

- product_subcategories

- brands

- ingredients

- allergens

- product_allergens

- nutritional_infos

- nutritional_info_versions

- label_categories

- label_formats

- label_layouts

- label_layout_versions

- label_layout_elements

- label_custom_fields

- layout_associations

- printer_configs

- printer_format_compatibility

- print_batches

- printed_labels

- label_snapshots

- product_prices

- product_price_history

- promotions

- promotion_products

- integration_configs

- integration_logs

CRITÉRIOS FINAIS DE ACEITE

O sistema será considerado bem estruturado quando:

- Possuir base multiempresa com company_id nas tabelas operacionais.

- RLS estiver ativo e funcional.

- Usuários, perfis e permissões estiverem aplicados.

- Produtos puderem ser cadastrados com dados completos.

- Informações nutricionais tiverem versionamento.

- Produtos incompletos forem bloqueados para etiqueta nutricional.

- Existir painel de pendências regulatórias.

- Central de Layouts permitir criação de layouts sem alteração de código.

- Layouts possuírem versão, status e associação.

- Etiquetas 10x10, 10x15, 10x3, A4 e personalizadas estiverem disponíveis.

- Impressoras puderem ser cadastradas e associadas.

- Pré-visualização funcionar antes da impressão.

- PDF ser gerado por serviço único.

- Toda impressão gerar histórico e snapshot.

- Toda etiqueta possuir ID único.

- Reimpressões serem auditadas.

- Dashboards e relatórios funcionarem com filtros globais.

- O sistema estiver responsivo em desktop e mobile.

- A arquitetura estiver preparada para crescimento e integrações futuras.

AO FINAL DE CADA FASE

Gerar relatório técnico informando:

- O que foi implementado.

- Tabelas criadas ou alteradas.

- Componentes criados.

- Serviços criados.

- Políticas RLS aplicadas.

- Regras de auditoria.

- Validações implementadas.

- Fluxos testados.

- Pendências encontradas.

- Próxima etapa recomendada.

Execute somente a FASE 1 do Sistema de Gestão e Emissão de Etiquetas.

Objetivo desta etapa:

Criar a base técnica, segura e escalável do sistema antes de desenvolver telas operacionais.

Implementar:

1. Estrutura multiempresa:

- companies

- branches

- company_id nas tabelas operacionais futuras

- branch_id quando aplicável

2. Autenticação e usuários:

- Supabase Auth

- user_profiles

- vínculo do usuário com empresa e filial

3. Perfis e permissões:

- Administrador

- Supervisor

- Operador

- Consulta

- roles

- permissions

- role_permissions

- user_branch_access

4. Segurança:

- Ativar RLS nas tabelas sensíveis

- Criar políticas por perfil

- Não depender apenas do frontend para controle de acesso

5. Auditoria:

- Criar audit_logs

- Registrar usuário, ação, tabela, registro afetado, valor anterior, valor novo, data, hora e motivo quando aplicável

6. Configurações gerais:

- system_settings

- estrutura preparada para fases futuras

Não implemente ainda produtos, etiquetas, layouts, impressão ou dashboards.

Ao final, entregue relatório técnico com:

- Tabelas criadas

- Políticas RLS aplicadas

- Perfis e permissões criados

- Fluxos testados

- Pendências encontradas

- Próxima fase recomendada

This project was built with [Lovable](https://lovable.dev).

**Live app**: https://iga-gestao-etiquetas.lovable.app

## Build with Lovable

Continue developing this project in the [Lovable editor](https://lovable.dev/projects/c43457fb-4e63-49d9-9d16-56fffee03149).

- **Ship faster**: describe what you want to build and Lovable handles the code.
- **Stay in sync**: every change made in Lovable is committed straight to this repository.
- **Full ownership**: this code is yours. Push to `main` on GitHub and your changes sync back into Lovable, ready for your next prompt.

## Development

Prefer working locally? You need Node.js and npm — [install with nvm](https://github.com/nvm-sh/nvm#installing-and-updating).

```sh
git clone <this-repository-url>
cd <repository-name>
npm i
npm run dev
```
