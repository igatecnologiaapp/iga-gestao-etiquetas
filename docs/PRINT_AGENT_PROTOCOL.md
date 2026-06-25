# Print Agent Protocol — v1 (FASE 4)

Contrato HTTP entre o sistema web (cliente) e o **Print Agent local**
(binário a ser empacotado em fase futura). Este documento é a fonte de
verdade do contrato; o `PrintAgentClient` em `src/lib/print/print-agent-client.ts`
implementa exatamente o que está aqui.

> Esta fase **NÃO** altera o fluxo PDF atual. Sempre que o agente estiver
> offline, ausente ou retornar erro, o sistema deve continuar permitindo a
> geração de PDF como fallback.

---

## 1. Endpoint base

- URL local fixa: `http://127.0.0.1:17777`
- Bind: apenas `127.0.0.1` (loopback) — o agente **nunca** escuta em `0.0.0.0`.
- Protocolo: HTTP/1.1 + JSON em `Content-Type: application/json`.

### 1.1 CORS / origens permitidas

O agente DEVE responder com:

```
Access-Control-Allow-Origin: <origem exata do app>
Access-Control-Allow-Headers: authorization, content-type, x-company-id
Access-Control-Allow-Methods: GET, POST, OPTIONS
Vary: Origin
```

A lista de origens permitidas é configurada durante o pareamento e DEVE
conter apenas:

- `https://iga-gestao-etiquetas.lovable.app`
- `https://*.lovable.app` (preview)
- `http://localhost:8080` (dev)

Qualquer outra origem recebe `403 FORBIDDEN_ORIGIN`. Isso impede que um
site malicioso aberto no mesmo navegador acione impressão local.

---

## 2. Autenticação — token de pareamento

- O token é **por empresa** (`company_id`) e gerado pelo administrador
  na tela de configuração de impressoras (fase posterior).
- O token bruto começa com o prefixo `pat_` seguido de 64 chars hex
  aleatórios. **Só é exibido uma vez** no momento da criação.
- O servidor (Lovable Cloud) persiste apenas o hash SHA-256 do token na
  tabela `public.print_agent_pairings` — nunca o valor bruto.
- O agente local guarda o token cifrado em seu próprio keystore do SO
  (Credential Manager / Keychain / libsecret). Nunca em texto plano.

### 2.1 Cabeçalhos obrigatórios

```
Authorization: Bearer pat_xxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx
X-Company-Id: <uuid da empresa>
```

O agente verifica:
1. Token presente → senão `401 MISSING_TOKEN`.
2. Token corresponde ao keystore local → senão `401 INVALID_TOKEN`.
3. `X-Company-Id` bate com o pareamento → senão `401 UNAUTHORIZED`.
4. Origem permitida → senão `403 FORBIDDEN_ORIGIN`.

### 2.2 Rotação e revogação

- **Rotação:** o admin clica em "Rotacionar" → server fn `rotatePairing`
  revoga o atual e cria um novo registro com `label "<antigo> (rotated)"`.
  O novo token é exibido uma única vez.
- **Revogação:** server fn `revokePairing` define `status='revoked'`,
  `revoked_at`, `revoked_by`. O agente deve recusar qualquer requisição
  com token revogado (`401 INVALID_TOKEN`).
- Toda criação/rotação/revogação é registrada em `audit_logs` via trigger.

---

## 3. Endpoints

Resumo (todos respondem JSON):

| Método | Path                                    | Função                    |
|--------|-----------------------------------------|---------------------------|
| GET    | `/health`                               | Health/status do agente   |
| GET    | `/printers`                             | Lista impressoras locais  |
| POST   | `/printers/:id/test`                    | Testa conexão             |
| POST   | `/printers/:id/test-page`               | Imprime página de teste   |
| POST   | `/print`                                | Envia trabalho            |
| GET    | `/jobs/:jobId`                          | Consulta status do job    |
| POST   | `/jobs/:jobId/cancel`                   | Cancela job (se possível) |

### 3.1 GET `/health`

Resposta `200`:
```json
{ "version": "1.0.0", "status": "ok" }
```

### 3.2 GET `/printers`

Resposta `200`:
```json
[
  { "id": "ZD220-001", "name": "Zebra ZD220", "driver": "ZPL", "default": true, "status": "online" }
]
```

### 3.3 POST `/printers/:id/test`

Resposta `200`:
```json
{ "ok": true }
```

### 3.4 POST `/printers/:id/test-page`

Resposta `200`:
```json
{ "jobId": "job-1a2b" }
```

### 3.5 POST `/print`

Payload:
```json
{
  "printerId": "ZD220-001",
  "copies": 2,
  "raw": "^XA...^XZ",
  "pdfBase64": null,
  "jobName": "Etiqueta nutricional 10x15",
  "metadata": { "label_id": "...", "batch_id": "..." }
}
```

Regras:
- Exatamente um entre `raw` e `pdfBase64` deve ser preenchido.
- `copies >= 1`.
- Se `raw` presente, o driver da impressora deve aceitar a linguagem
  (ex.: ZPL, EPL, TSPL).

Resposta `200`:
```json
{ "jobId": "job-1a2b" }
```

### 3.6 GET `/jobs/:jobId`

Resposta `200`:
```json
{ "jobId": "job-1a2b", "status": "completed" }
```

Status possíveis: `pending | sent | printing | completed | failed | canceled`.

### 3.7 POST `/jobs/:jobId/cancel`

Resposta `200`:
```json
{ "jobId": "job-1a2b", "canceled": true }
```

Erros possíveis: `JOB_NOT_FOUND` (404) ou `JOB_NOT_CANCELABLE` (409, quando
o job já foi enviado para o spooler do SO).

