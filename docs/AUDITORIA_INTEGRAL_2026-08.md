# RELATÓRIO TÉCNICO INTEGRAL DA AUDITORIA

Data: 2026-08-16 · Escopo: sistema completo, com prioridade máxima em Impressão Direta
Metodologia aplicada: MAPEAR → REPRODUZIR → INSTRUMENTAR → DIAGNOSTICAR → COMPROVAR → PROPOR → CORRIGIR SOMENTE O SEGURO → TESTAR → DOCUMENTAR

---

## 1. RESUMO EXECUTIVO

A **geração** de etiquetas está correta. O defeito da impressão direta está no **transporte**, e a causa raiz foi identificada e comprovada em laboratório:

> **P0-IMP-01 — O Print Agent não respondia ao preflight de Private Network Access (PNA).**
> O painel roda em origem pública `https://*.lovable.app` e o agente em rede local `http://127.0.0.1:17777`.
> Navegadores Chromium enviam o preflight com `Access-Control-Request-Private-Network: true` e **exigem**
> `Access-Control-Allow-Private-Network: true` na resposta. O agente v1.3.0 **não emitia esse header**, então o
> `fetch` era bloqueado **antes de chegar ao agente**. No navegador isso aparece apenas como `TypeError: Failed to fetch`
> — exatamente o mesmo sintoma de "agente desligado" — e o painel, corretamente, oferecia o fallback PDF.

Isso explica o padrão histórico: cada tentativa anterior mexeu em **geração RAW, linguagens, drivers e spooler do Windows** (camada B interna), enquanto o bloqueio ocorria **antes do primeiro byte sair do navegador**. Nenhuma correção nessas camadas poderia funcionar.

Correção aplicada: pequena, localizada, reversível, sem enfraquecer segurança (o header só é emitido para origens já aprovadas pela allowlist). Agente promovido a **v1.3.1**.

**Estado da impressão direta: CAUSA RAIZ COMPROVADA E CORRIGIDA NO CÓDIGO — VALIDAÇÃO DE HARDWARE PENDENTE.**
A expressão "impressão direta corrigida e operacional" **não** é usada neste relatório: falta o teste físico (protocolo na seção 9).

---

## 2. ARQUITETURA EFETIVAMENTE ENCONTRADA

```text
Navegador (https://*.lovable.app)
  ├─ TanStack Start v1 (SSR) + React 19 + Vite 7
  ├─ Supabase JS (RLS como usuário)  ─────────────► Lovable Cloud / Postgres
  │                                                  · 49 tabelas sensíveis, RLS + GRANT
  │                                                  · has_role/is_company_member (SECURITY DEFINER)
  ├─ createServerFn (RPC tipado)  ────────────────► Worker serverless (SSR/edge)
  ├─ /api/public/print-agent/exchange  ───────────► pareamento (CORS *, rate-limit por IP)
  └─ fetch http://127.0.0.1:17777  ──────────────► PRINT AGENT LOCAL (Node/Express, Windows)
                                                     └► winspool_raw → copy /B → Out-Printer → /pt
                                                        └► Spooler Windows → driver → IMPRESSORA
```

Divergência relevante em relação à documentação anterior: as fases documentavam adapters ZPL/EPL/TSPL como "apenas esqueleto"; hoje **todos emitem texto, código de barras e QR reais** (`raw-commands.ts` + adapters). A documentação estava desatualizada, não o código.

---

## 3. AUDITORIA DA IMPRESSÃO DIRETA (PRIORIDADE MÁXIMA)

### 3.1 Fluxo real, estágio a estágio

| # | Estágio | Arquivo/função | Estado |
|---|---------|----------------|--------|
| 1 | Clique "Imprimir direto" | `app.print-labels.tsx:931` → `directPrint.mutate()` | OK |
| 2 | Validação prévia | `direct-print.ts:84` `validateDirectPrint` | OK |
| 3 | Layout → dimensional | `layout-engine.ts` `buildDimensionalPayload` | OK |
| 4 | Seleção de adapter | `drivers/index.ts:75` `selectAdapter` | OK |
| 5 | Geração RAW | `zpl/epl/pplb/tspl/escpos/os-passthrough` + `raw-commands.ts` | OK |
| 6 | Guarda de segurança | `security.ts:79` `guardPrintPayload` | OK |
| 7 | Enfileiramento auditável | `print-queue-service.enqueue` (`status=pending`) | OK |
| 8 | **Envio HTTP ao agente** | `print-agent-client.ts:88` `fetch` | **FALHAVA AQUI (P0-IMP-01)** |
| 9 | CORS/PNA + auth do agente | `print-agent/src/index.js` | corrigido em 1.3.1 |
| 10 | Spooler Windows (4 métodos) | `printRawToWindows` | não alcançado até agora |
| 11 | Impressora física | — | **validação pendente** |

