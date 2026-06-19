# Fase 2 — Cadastros Principais (Relatório Técnico)

## Tabelas criadas

| Tabela | Pertence a | Observações |
|---|---|---|
| `categories` | `company_id` | Auto-referência via `parent_id` para subcategorias. UNIQUE `(company_id, parent_id, name)`. |
| `brands` | `company_id` | UNIQUE `(company_id, name)`. |
| `ingredients` | `company_id` | UNIQUE `(company_id, name)`. |
| `allergens` | `company_id` | Inclui `code`. UNIQUE `(company_id, name)`. |
| `nutrition_facts` | `company_id` | Versionada via `version` + `status` (vigente / em_revisao / substituida / inativa). Nunca sobrescreve — UI usa "duplicar". |
| `products` | `company_id`, `branch_id` | Todos os campos do prompt (códigos, EAN, SKU, categoria, subcategoria, marca, unidade, peso, descrição, conservação, validade, etc.). |
| `product_ingredients` | `company_id` | N:N produto ↔ ingrediente com `position` e `quantity`. |
| `product_allergens` | `company_id` | N:N produto ↔ alergênico com flag `may_contain`. |
| `product_pending_issues` (view) | — | `security_invoker = on`. Calcula em runtime as pendências regulatórias por produto. |

### Enums novos / alterados
- `entity_status` ganhou o valor `revisao_necessaria`.
- `nutrition_status` criado: `vigente`, `em_revisao`, `substituida`, `inativa`.

## RLS aplicadas

Padrão por tabela operacional:

- **SELECT**: `is_company_member(auth.uid(), company_id)` — qualquer membro da empresa lê.
- **INSERT**: `has_any_role(... , ['administrador','supervisor'])` (em `products`, também `operador`).
- **UPDATE**: `has_any_role(... , ['administrador','supervisor'])`.
- **DELETE**: `has_role(... , 'administrador')`.
- Tabelas de vínculo (`product_ingredients`, `product_allergens`): leitura para membros, escrita para Administrador/Supervisor.
- Perfil **Consulta** não recebe permissão de escrita em nenhuma tabela da Fase 2 (validado tanto no RLS quanto na UI).

## Auditoria

- Função `tg_audit_row()` atualizada para detectar `company_id` e `branch_id` automaticamente em qualquer tabela.
- Triggers `AFTER INSERT OR UPDATE OR DELETE` ativos em **todas** as tabelas da Fase 2 (incluindo as tabelas de vínculo).
- Registros aparecem em `/app/audit` filtrados por empresa.

## Componentes criados

- `src/hooks/use-active-company.ts` — empresa ativa, papel atual e flags de permissão (`canWrite`, `canDelete`, `canCreateProduct`, `isReadOnly`).
- `src/components/company-switcher.tsx` — seletor de empresa no header.
- `src/components/page-header.tsx` — cabeçalho padrão das telas.
- `src/components/status-badge.tsx` — badge colorido por status.
- `src/components/nutrition-table.tsx` — tabela nutricional reutilizável (usada nos detalhes do produto e na pré-visualização da tabela).
- `src/components/simple-crud.tsx` — CRUD genérico com busca, filtro por status e paginação (reaproveitado por Marcas / Ingredientes / Alergênicos).

## Telas criadas

| Rota | Função |
|---|---|
| `/app/products` | Listagem + criação/edição completa do produto, com vínculos a categoria, subcategoria, marca, ingredientes, alergênicos e tabela nutricional. Detalhe e inativação. |
| `/app/categories` | Categorias com hierarquia (raiz ↔ subcategoria via `parent_id`). |
| `/app/brands` | CRUD via `SimpleCrud`. |
| `/app/ingredients` | CRUD via `SimpleCrud`. |
| `/app/allergens` | CRUD via `SimpleCrud` (campos nome + código). |
| `/app/nutrition` | CRUD versionado com duplicar para gerar nova versão; visualização da tabela. |
| `/app/pending` | Painel de pendências regulatórias derivado da view `product_pending_issues`. |

Sidebar reorganizada em três grupos: **Geral**, **Cadastros** e **Administração**. Header passa a exibir o seletor de empresa em todas as telas.

## Dados de exemplo (empresa IGA Comercial)

- Categorias iniciais: Carnes, Embutidos, Espetinhos, Hambúrgueres, Congelados, Temperados, Industrializados, Artesanais, Outros.
- Marca: IGA.
- Ingredientes: Carne bovina, Carne suína, Frango, Sal, Alho, Cebola, Pimenta-do-reino.
- Alergênicos: Glúten, Lactose, Soja.
- Tabelas nutricionais (vigentes): Espeto Bovino Temperado v1, Hambúrguer Artesanal v1, Linguiça Toscana v1.
- Produtos:
  - **Espeto Bovino Temperado** — completo (ativo).
  - **Hambúrguer Artesanal** — completo (ativo).
  - **Linguiça Toscana** — completo (ativo).
  - **Frango Temperado Congelado** — intencionalmente incompleto (pendente) para validar o painel de pendências.

## Fluxos testados

1. Administrador cria/edita marcas, ingredientes, alergênicos e categorias (incluindo subcategoria).
2. Administrador cadastra produto vinculando categoria/subcategoria/marca/ingredientes/alergênicos/tabela nutricional.
3. Administrador cria nova tabela nutricional ou duplica versão vigente.
4. Painel `/app/pending` lista corretamente produtos incompletos (ex.: Frango Temperado Congelado aparece com 5 motivos).
5. Auditoria registra criação/edição/inativação em `/app/audit`.

## Pendências conhecidas

