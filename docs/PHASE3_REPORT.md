# Fase 3 — Central de Layouts (Relatório Técnico)

## Tabelas criadas

| Tabela | Pertence a | Observações |
|---|---|---|
| `label_categories` | `company_id` | 9 categorias nativas pré-criadas. UNIQUE `(company_id, name)`. |
| `label_formats` | `company_id`, `branch_id` opcional | Dimensões, margens, espaçamentos, colunas, linhas, orientação, unidade (mm/cm/in/px). 9 formatos nativos. |
| `label_layouts` | `company_id`, `branch_id` opcional | Vinculado a `label_categories` + `label_formats`. Campos `current_version`, `status` (ativo/inativo/arquivado), `is_default`, `locked` (reservado para preservar snapshot quando usado em impressão). |
| `label_layout_versions` | `company_id`, `layout_id` | Cada versão registra `version`, `change_reason`, `snapshot` (JSONB reservado). UNIQUE `(layout_id, version)`. |
| `label_layout_elements` | `company_id`, `version_id` | Elementos pertencem a uma versão (snapshot por versão). Inclui posição, dimensão, fonte, cor, alinhamento, camada, visibilidade, obrigatoriedade, vinculação a campo/`custom_field`/texto fixo. |
| `label_custom_fields` | `company_id` | Campos dinâmicos por empresa (`key`, `data_type`, `default_value`). |
| `layout_associations` | `company_id`, `layout_id` | Associação polimórfica via `target_type` (`product`/`category`/`brand`/`company`/`branch`) + `target_id` + `priority`. |
| `printer_configs` | `company_id`, `branch_id` opcional | Cadastro de impressoras com fabricante, modelo, tipo, DPI, papel, conexão. Sem integração real. |

### Enums novos
- `label_status` — `ativo`, `inativo`, `arquivado`.
- `measure_unit` — `mm`, `cm`, `in`, `px`.
- `label_orientation` — `vertical`, `horizontal`.
- `association_target` — `product`, `category`, `brand`, `company`, `branch`.
- `printer_type` — `termica`, `laser`, `inkjet`, `matricial`, `pdf`, `grafica_externa`, `bobina_continua`, `etiqueta_adesiva`.
- `label_element_type` — 23 tipos cobrindo todos os elementos do prompt.

### Índices
Criados para `company_id`, `branch_id`, `status`, `category_id`, `format_id`, `layout_id`, `version_id`, `created_at` e `target_type/target_id`.

## RLS aplicadas

Padrão por tabela:

- **SELECT**: `is_company_member(auth.uid(), company_id)`.
- **INSERT/UPDATE**: `has_any_role(... , ['administrador','supervisor'])`.
- **DELETE**: `has_role(... , 'administrador')`.
- Tabelas operacionais sob versão (`label_layout_elements`, `label_custom_fields`, `layout_associations`) usam `FOR ALL` com mesma matriz `administrador/supervisor` (DELETE apenas via cascata ou por administrador).

Perfis **Operador** e **Consulta** ficam restritos a leitura por RLS.

## Auditoria

- Triggers `*_audit` (INSERT/UPDATE/DELETE) em todas as 8 tabelas novas, via `tg_audit_row()` herdada da Fase 2.
- Inativação/arquivamento de layout entra como UPDATE em `audit_logs`.
- Criação de versão é registrada em `label_layout_versions_audit`.

## Componentes criados

- `src/components/label-preview.tsx` — pré-visualização proporcional (mm/cm/in/px → px), zoom, dados de exemplo por tipo de elemento, alerta visual (borda vermelha) para elementos fora da área útil, render diferenciado para QR Code, barcode, linha, caixa, imagem/logo e texto.

## Telas criadas

| Rota | Função |
|---|---|
| `/app/layouts` | Lista da Central de Layouts: busca, status, duplicar, arquivar/reativar, criar novo. |
| `/app/layouts/$id` | Editor de layout com 3 abas: **Editor** (tabela de elementos editáveis + pré-visualização lado a lado), **Versões** (histórico, criar nova versão com motivo, tornar atual), **Associações** (vincular a produto/categoria/marca/filial/empresa com prioridade). |
| `/app/layout-categories` | CRUD de categorias de layout. |
| `/app/layout-formats` | CRUD de formatos (dimensões, margens, espaçamentos, colunas, linhas, orientação). |
| `/app/printers` | CRUD de impressoras. |

