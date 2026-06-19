# FASE 9 — Integrações Futuras e Preparação Técnica

Data: 2026-06-19
Status: Concluída — estrutura entregue, comunicação externa real diferida.

## 1. Escopo

Fase de preparação: criar arquitetura modular para integrações futuras
(ERP, impressoras Zebra/Argox/Elgin/Datamax/TSC, balanças, WhatsApp,
e-mail, APIs externas, produção, ficha técnica) sem efetuar chamadas
reais a serviços de terceiros nesta fase.

As Fases 1 a 8 permanecem 100% preservadas. Nada foi removido ou
alterado em tabelas, policies, triggers, rotas ou serviços existentes.

## 2. Tabelas criadas

| Tabela | Propósito |
| --- | --- |
| `integration_configs` | Configuração de cada integração (tipo, provedor, status, base_url, auth_type, settings_json) |
| `integration_tokens` | Hash de tokens sensíveis (sem SELECT para o cliente) |
| `integration_logs` | Trilha de eventos inbound/outbound (status, payload, erro) |
| `integration_event_queue` | Fila com `pending → processing → success/error/skipped`, attempts, retry |
| `integration_webhooks` | Endpoints/eventos com `secret_hash` |
| `email_templates` | Assunto, corpo, variáveis dinâmicas, status |
| `whatsapp_templates` | Mensagem, variáveis dinâmicas, status |
| `external_system_mappings` | Map `internal_id ↔ external_id` por `entity_type` |
| `scale_configs` | Cadastro de balanças (sem comunicação real) |

Enums novos: `integration_type`, `integration_status`,
`integration_auth_type`, `integration_log_status`,
`integration_log_direction`, `integration_queue_status`,
`printer_command_language`, `template_status`, `external_entity_type`.

## 3. Alterações em `printer_configs`

Colunas adicionadas (sem quebrar a Fase 3):
- `protocol` (text)
- `command_language` (`ZPL | EPL | ESC_POS | PDF | generic`)
- `connection_settings` (jsonb, default `{}`)
- `driver_notes` (text)
- `integration_config_id` (FK para `integration_configs`)

## 4. RLS e permissões

Todas as 9 tabelas novas com RLS habilitado e GRANTs explícitos para
`authenticated` + `service_role`. Nenhum acesso a `anon`.

| Tabela | Quem lê | Quem escreve |
| --- | --- | --- |
| `integration_configs` | Admin + Supervisor | **Apenas Administrador** |
| `integration_tokens` | **ninguém via SELECT** (apenas service role) | Apenas Administrador |
| `integration_logs` | Admin + Supervisor | Qualquer membro da empresa (insert) |
| `integration_event_queue` | Admin + Supervisor | Insert por membro, update por Admin/Supervisor, delete por Admin |
| `integration_webhooks` | Admin + Supervisor | Apenas Administrador |
| `email_templates` | Membros da empresa | Admin + Supervisor |
| `whatsapp_templates` | Membros da empresa | Admin + Supervisor |
| `external_system_mappings` | Admin + Supervisor | Apenas Administrador |
| `scale_configs` | Membros da empresa | Admin + Supervisor |

Operador e Consulta **não** podem criar ou editar integrações ou
mapeamentos externos. Consulta não vê configurações sensíveis.

## 5. Auditoria

Triggers `tg_audit_row` aplicados em `integration_configs`,
`email_templates`, `whatsapp_templates` e `scale_configs` — criação,
edição, ativação/desativação ficam em `audit_logs`.

Testes de conexão registram em `integration_logs` com
`event_type = 'test_connection'`, direção `outbound` e status `skipped`
(simulado nesta fase).

## 6. Telas criadas

- `/app/integrations` — lista com filtros por tipo e status; criação/edição
  por administrador; botão "Testar" registra log simulado.
- `/app/integrations/$id` — abas Configurações / Logs / Fila.
- `/app/message-templates` — abas E-mail e WhatsApp; mostra variáveis
  dinâmicas disponíveis e detecta as usadas em cada template.

Sidebar (`app-shell.tsx`) ganhou o grupo **Integrações** com os dois links.

## 7. Regras de segurança aplicadas

- Tokens nunca trafegam para o cliente: `integration_tokens` tem
  `FOR SELECT USING (false)` para `authenticated`; somente `service_role`
  (servidor / edge / RPC futura) pode lê-los.
- Webhook secrets armazenados apenas como `secret_hash`.
- `settings_json` é o lugar para configurações públicas; o formulário
  alerta o administrador a não colocar tokens ali.
- Multiempresa garantido por `company_id` em todas as tabelas + helpers
  RBAC (`has_role`, `has_any_role`, `is_company_member`).

## 8. Limitações intencionais

- Nenhuma chamada HTTP a sistema externo é feita nesta fase — o botão
  "Testar" apenas grava log.
- Sem encriptação client-side de payloads; tokens são apenas
  hash de referência. A geração e armazenamento em Vault/KMS virão na
  fase de ativação real.
- Sem worker/cron consumindo `integration_event_queue` — a fila já está
  pronta para ser processada por um job futuro.
- Sem comunicação real com balanças/impressoras; apenas cadastro.

## 9. Integrações preparadas para fase futura

- **ERP** (Bling, Omie, Tiny, SAP B1) via REST / webhooks.
- **Impressoras térmicas** Zebra (ZPL), Argox (PPLA/PPLB), Elgin/Datamax/TSC
  (EPL/ESC-POS) através do `command_language` em `printer_configs`.
- **Balanças etiquetadoras** (Toledo, Filizola, Urano) via `scale_configs`.
- **WhatsApp Business API** (Meta Cloud, Twilio) através de
  `whatsapp_templates` + fila.
- **E-mail transacional** (Lovable Emails / Resend / SES) com
  `email_templates`.
- **Ficha técnica e controle de produção** com `external_system_mappings`.

## 10. Próxima fase recomendada

**Fase 10 — Ativação das integrações críticas**:
1. Worker (cron + server function) consumindo `integration_event_queue`.
2. Edge function HMAC-verificada em `/api/public/integrations/webhook`.
3. Driver ZPL para Zebra (geração de comando + spool por HTTP/TCP via
   proxy local do cliente).
4. Conector Bling/Omie para sincronização de produtos e preços.
5. Envio real de e-mail via Lovable Emails consumindo `email_templates`.
6. Vault/KMS para `integration_tokens` (substituir `token_hash` por
   `token_secret_ref`).