---

## 4. Erros padronizados

Sempre que `!2xx`, o body é:

```json
{ "code": "INVALID_TOKEN", "message": "token inválido", "details": { } }
```

Códigos suportados:

| Code                 | HTTP | Significado                                         |
|----------------------|------|-----------------------------------------------------|
| `AGENT_OFFLINE`      |  —   | Cliente não conseguiu se conectar (gerado pelo SDK) |
| `TIMEOUT`            |  —   | Tempo esgotado (gerado pelo SDK)                    |
| `MISSING_TOKEN`      | 401  | `Authorization` ausente                             |
| `INVALID_TOKEN`      | 401  | Token não bate com keystore / foi revogado          |
| `UNAUTHORIZED`       | 401  | `X-Company-Id` não corresponde ao pareamento        |
| `FORBIDDEN_ORIGIN`   | 403  | `Origin` fora da lista permitida                    |
| `PRINTER_NOT_FOUND`  | 404  | Impressora desconhecida                             |
| `PRINTER_OFFLINE`    | 503  | Impressora física não responde                      |
| `JOB_NOT_FOUND`      | 404  | Job desconhecido                                    |
| `JOB_NOT_CANCELABLE` | 409  | Job já saiu do controle do agente                   |
| `INVALID_PAYLOAD`    | 422  | Payload mal-formado                                 |
| `INTERNAL_ERROR`     | 500  | Falha interna não classificada                      |

---

## 5. Fluxo de status

```
[web] enqueue → print_queue.status='pending'
   │
   ├─ agent disponível?
   │   ├─ não → ficar em 'pending' + UI sugere "Baixar PDF"
   │   └─ sim → POST /print → recebe jobId
   │             update print_queue.status='sent', agent_job_id
   │
   ├─ poll GET /jobs/:jobId (intervalos de 1-2s, máx ~30s)
   │   ├─ printing  → status='printing'
   │   ├─ completed → status='completed' + printed_labels insert
   │   ├─ failed    → status='failed' + error_message
   │   └─ canceled  → status='canceled'
   │
   └─ ao falhar/timeout → marcar print_queue.status='failed'
                          + UI oferece "Baixar PDF" (fallback)
```

---

## 6. Comportamento quando o agente está offline

1. `PrintAgentClient.health()` retorna `{ ok:false, reachable:false, code:'AGENT_OFFLINE' }`
   — **nunca lança**.
2. Demais métodos lançam `PrintAgentOfflineError` (subclasse de `Error`).
3. A UI (fases posteriores) DEVE:
   - Sinalizar visualmente "Print Agent indisponível".
   - Continuar oferecendo o botão **Baixar PDF**, que usa o fluxo atual
     intacto (`label-pdf.ts` + `print-labels.tsx`).
   - Não tentar reenviar automaticamente sem confirmação do usuário.

---

## 7. Fallback PDF

O fluxo PDF atual permanece **inalterado** nesta fase:

- `src/lib/label-pdf.ts` — gera o PDF.
- `src/routes/app.labels.print-labels.tsx` (e similares) — exibe/baixa.

Nenhuma alteração foi feita nesses arquivos na FASE 4. O Print Agent é um
**aprimoramento opt-in**; sua ausência não pode bloquear emissão.

---

## 8. Pareamento — modelo de dados

Tabela `public.print_agent_pairings`:

| Coluna          | Tipo        | Notas                                           |
|-----------------|-------------|-------------------------------------------------|
| `id`            | uuid PK     |                                                 |
| `company_id`    | uuid FK     | empresas (`companies.id`)                       |
| `label`         | text        | rótulo amigável (ex.: "Loja Centro - Caixa 1")  |
| `token_prefix`  | text        | primeiros 12 chars para exibição (`pat_abcdef…`)|
| `token_hash`    | text        | SHA-256 do token bruto                          |
| `status`        | text        | `active` \| `revoked`                           |
| `created_by`    | uuid        | quem criou                                      |
| `revoked_by`    | uuid        | quem revogou                                    |
| `revoked_at`    | timestamptz |                                                 |
| `last_seen_at`  | timestamptz | última requisição autenticada                   |
| `last_seen_ip`  | text        | IP visto (loopback será `127.0.0.1`)            |
| `created_at`    | timestamptz | default `now()`                                 |
| `updated_at`    | timestamptz | atualizado por trigger                          |

RLS:
- `SELECT/INSERT/UPDATE` somente para `is_global_admin(auth.uid())` ou
  `has_role(auth.uid(), company_id, 'administrador')`.
- Auditoria automática via `tg_audit_row`.
- Token bruto **nunca** sai do banco — apenas no payload `createPairing`
  retornado uma única vez para o admin.

---

## 9. Riscos conhecidos

1. **DNS rebinding** contra `127.0.0.1`: mitigado por (a) validação de
   `Origin`, (b) exigência de `Authorization` + `X-Company-Id`.
2. **Tokens em backup do banco**: mitigado por hash SHA-256 (não reversível).
3. **Token vazado**: admin pode revogar individualmente; rotação cria novo
   sem invalidar outras estações.
4. **Agente desatualizado**: `/health` retorna `version`; UI pode alertar.
5. **Roubo do binário do agente**: keystore do SO protege o token; em última
   instância, revogar o pareamento da estação.

---

## 10. Versionamento do contrato

- Versão atual: `v1`.
- Mudanças incompatíveis exigirão prefixo `/v2/...`. Enquanto isso,
  alterações compatíveis (novos campos opcionais, novos códigos de erro)
  podem ser feitas sem bump.