### 3.2 Teste fundamental: separar GERAÇÃO de TRANSPORTE

**A — Geração: APROVADA.** Os adapters produzem comandos utilizáveis, não estruturas vazias:

- ZPL: `^XA/^PW/^LL/^LH`, `^A0N…^FD` (texto), `^BCN` (Code128), `^BQN` (QR), `^PQ` (cópias) — `zpl.ts:19-52`
- EPL / PPLB / TSPL: texto, box, barcode e QR reais a partir dos elementos do layout
- ESC/POS e GDI/driver: **somente texto puro** (sem barcode/QR gráfico) — declarados `maturity: "fallback"`, comportamento correto e documentado

**B — Transporte: REPROVADO na fronteira navegador→agente.** Comprovação (sandbox, agente real):

```text
ANTES (v1.3.0) — preflight simulando o Chrome
OPTIONS /print  Origin: https://iga-gestao-etiquetas.lovable.app
                Access-Control-Request-Private-Network: true
→ 204, headers: Allow-Origin, Allow-Methods, Allow-Headers, Max-Age
→ Access-Control-Allow-Private-Network: AUSENTE   ⇒ Chromium bloqueia o fetch

DEPOIS (v1.3.1) — mesma requisição
→ 204 + Access-Control-Allow-Private-Network: true      (origem autorizada)
CONTROLE — Origin: https://evil.example.com
→ bloqueado, sem o header                                (segurança preservada)
```

### 3.3 Hipótese → Evidência → Teste → Resultado → Conclusão

| Hipótese | Evidência | Teste | Resultado | Conclusão |
|---|---|---|---|---|
| H1 — geração RAW inválida/vazia | adapters emitem texto+barcode+QR reais | leitura + 241 testes | RAW válido | **descartada** |
| H2 — payload incorreto (printerId/raw/copies) | `buildAgentSubmitRequest`, `/print` valida e faz clamp 1–50 | POST real ao agente | rejeição correta e informativa (`NOT_PAIRED`) | **descartada** |
| H3 — fallback PDF automático mascarando erro | fallback só via diálogo com confirmação | leitura `app.print-labels.tsx:976` | fallback é manual | **descartada** |
| H4 — spooler/driver Windows | 4 métodos em cascata + tradução de erros | — | nunca alcançado | **não é a causa primária** |
| **H5 — bloqueio do navegador (PNA / rede privada)** | header ausente no preflight | curl com header do Chrome | **header ausente confirmado** | **CAUSA RAIZ** |

### 3.4 Vestígios das tentativas anteriores (complexidade acidental)

- `DRIVER_MATURITY` declara `DPL`, `PCL`, `ESCP` — **sem adapter registrado**: "linguagens fantasma" que caem no driver do SO (`drivers/index.ts:37-49`). P3.
- `PPLA` e `PPLB` aparecem como opções distintas na UI, mas **usam o mesmo adapter** (`drivers/index.ts:29-30`). P2 (risco de expectativa incorreta).
- `getStoredAgentToken` mantida por compatibilidade retornando sempre `null` (`use-print-agent.ts:48`). P3, código morto.
- `/jobs/:id` e `/jobs/:id/cancel` do agente são **stubs** (sempre `completed` / `canceled:false`), pois o envio é síncrono. P2 — observabilidade falsa se algum cliente fizer polling.
- **Modo simulador** ativável pela UI e persistido em `localStorage` (`print_agent_mock:<companyId>`): com ele ligado, jobs "têm sucesso" **sem impressora física**. P1 — risco de falso positivo em homologação.
- `/print` com `copies>1` retorna só o resultado da 1ª cópia; falhas parciais ficam invisíveis. P2.

### 3.5 Estados do job e idempotência