- Upload de imagem do produto: por enquanto aceita URL externa (`image_url`). Storage bucket dedicado fica para fase futura.
- Linter Supabase mantém **7 WARN** para funções `SECURITY DEFINER` chamáveis por usuários autenticados (`has_role`, `has_any_role`, `is_company_member`, `is_global_admin`, `log_audit`, `handle_new_user`, `tg_audit_row`). São **funções herdadas da Fase 1** exigidas pelo próprio padrão de RLS recomendado pelo Supabase — sem elas as políticas falham. Tratadas como aceitas.
- Bloqueio de impressão por pendências será aplicado na fase de etiquetas (não bloqueia agora, apenas sinaliza).
- Aprovação formal de versão nutricional antes da impressão prevista para fase futura.

## Próxima fase recomendada

**Fase 3 — Layouts de etiqueta (nutricional e de gôndola):** editor de templates, vínculo template ↔ produto, dimensões e elementos imprimíveis, validação obrigatória contra o painel de pendências antes de habilitar emissão.

---

## Validação técnica (pré-Fase 3)

### 1. Tabelas confirmadas (8 tabelas + 1 view = 9 objetos novos)

Inventário real no schema `public` (verificado via `information_schema.tables`):

| # | Objeto | Tipo |
|---|---|---|
| 1 | `categories` | tabela |
| 2 | `brands` | tabela |
| 3 | `ingredients` | tabela |
| 4 | `allergens` | tabela |
| 5 | `nutrition_facts` | tabela |
| 6 | `products` | tabela |
| 7 | `product_ingredients` | tabela |
| 8 | `product_allergens` | tabela |
| 9 | `product_pending_issues` | **view** (`security_invoker = on`) |

O relatório original contabilizava 9 itens incluindo a view. Sem tabela faltando.

### 2. Subcategorias

Implementadas como **auto-relacionamento** em `categories.parent_id` (UNIQUE `(company_id, parent_id, name)`), com a coluna `products.subcategory_id` referenciando `categories(id)`. Não foi criada uma tabela `product_subcategories` separada porque a estrutura hierárquica em `categories` já cobre o caso de uso (categoria-pai ↔ subcategoria), reaproveita RLS, auditoria e CRUD existentes e evita duplicação de conceito. Tela `/app/categories` permite criar/editar tanto raízes quanto subcategorias.

### 3. Conservação, preparo, validade, temperatura e observações legais

Armazenados em colunas dedicadas na tabela `products`:

- `preservation` — conservação
- `preparation` — modo de preparo
- `shelf_life_days` — prazo de validade
- `storage_temperature` — temperatura de armazenamento
- `legal_notes` — observações legais

Confirmado via `information_schema.columns`.

### 4. `company_id` + RLS

Todas as 8 tabelas novas possuem `company_id NOT NULL` e RLS habilitada com `SELECT` restrito a `is_company_member(auth.uid(), company_id)`. Verificado em `pg_policies` (28 policies ativas nas tabelas da Fase 2).

### 5. Auditoria

Triggers `*_audit` (INSERT/UPDATE/DELETE) ativos em **todas** as tabelas operacionais da Fase 2, incluindo `product_ingredients` e `product_allergens`. A inativação é tratada como UPDATE (`status='inativo'`) e portanto gera log.

### 6. Matriz de permissões por perfil (validada via policies)

| Tabela | Consulta | Operador | Supervisor | Administrador |
|---|---|---|---|---|
| `categories` / `brands` / `ingredients` / `allergens` / `nutrition_facts` | só leitura | só leitura | C/U | C/U/D |
| `products` | só leitura | **C** (insert), sem U/D | C/U | C/U/D |
| `product_ingredients` / `product_allergens` | só leitura | só leitura | C/U/D | C/U/D |

- **Consulta**: bloqueado para qualquer escrita (RLS + UI desabilita botões via `isReadOnly`).
- **Operador**: pode criar produto (campo de cadastro operacional), mas não altera nem remove cadastros críticos (marcas, ingredientes, alergênicos, categorias, tabelas nutricionais, produtos existentes).
- Frontend: hook `use-active-company` expõe `canWrite`, `canDelete`, `canCreateProduct`, `isReadOnly` e os componentes seguem essas flags.

### 7. View `product_pending_issues`

Definição atual cobre exatamente os 7 critérios solicitados:

| Critério | Coluna |
|---|---|
| produto sem informação nutricional | `missing_nutrition` |
| produto sem ingredientes | `missing_ingredients` |
| produto sem alergênicos | `missing_allergens` |
| produto sem validade | `missing_shelf_life` |
| produto sem conservação | `missing_preservation` |
| informação nutricional em revisão | `nutrition_in_review` |
| status pendente ou revisão necessária | `status_pending` |

`/app/pending` consome a view filtrada por `company_id`.

### Ajustes realizados

Nenhum ajuste de schema foi necessário — todos os controles solicitados já estavam implementados na migração de Fase 2. Apenas o relatório foi complementado com a matriz de permissões e o inventário explícito.

### Lacunas corrigidas

- Documentação: clareza sobre os 9 objetos (8 tabelas + 1 view).
- Documentação: explicitação da estratégia de subcategorias (parent_id) e justificativa.
- Documentação: matriz de permissões por perfil agora explícita.

### Pendências restantes (carregadas para fase futura)

- Aprovação formal (workflow) de versão nutricional antes da impressão — previsto para a fase de etiquetas.
- Upload de imagem de produto via Storage bucket dedicado.
- Bloqueio efetivo de emissão de etiqueta enquanto houver pendências regulatórias (a view já sinaliza; o bloqueio será aplicado no fluxo de impressão).

### Próxima fase

Liberado para iniciar a **Fase 3 — Layouts de etiqueta**.