Sidebar ganhou o grupo **Layouts** com 4 itens.

## Regras de versionamento

- Layout novo inicia em `current_version = 1` e cria automaticamente a linha em `label_layout_versions`.
- "Nova versão" duplica todos os elementos da versão atual para uma nova versão incrementada, mantendo o motivo informado e libera `locked = false`.
- Versões anteriores permanecem intactas — elementos pertencem ao `version_id` específico.
- Coluna `locked` em `label_layouts` e coluna `snapshot` (JSONB) em `label_layout_versions` ficam reservadas para a fase de impressão: ao emitir, o sistema fixará o snapshot da versão usada e bloqueará reescrita.
- Duplicar layout cria um novo layout iniciando em v1 e copia os elementos da versão atual da origem (motivo: `Duplicado de <nome>`).

## Regras de associação

- Tabela `layout_associations` aceita 5 alvos via `association_target`.
- Cada associação possui `priority` para resolver conflitos.
- Hierarquia de sugestão (a ser aplicada na fase de emissão):
  1. Produto específico
  2. Categoria
  3. Marca
  4. Filial
  5. Empresa
  6. Padrão global da categoria de layout (`label_layouts.is_default = true`)
- Tela de associações implementada (aba dentro do editor).

## Matriz de permissões testada

| Tabela | Consulta | Operador | Supervisor | Administrador |
|---|---|---|---|---|
| `label_categories` / `label_formats` / `label_layouts` / `label_layout_versions` / `label_custom_fields` / `printer_configs` | leitura | leitura | C/U | C/U/D |
| `label_layout_elements` / `layout_associations` | leitura | leitura | C/U/D | C/U/D |

UI: a hook `useActiveCompany` continua expondo `canWrite`/`canDelete`. Botões de criar/editar/duplicar/arquivar/adicionar elemento/nova versão só renderizam para `canWrite`.

## Fluxos validados

1. Administrador cria categoria de layout, formato e layout vinculado.
2. Administrador adiciona elementos (texto fixo, nome do produto, código de barras, QR, linha, caixa) e edita posição/fonte/camada.
3. Pré-visualização exibe dimensão proporcional e marca elemento fora da área útil em vermelho.
4. Administrador duplica layout — nova entrada em v1 com elementos copiados.
5. Administrador cria nova versão — versão incrementa e elementos antigos preservados.
6. Administrador associa layout a produto/categoria/marca/filial/empresa.
7. Administrador arquiva e reativa layout via menu da lista ou seletor de status na edição.
8. Administrador cadastra impressora (fabricante, tipo, DPI, papel).
9. Auditoria registra todas as ações em `/app/audit`.
10. Fases 1 e 2 continuam operando — autenticação, multiempresa, produtos, painel de pendências intactos.

## Pendências encontradas

- Editor visual ainda é tabular (form + preview); arrastar e soltar real ficará em fase futura.
- `label_custom_fields` possui tabela e RLS, mas a UI de gestão de campos personalizados não foi exposta (referência por chave em elementos do tipo `custom_field` funciona). Tela CRUD pode ser adicionada quando necessário.
- `printer_format_compatibility` não foi criada — postergada para a fase de impressão real.
- "Layout usado em impressão não poderá ser sobrescrito" depende da fase de emissão: estrutura preparada via `label_layouts.locked` + `label_layout_versions.snapshot`, ainda não enforced.
- Linter Supabase: continuam os mesmos 7 WARN herdados das Fases 1/2 (`SECURITY DEFINER` em funções de RLS). Aceitos.

## Próxima fase recomendada

**Fase 4 — Engine de emissão e impressão:** seleção do layout via hierarquia de associações + pendências regulatórias, geração de PDF/spool por impressora, persistência de snapshot da versão emitida, bloqueio de `locked` no layout/versão usados e log de emissão.