Estados reais: `pending → sent → completed | failed | canceled`. `sent` é marcado como `completed` **imediatamente**, sem polling — HTTP 200 ainda é tratado como "impresso" (`direct-print.ts:349`). **P1**.
**Idempotência: ausente.** Duplo clique ou reenvio geram dois jobs e podem gerar duas etiquetas físicas — não há idempotency key. **P1** (proposta na seção 6, não implementada aqui).

### 3.6 O que "impressão direta" é possível nesta arquitetura

| Cenário | Suportado? |
|---|---|
| A — diálogo padrão do navegador | Sim (fallback PDF) |
| B — imprimir na impressora já configurada, sem escolher | Sim, **via agente local** |
| C — impressão silenciosa, sem diálogo | Sim, **via agente local** |
| D — RAW direto para térmica (ZPL/EPL/TSPL/PPLB) | Sim, **via agente local** |
| E — impressão automática por evento | Sim, **via agente local** |

Sem o agente local, B–E são **impossíveis**: o sandbox do navegador não dá acesso a spooler nem a USB/RAW. A arquitetura escolhida (agente local) é a **correta**; não havia erro arquitetural — havia um header de protocolo faltando.

---

## 4. PROBLEMAS IDENTIFICADOS (CLASSIFICADOS)

### P0 — Crítico

**P0-IMP-01 · Impressão · Preflight PNA sem resposta** — esperado: navegador alcança o agente; atual: fetch bloqueado antes do agente. Evidência: preflight sem `Access-Control-Allow-Private-Network`. Causa raiz: header ausente. Impacto: impressão direta 100% inoperante em Chromium recente. **CORRIGIDO** (risco baixo, esforço baixo, sem migração).

**P0-GER-01 · Frontend · Hydration mismatch** — `use-active-company.ts:8` lia `localStorage` no inicializador do `useState`, divergindo SSR × cliente. **CORRIGIDO** (leitura movida para `useEffect`).

**P0-GER-02 · Multiempresa · `app.integrations.$id.tsx` não filtra por `company_id`** — depende exclusivamente de RLS; falta defesa em profundidade ao abrir `/app/integrations/<id de outra empresa>`. **NÃO ALTERADO** (requer validação de policy antes de mexer; ver pendências).

### P1 — Alto

- **P1-01 · HTTP 200 ≠ etiqueta impressa**: `sent` vira `completed` sem confirmação do spooler (`direct-print.ts:349`).
- **P1-02 · Sem idempotência**: duplo clique/reenvio pode duplicar etiqueta física.
- **P1-03 · Modo simulador em produção**: `print_agent_mock:*` no `localStorage` produz sucesso sem hardware.
- **P1-04 · `nutrition-table.tsx` divergente**: telas de cadastro mostram 1 coluna e sem %VD, enquanto preview e PDF usam 4 colunas com %VD.
- **P1-05 · `*.functions.ts` não são thin wrappers**: `admin-users.functions.ts:6-24`, `pairing.functions.ts:14-21`, `pairing-codes.functions.ts:26-33` declaram helpers no escopo do módulo (risco de `ReferenceError` após code-splitting).
- **P1-06 · Token do navegador é opcional no agente**: sem `Authorization`, a requisição é aceita se `X-Company-Id` bater (`index.js:240`).

### P2 — Médio

- `/jobs/:id` e cancelamento são stubs (observabilidade falsa).
- `copies>1` reporta apenas a 1ª cópia.
- `PPLA` = `PPLB` (mesmo adapter, opções distintas na UI).
- `recordFailure(...).catch(() => undefined)` engole falha de auditoria (`direct-print.ts:361`).
- `health()`/`usePrintAgent` colapsam todas as causas em "offline" — **mitigado** nesta auditoria com dica explícita de bloqueio de rede privada.
- Agente aceita requisições **sem** header `Origin`.
- `catch {}` silenciosos em `app-shell.tsx:84,102` e `theme.tsx:35`.
- `as any` em `app.integrations.$id.tsx` (6 ocorrências) e ~30 arquivos com `any` disperso.

### P3 — Baixo

- Linguagens fantasma `DPL/PCL/ESCP`; `getStoredAgentToken` morta.
- `app.options("*", cors())` quebra sob Express 5 (`package.json` fixa `^4`, mas é armadilha futura).
- Erro de origem não autorizada devolve **stack trace** do Express.
- Rotas internas com `head()` só de `title`, sem `description`/`robots: noindex`.
- `elementValue` (PDF) e `labelOf` (preview) duplicados e sincronizados à mão.
- `new Date().getFullYear()` em render SSR (`auth.tsx:99`).

