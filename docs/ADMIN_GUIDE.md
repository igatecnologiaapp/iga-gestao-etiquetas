# Guia do Administrador — IGA Gestão de Etiquetas

## 1. Como gerenciar usuários
1. Acesse **Administração → Usuários**.
2. Clique em **Novo usuário**, informe e-mail e nome. O usuário receberá convite.
3. Atribua um ou mais papéis em **Administração → Perfis** (Administrador, Supervisor, Operador, Consulta).
4. Para limitar acesso por filial, edite o usuário e selecione as filiais permitidas.

## 2. Como configurar empresas e filiais
1. Apenas Administradores globais acessam **Administração → Empresas**.
2. Crie/edite empresas (razão social, CNPJ, dados fiscais).
3. Dentro de cada empresa, acesse **Cadastros → Filiais** para criar unidades.
4. Use o seletor de empresa no topo da sidebar para trocar de contexto.

## 3. Como configurar permissões
1. Acesse **Administração → Perfis & Permissões**.
2. Cada papel (`administrador`, `supervisor`, `operador`, `consulta`) possui um conjunto padrão de permissões.
3. Permissões adicionais podem ser concedidas via `role_permissions` na base — recomendamos manter o padrão para garantir auditoria coerente.
4. Lembre-se: a UI esconde botões proibidos, mas a RLS no banco é a barreira final.

## 4. Como gerenciar layouts
1. **Layouts & Impressão → Central de Layouts**: lista de layouts ativos por categoria de etiqueta.
2. Crie um layout, escolha o formato (`label_formats`) e adicione elementos (texto, código de barras, QR, tabela nutricional, imagem).
3. Salve uma versão (`label_layout_versions`) para histórico.
4. Em **Associações**, vincule layouts a empresa, filial, marca, categoria ou produto. A sugestão automática usa a hierarquia: produto > categoria > marca > filial > empresa > padrão.

## 5. Como configurar impressoras
1. Acesse **Layouts & Impressão → Impressoras**.
2. Cadastre nome, IP/host, linguagem (`ZPL`, `EPL`, `ESC_POS`, `PDF`), protocolo e filial associada.
3. As impressoras aparecem na tela de emissão de etiquetas.

## 6. Como revisar auditoria
1. Acesse **Administração → Auditoria**.
2. Filtre por usuário, tabela, ação (INSERT/UPDATE/DELETE/EMIT/EXPORT) ou período.
3. Cada linha mostra os valores antigos e novos em JSON.
4. Eventos auditados: cadastros, alterações, inativações, emissão, reimpressão, cancelamento, exportação, alteração de preço, promoção, alteração de layout, alteração de permissões e operações de integração.

## 7. Como preparar integrações futuras
1. **Integrações → Configurações**: crie uma configuração (tipo: ERP, balança, e-commerce, WhatsApp, e-mail, webhook).
2. Adicione tokens (apenas hash é armazenado) e mapeamentos externos.
3. Use a tela de detalhe para acompanhar **Logs** e **Fila de Eventos**.
4. **Integrações → Templates** para editar mensagens de e-mail/WhatsApp com variáveis dinâmicas (`{{product_name}}`, `{{expiration_date}}`).
5. Importante: o worker que processa a fila e o envio efetivo são habilitados na Fase 11.

## Boas práticas
- Crie ao menos um **Supervisor por filial** para descentralizar suporte.
- Revise mensalmente o painel de pendências regulatórias.
- Exporte e arquive o relatório de auditoria periodicamente.
- Mantenha layouts ativos enxutos — desative os obsoletos para evitar confusão na emissão.
- Antes de habilitar integrações reais, valide credenciais em ambiente controlado.
