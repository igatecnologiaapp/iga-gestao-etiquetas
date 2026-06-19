# Fase 1 — Relatório Técnico

## Objetivo
Construir a base técnica, segura e escalável (multiempresa, auth, perfis,
permissões, configurações e auditoria) antes de qualquer tela operacional.

## Tabelas criadas (schema `public`)
- `companies` — empresas (matrizes)
- `branches` — filiais vinculadas a uma empresa
- `user_profiles` — perfil estendido do usuário (1:1 com `auth.users`)
- `user_company_roles` — vínculo usuário ↔ empresa ↔ perfil de acesso
- `user_branch_access` — acesso de usuário a filiais
- `permissions` — catálogo de permissões (módulo + chave)
- `role_permissions` — matriz perfil → permissões
- `system_settings` — pares chave/valor (globais ou por empresa)
- `audit_logs` — trilha de auditoria

### Enums
- `app_role`: `administrador | supervisor | operador | consulta`
- `entity_status`: `ativo | inativo | pendente`
- `audit_action`: `INSERT | UPDATE | DELETE | LOGIN | LOGOUT | PERMISSION_CHANGE | OTHER`

## Funções (SECURITY DEFINER)
- `has_role(user, company, role)`
- `has_any_role(user, company, roles[])`
- `is_company_member(user, company)`
- `is_global_admin(user)`
- `log_audit(...)`
- `handle_new_user()` — trigger em `auth.users` cria `user_profiles`
- `tg_audit_row()` — trigger genérico em tabelas auditáveis
- `tg_set_updated_at()` — mantém `updated_at`

Execução restrita a `authenticated` e `service_role` (REVOKE de `public`/`anon`).

## Triggers de auditoria
INSERT / UPDATE / DELETE em:
`companies`, `branches`, `user_company_roles`, `user_branch_access`, `system_settings`.

Cada evento grava em `audit_logs`: `user_id`, `action`, `table_name`,
`record_id`, `old_values`, `new_values`, `company_id` (quando aplicável) e
`created_at`.

## Políticas RLS (resumo)
- **companies**: SELECT para membros (qualquer perfil); UPDATE/DELETE só Administrador da empresa; INSERT por qualquer autenticado (o criador é imediatamente vinculado como Administrador pelo frontend).
- **branches**: SELECT membros; INSERT/UPDATE/DELETE Administrador ou Supervisor da empresa.
- **user_profiles**: SELECT próprio + usuários da mesma empresa; UPDATE/INSERT só do próprio registro.
- **user_company_roles**: SELECT próprio ou Admin/Supervisor da empresa; gerenciar apenas Administrador.
- **user_branch_access**: SELECT próprio ou Admin/Supervisor da empresa da filial; gerenciar Admin/Supervisor.
- **permissions / role_permissions**: SELECT livre para autenticados (catálogo).
- **system_settings**: SELECT membros (incluindo configs globais); gerenciar apenas Administrador da empresa.
- **audit_logs**: SELECT próprio + Admin/Supervisor da empresa; INSERT permitido (mas o caminho oficial é via triggers SECURITY DEFINER).

## GRANTs
Todas as tabelas operacionais: `SELECT, INSERT, UPDATE, DELETE` para `authenticated` e `ALL` para `service_role`. Catálogos (`permissions`, `role_permissions`) apenas `SELECT` para `authenticated`.

## Autenticação
- Provedor: e-mail/senha (Google e Apple desativados nesta fase).
- Sem sign-up público: nova conta é criada pelo Administrador.
- Página `/auth` é pública; toda a área `/app/**` exige sessão (gate em `_authenticated/route.tsx`, `ssr: false`).
- Listener global em `__root.tsx` invalida router e cache em `SIGNED_IN` / `SIGNED_OUT` / `USER_UPDATED`.

## Componentes/serviços criados
- `src/lib/auth-context.tsx` — provider de sessão.
- `src/hooks/use-user-companies.ts` — empresas/perfis do usuário corrente.
- `src/components/app-shell.tsx` — layout administrativo com sidebar.
- Rotas: `/auth`, `/app`, `/app/companies`, `/app/branches`, `/app/users`, `/app/roles`, `/app/audit`, `/app/settings`.

## Como definir o primeiro Administrador (seed manual)
1. **Crie o usuário em Cloud → Users → Add user** (defina e-mail e senha).
2. Após o trigger `handle_new_user`, um registro aparecerá em `public.user_profiles`. Pegue o `id` (= `auth.users.id`).
3. Crie a primeira empresa via SQL (Cloud → SQL):
   ```sql
   INSERT INTO public.companies (name, legal_name, tax_id)
   VALUES ('Minha Empresa', 'Minha Empresa LTDA', '00.000.000/0001-00')
   RETURNING id;
   ```
4. Vincule o usuário como Administrador:
   ```sql
   INSERT INTO public.user_company_roles (user_id, company_id, role)
   VALUES ('<UUID_DO_USUARIO>', '<UUID_DA_EMPRESA>', 'administrador');
   ```
5. (Opcional) Crie uma filial e registre acesso:
   ```sql
   INSERT INTO public.branches (company_id, name, code)
   VALUES ('<UUID_DA_EMPRESA>', 'Matriz', 'MAT');
   ```
A partir daí, o Administrador faz login em `/auth` e gerencia tudo pela UI. **Alternativa**: o próprio usuário pode criar a primeira empresa pela tela `/app/companies` — o frontend o promove automaticamente a Administrador via `user_company_roles`. O passo 1 ainda é necessário (criar a conta `auth.users`).

## Fluxos testados (manuais recomendados)
- Login com usuário válido → redireciona para `/app`.
- Login inválido → toast de erro, permanece em `/auth`.
- Acesso a `/app/*` sem sessão → redireciona para `/auth`.
- Criar empresa → aparece em `/app/companies` e em "Suas empresas" no Dashboard.
- Criar filial em empresa que o usuário não administra → bloqueado por RLS.
- Vincular outro usuário → aparece em `/app/users` filtrado pela empresa.
- Auditoria registra automaticamente cada INSERT/UPDATE/DELETE.

## Pendências / observações
- Linter Supabase emite WARN 0029 para funções `SECURITY DEFINER` executáveis por `authenticated` — é esperado: são as funções consumidas pelas políticas RLS (padrão oficial `has_role`).
- Recuperação de senha não implementada nesta fase (Admin reseta via Cloud → Users).
- SSO Google/Apple: arquitetura está pronta (provider via `lovable.auth`), apenas desativada.
- Edição inline de empresas/filiais e exclusão suave (soft delete) ficam para o backlog antes da Fase 2.

## Próxima fase recomendada
**Fase 2 — Cadastros principais**: produtos, categorias, marcas, ingredientes, alergênicos e suas relações multiempresa, com painel de pendências regulatórias.