---

## 5. ALTERAÇÕES REALIZADAS (mínimas, rastreáveis, reversíveis)

| Arquivo | Alteração | Motivo |
|---|---|---|
| `print-agent/src/index.js` | middleware que emite `Access-Control-Allow-Private-Network: true` **somente** para origens da allowlist; `VERSION → 1.3.1` | P0-IMP-01 (causa raiz) |
| `print-agent/package.json` | versão → 1.3.1 | rastreabilidade do binário |
| `src/lib/print/print-agent-client.ts` | falha de rede em página https → mensagem que distingue "agente desligado" de "bloqueio de rede privada" | acabar com o diagnóstico ambíguo |
| `src/hooks/use-active-company.ts` | leitura de `localStorage` movida para `useEffect` | P0-GER-01 |
| `src/lib/print/print-agent-client.test.ts` | teste de regressão de falha de rede → `AGENT_OFFLINE` preservando a mensagem | cobertura da correção |

Nada foi removido, nenhum contrato público mudou, nenhum controle de segurança foi enfraquecido, nenhuma migração de banco foi executada.

---

## 6. MELHORIAS PROPOSTAS (não implementadas — aguardando autorização)

### Obrigatórias
1. **Confirmação real de spool** — `/print` devolver o `jobId` do spooler e o painel confirmar antes de marcar `completed`. Benefício: acabar com "200 = impresso". Risco baixo, complexidade média.
2. **Idempotência** — `idempotency_key` por tentativa (UI → `print_queue` → agente), com dedupe por janela de tempo. Evita etiqueta duplicada. Risco baixo, complexidade média, exige migração pequena.
3. **Modo simulador visível e bloqueado em produção** — faixa permanente na UI e recusa de emissão real com simulador ligado. Risco muito baixo.

### Recomendadas
4. Exigir `Authorization: Bearer` no agente (fechar P1-06).
5. `company_id` explícito nas queries de `app.integrations.$id.tsx` (defesa em profundidade).
6. Unificar `nutrition-table.tsx` com `buildNutritionColumns` (fim da divergência cadastro × impressão).
7. `*.functions.ts` como thin wrappers (helpers em `*.server.ts`).
8. Implementar de fato `/jobs/:id` no agente ou removê-lo do contrato.

### Opcionais
9. Adapter PPLA dedicado; remover `DPL/PCL/ESCP` da tabela de maturidade.
10. Fonte única para `elementValue`/`labelOf`.
11. Handler de erro no agente sem stack trace; `robots: noindex` nas rotas internas.

---

## 7. GATES DE QUALIDADE EXECUTADOS

| Gate | Resultado |
|---|---|
| Typecheck (`tsgo --noEmit`) | **limpo** |
| Testes unitários + integração (`vitest run`) | **241 aprovados / 14 arquivos** (nenhum teste removido, desativado ou flexibilizado) |
| RLS / isolamento multiempresa (69 testes contra o banco real) | **aprovados** |
| Teste de transporte do agente (curl, preflight PNA) | **aprovado antes/depois + controle negativo** |
| Teste físico em impressora real | **PENDENTE — sem acesso a hardware** |

---

## 8. MATRIZ FINAL DE FUNCIONALIDADES

