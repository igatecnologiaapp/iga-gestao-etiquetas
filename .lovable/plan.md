## Contexto atual verificado

- Existe **1 empresa**: `IGA Comercial`.
- Existe **1 usuário**: `igacomercial.sp@gmail.com` (Administrador IGA), com papel `administrador` na empresa.
- Papéis disponíveis no enum `app_role`: `administrador`, `supervisor`, `operador`, `consulta`. Não existe um papel separado "principal" — `administrador` já é o nível máximo. Vou tratar **"Administrador principal" = papel `administrador`** (sem criar enum novo, para não quebrar RLS/funções existentes `has_role`, `has_any_role`, `is_global_admin`).
- A tela `/app/users` já existe e permite vincular usuários existentes, trocar papel e remover vínculo. Falta: criar usuário novo, ativar/inativar, reenviar convite/redefinição, ver último acesso.

## Etapa 1 — Criar Souza Aguiar e transferir admin (sem expor senha)

Não posso enviar e-mail real sem infraestrutura de e-mail configurada, e não vou gravar a senha `Wia@aguiar` no código, banco ou logs. Proposta:

1. **Server function** `bootstrapPrincipalAdmin` (chamada **uma única vez** a partir de uma página interna `/app/admin-handover`, visível só para `administrador` autenticado), que:
   - Cria `souzaaguiar.producao@gmail.com` via `supabaseAdmin.auth.admin.createUser` com **senha aleatória forte descartável** (nunca retornada, nunca logada) e `email_confirm: true`.
   - Insere `full_name = "Souza Aguiar"` em `user_profiles`.
   - Cria vínculo `user_company_roles` com papel `administrador` na empresa IGA Comercial.
   - Gera link de **recovery** via `supabaseAdmin.auth.admin.generateLink({ type: 'recovery' })` e **retorna o link uma única vez para a tela** (não persiste, não loga). O administrador atual encaminha ao Souza pelo canal que preferir; ao abrir o link, Souza define a própria senha.
   - Rebaixa `igacomercial.sp@gmail.com` para papel `consulta` e marca `user_profiles.status = 'inativo'`.
   - Registra eventos em `audit_logs` (criação, atribuição de papel, rebaixamento) **sem incluir senha nem o link**.
   - Valida pré-condição: só executa se ainda não existir Souza Aguiar como administrador (idempotência).

2. Página `/app/admin-handover` simples: botão "Executar transferência" + área que exibe o link de recovery **uma única vez**, com aviso para copiá-lo. Após uso, a função recusa novas execuções.

3. **Não há nenhuma menção a `Wia@aguiar` no código ou banco em momento algum.**

## Etapa 2 — Ampliar `/app/users` (gestão completa)

Adicionar à página já existente, restrito a quem tem papel `administrador` na empresa selecionada:

- **Criar novo usuário**: e-mail + nome + papel → server function que cria via `auth.admin.createUser` (senha aleatória descartável), insere profile, cria vínculo, gera link de recovery e exibe **uma vez** para o admin copiar.
- **Editar nome/e-mail** (apenas profile; troca de e-mail no Auth fica fora do escopo desta entrega).
- **Alterar papel** do vínculo (já existe parcialmente — vou consolidar).
- **Ativar/Inativar** (atualiza `user_profiles.status`).
- **Reenviar link de redefinição de senha** (gera novo recovery link e exibe uma vez).
- **Listar**: nome, e-mail, papel, status, criado em, **último acesso** (lido via `auth.admin.listUsers` → `last_sign_in_at`).
- **Auditoria**: cada ação acima grava em `audit_logs` (sem senha/link).

## Etapa 3 — Salvaguardas de segurança

- Todas as operações sensíveis ficam em **server functions** com `requireSupabaseAuth` + verificação `has_role(uid, company_id, 'administrador')` no início do handler. Sem essa verificação, retornam 403. Nada depende só de esconder botão no frontend.
- **Não promover a si mesmo**: a função de mudar papel recusa quando `target_user_id === caller_id`.
- **Nunca ficar sem administrador**: rebaixar/remover/inativar último `administrador` ativo da empresa é bloqueado (`count(administrador ativos) > 1`).
- Senhas **nunca** retornadas, logadas ou armazenadas em texto plano — Supabase Auth cuida do hash. Link de recovery exibido **uma única vez** no momento da criação, sem persistência.

## Arquivos previstos

- `supabase/migrations/...sql` — adicionar coluna `last_login_at` opcional? **Não** — usar `auth.users.last_sign_in_at` via admin API. Apenas garantir índice/constraint para evitar duplicidade de papel (já existe `unique(user_id, role)` em user_roles — confirmar em `user_company_roles`).
- `src/lib/admin-users.functions.ts` — server functions: `bootstrapPrincipalAdmin`, `adminCreateUser`, `adminUpdateUserStatus`, `adminChangeUserRole`, `adminResetUserPassword`, `adminListUsers`.
- `src/routes/app.admin-handover.tsx` — página de uso único para a troca.
- `src/routes/app.users.tsx` — ampliação da UI.

## O que NÃO será feito

- Não vou criar novo enum de papel "principal" — quebraria RLS, `has_role`, `is_global_admin` e telas existentes. "Administrador principal" = papel `administrador` (semântica preservada na UI).
- Não vou apagar nada do histórico do usuário IGA. Ele permanece em `user_profiles` (inativo) e no `audit_logs`.
- Não vou configurar infraestrutura de e-mail nesta entrega (é uma feature à parte e exige domínio). O fluxo de convite usa **link de recovery exibido ao admin atual**, que o repassa por canal seguro. Se quiser que eu configure envio automático de e-mail depois, faço numa segunda rodada.

## Confirmações que preciso antes de executar

1. OK tratar "Administrador principal" como papel `administrador` (sem novo enum)?
2. OK que o convite do Souza seja entregue como **link de recovery exibido uma vez** ao admin atual (em vez de e-mail automático, que exigiria configurar domínio de e-mail)?
3. OK rebaixar `igacomercial.sp@gmail.com` para papel `consulta` e marcar `status = inativo` (mantendo todo histórico)?