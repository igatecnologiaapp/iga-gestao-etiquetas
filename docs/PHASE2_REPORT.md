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