| Funcionalidade | Estado inicial | Problema | Ação | Testes | Estado final |
|---|---|---|---|---|---|
| Impressão direta (RAW → impressora) | INOPERANTE | Preflight PNA sem resposta | Header PNA restrito à allowlist; agente 1.3.1 | curl antes/depois + controle; 241 unit/integr. | **VALIDAÇÃO DE HARDWARE PENDENTE** |
| Geração RAW (ZPL/EPL/PPLB/TSPL) | Suspeita de falha | Nenhum — geração correta | Nenhuma | drivers.test.ts | OPERACIONAL |
| Geração RAW (ESC/POS, GDI) | Não avaliado | Sem barcode/QR gráfico (por desenho) | Nenhuma | drivers.test.ts | OPERACIONAL COM RESSALVA |
| Diagnóstico de falha de impressão | Ambíguo | "Offline" mascarava bloqueio de rede | Mensagem diferenciada | novo teste de regressão | OPERACIONAL |
| Fallback PDF | OPERACIONAL | Nenhum (é manual, por confirmação) | Nenhuma | testes de lote | OPERACIONAL |
| Estados do job / confirmação de spool | OPERACIONAL COM RESSALVA | 200 tratado como impresso | Proposto (item 1) | — | OPERACIONAL COM RESSALVA |
| Idempotência de impressão | INOPERANTE | Sem chave de idempotência | Proposto (item 2) | — | INOPERANTE |
| Modo simulador | OPERACIONAL | Pode gerar falso positivo | Proposto (item 3) | — | OPERACIONAL COM RESSALVA |
| Pareamento / troca de código | OPERACIONAL | Nenhum | Nenhuma | security-hardening.test.ts | OPERACIONAL |
| CORS do agente | OPERACIONAL | Aceita sem `Origin`; stack em erro | Documentado | curl (controle negativo) | OPERACIONAL COM RESSALVA |
| Autenticação / login | OPERACIONAL | Hydration mismatch | Correção do hook | typecheck + suíte | OPERACIONAL |
| Recuperação de senha | OPERACIONAL | E-mail de aviso exige domínio próprio | Nenhuma | — | OPERACIONAL COM RESSALVA |
| RLS / isolamento multiempresa | OPERACIONAL | `integrations/$id` sem filtro na aplicação | Documentado (P0-GER-02) | 69 testes RLS | OPERACIONAL COM RESSALVA |
| RBAC / permissões | OPERACIONAL | `any` em telas de usuários/roles | Nenhuma | matriz de acesso por role | OPERACIONAL |
| Nutrição / %VD (preview e PDF) | OPERACIONAL | — | Nenhuma | nutrition-daily-values.test.ts | OPERACIONAL |
| Nutrição na tela de cadastro | OPERACIONAL COM RESSALVA | Sem %VD, layout divergente | Proposto (item 6) | — | OPERACIONAL COM RESSALVA |
| PDF / preview de etiqueta | OPERACIONAL | Lógica duplicada | Proposto (item 10) | layout-engine.test.ts | OPERACIONAL |
| Fila / histórico / dashboard | OPERACIONAL | Falha de auditoria engolida | Documentado | print-queue/history tests | OPERACIONAL COM RESSALVA |

---

## 9. PROTOCOLO DO TESTE FÍSICO (execução local obrigatória)

**VALIDAÇÃO DE HARDWARE PENDENTE.** Sem acesso a impressora física, a correção não pode ser declarada operacional.

1. Recompilar o agente no Windows: `cd print-agent && npm install && npm run build:installer`. Informar o **SHA-256** do instalador gerado.
2. Instalar/atualizar o agente (deve reportar `version: 1.3.1` em `http://127.0.0.1:17777/health`).
3. Parear a estação pelo painel (código de 6 dígitos) e confirmar `paired: true`.
4. **Prova de transporte** — no console do navegador, com o painel aberto em https:
   `fetch("http://127.0.0.1:17777/health").then(r=>r.json()).then(console.log)`
   Esperado: JSON com `version: "1.3.1"`. Se falhar aqui, capturar a aba Network (preflight OPTIONS e seus headers).
5. **Passthrough mínimo** — botão "Testar impressão direta simples" com linguagem **ZPL** (impressora Zebra). Esperado: etiqueta com `TESTE IGA`.
6. **Ponta a ponta** — emitir 1 etiqueta real por "Imprimir direto" e depois 3 cópias; conferir quantidade física.
7. Registrar: SO/versão do Chrome, modelo/driver/conexão da impressora, linguagem, resultado e o log `agent.log`.

Se o passo 4 funcionar e o 5 falhar, o defeito é do **spooler/driver** (camada H4) — investigar `printRawToWindows` com o `attempts` retornado, sem novas hipóteses especulativas.

---

## 10. PENDÊNCIAS E RISCOS REMANESCENTES

1. Teste físico (seção 9) — **bloqueia** a declaração de "operacional".
2. Recompilação Windows + SHA-256 do instalador — pendente (ambiente Linux nesta auditoria).
3. P0-GER-02 (filtro de `company_id` em integrações) — exige confirmar policy antes de alterar.
4. P1-01 a P1-06 — propostos, **não implementados** por dependerem de autorização/migração.
5. Se o navegador do cliente estiver com política corporativa restringindo acesso à rede local, o header sozinho pode não bastar — nesse caso a saída é `PrintAgentUrl` em `https` com certificado local (arquitetura adicional, fora deste escopo).
