# FASE 14 — Segurança, Permissões e Hardening do Módulo de Impressão

## Pontos auditados

| Item | Resultado |
|------|-----------|
| RLS `printer_configs` | ✅ select por membro da empresa; insert/update por admin+supervisor; delete admin |
| RLS `printer_layout_compatibility` | ✅ select membro; insert/update admin+supervisor; delete admin |
| RLS `print_queue` | ✅ select por membro; insert obriga `user_id = auth.uid()` + `is_company_member`; update self ou admin/supervisor; delete admin/supervisor |
| RLS `print_agent_pairings` | ✅ todas as ações restritas a `is_global_admin` ou `administrador` da empresa |
| RLS `print_batches`, `print_events`, `printed_labels` | ✅ select por membro; insert por admin/supervisor/operador; update por admin/supervisor; delete admin |
| GRANTs públicos | ✅ presentes em todas as tabelas novas (`authenticated`, `service_role`); nenhum grant `anon` |
| Token de pareamento | ✅ persistido apenas como SHA-256 (`token_hash`); valor bruto retornado uma única vez na criação/rotação |
| Auditoria | ✅ trigger `tg_audit_row` ativo em printers/pairings/queue (audit_logs com FK por empresa) |
| Mensagens de erro | ✅ sanitizadas pelo helper antes de gravar em `print_queue.error_message` |
| Exportação CSV (histórico) | ✅ não inclui `payload`, `token`, headers nem dados de outra empresa (RLS já filtra) |
| Exportação CSV (dashboard) | ✅ apenas métricas agregadas — sem dados sensíveis |
| Payload técnico exibido na UI | ✅ passado por `sanitizePayload` antes de renderizar |

## Arquivos alterados/criados

- **Novo** `src/lib/print/security.ts` — `maskSecretsInString`, `sanitizeErrorMessage`, `sanitizePayload`, `guardPrintPayload`.
- **Novo** `src/lib/print/security.test.ts` — 13 testes verdes.
- **Alterado** `src/lib/print/direct-print.ts` — guarda de payload (UUIDs/IDs, quantidade, DPI, dimensões, rotação) ANTES de gravar/enviar; sanitização do payload persistido; sanitização de mensagens de erro registradas em `print_queue`.
- **Alterado** `src/routes/app.print-history.tsx` — exibição de "Payload técnico" sanitizada (defesa em profundidade).
- **Alterado** `src/routes/app.print-queue.tsx` — idem para diálogo da fila.

## Policies revisadas

Nenhuma alteração necessária. Todas as policies revisadas seguem o modelo:
- leitura: `is_company_member(auth.uid(), company_id)`
- escrita: `has_role` / `has_any_role` apropriadas
- escrita de jobs por usuário: `(user_id = auth.uid())` no `WITH CHECK`
- `print_agent_pairings`: acesso restrito a global admin ou administrador da empresa

## Riscos corrigidos

1. **Possível vazamento de token em payload técnico** — embora o `PrintAgentClient` nunca grave o token no payload (envia via header HTTP), o `sanitizePayload` agora remove qualquer chave com nomes `token`, `secret`, `authorization`, `password`, `api_key`, `service_role_key`, `token_hash` e mascara `Bearer …`, `pat_…`, JWTs embutidos. Aplicado tanto na gravação quanto na exibição.
2. **Possível vazamento de token em mensagem de erro** — `sanitizeErrorMessage` aplica máscara de `Bearer` / `pat_` / JWT em todas as `error_message` persistidas e expostas.
3. **Payload mal formado chegando ao banco** — `guardPrintPayload` valida IDs obrigatórios, quantidade (1–5000), DPI (1–2400), dimensões > 0, rotação ∈ {0,90,180,270} ANTES de qualquer side-effect.
4. **Truncamento de mensagens** — limite de 500 caracteres em `sanitizeErrorMessage` evita poluir o banco com stack traces grandes.

## Tokens / segredos — confirmações explícitas

- `print_agent_pairings.token` (bruto) **não é gravado** — apenas `token_hash` (SHA-256) e `token_prefix` (12 chars).
- Token bruto é exibido **uma única vez** no momento da criação/rotação no diálogo do Print Agent.
- `payload` JSONB do `print_queue` **não contém** o token (gerado por `buildAgentPayload`, sem leitura de localStorage).
- CSV (histórico/dashboard) **não inclui** `payload`, `token`, `token_hash`, `token_prefix`, nem headers.
- Mensagens de erro armazenadas e exibidas passam por `sanitizeErrorMessage` (mascara Bearer/pat_/JWT, trunca 500 chars).

## Testes de segurança executados (13 novos — suíte total 151/151)

- `maskSecretsInString` mascara `Bearer …`, `pat_…` e JWTs embutidos.
- `sanitizeErrorMessage` trunca a 500 chars e mascara segredos.
- `sanitizePayload` remove chaves sensíveis em qualquer nível, mascara segredos em strings, limita profundidade a 8 níveis.
- `guardPrintPayload` rejeita `company_id` ausente, quantidade fora de 1–5000, DPI fora de 1–2400, rotação não-canônica e dimensões inválidas.
- Testes pré-existentes (drivers, direct-print, batch-print, queue, history, analytics, layout-engine, config validation) seguem verdes — RLS e fluxo não foram alterados.

## Limites de teste (riscos aceitos / pendentes)

- Os testes não acionam Supabase real; o cumprimento das RLS é validado por inspeção e pelo banco em produção. Recomenda-se rodar `supabase--linter` no próximo deploy.
- Cross-tenant: a isolação entre empresas é responsabilidade exclusiva das RLS (`is_company_member`); não há proteção adicional no client — não é necessária dado que `service_role` não está no frontend.
- Cancelamento/reimpressão: bloqueios continuam aplicados pelas policies (`update own or admin`, `delete admin/supervisor`). Os botões em `app.print-queue.tsx` permanecem condicionais ao papel, mas RLS garante a segurança real.
- Logs do servidor (Edge Functions) não foram revisados porque o módulo de impressão usa `createServerFn`, sem chamadas a Edge.

## Preservação confirmada

- **PDF**: intocado.
- **Preview**: intocado.
- **Layouts cadastrados**: nenhuma migração.
- **Emissão individual**: passou em todos os testes; payload agora é sanitizado e validado.
- **Emissão em lote**: tests `batch-print` verdes.
- **Fila / Histórico / Dashboard**: inalterados, exceto exibição de payload técnico — agora masked.
- **Policies antigas**: nenhuma alteração.
