# FASE 16 — Instalador nativo do Print Agent + pareamento por código curto

## Objetivo

Eliminar a fricção do pareamento manual (gerar token → copiar → colar no navegador
de cada estação). A nova UX usa um código de 6 dígitos digitado diretamente no
agente nativo.

## Entregas

### Backend

- Migration `print_agent_pairing_codes` (código 6 dígitos, uso único, expira em
  10 min, RLS para administradores da empresa).
- Server function `createPairingCode` / `listActivePairingCodes`
  (`src/lib/print/pairing-codes.functions.ts`) — restritas a admins; invalidam
  códigos pendentes anteriores ao gerar um novo.
- Server route público `POST /api/public/print-agent/exchange` — troca o código
  pelo token permanente. Usa `supabaseAdmin` (RLS contornada de forma controlada
  porque o agente ainda não está autenticado) e grava apenas o hash SHA-256.

### Painel

- `src/components/print/pairing-code-card.tsx` — card com geração de código,
  contagem regressiva, botão de copiar e instruções de instalação.
- Integrado em `src/routes/app.printers.tsx` (visível para admins).

### Agente nativo (Windows)

- `print-agent/` — projeto Node 18 empacotado com `pkg`.
- `src/index.js` expõe HTTP em `127.0.0.1:17777` com endpoints `/health`,
  `/printers`, `/print`, `/jobs/:id`, `/pair`, compatíveis com o protocolo da
  FASE 4 (`docs/PRINT_AGENT_PROTOCOL.md`).
- Impressão por `copy /B tmp \\localhost\printer` (suporta ZPL/EPL/PPLB/TSPL
  cru emitidos pelos drivers da FASE 13).
- CLI: `PrintAgent.exe pair 123456`, `status`, `unpair`, `printers`, `start`.
- Perfil e token persistidos em `%PROGRAMDATA%\LovablePrintAgent\agent.json`
  (0600); log em `agent.log`.

### Instalador

- `print-agent/installer/install-service.bat` — copia o `.exe` para
  `C:\Program Files\LovablePrintAgent\` e registra o serviço Windows
  `LovablePrintAgent` (autostart).
- `print-agent/installer/uninstall-service.bat` — remove o serviço.
- Build: `cd print-agent && npm install && npm run build:win`.

## Fluxo do operador

1. Admin abre **Impressoras** no painel, gera código (`482 193`).
2. Operador na estação Windows roda como Administrador:
   `"C:\Program Files\LovablePrintAgent\PrintAgent.exe" pair 482193`.
3. Reinicia o serviço; painel detecta o agente e libera impressão direta.

## Segurança

- Código numérico de 6 dígitos, uso único, expiração de 10 min, codes triviais
  (`111111`, `123456`) descartados na geração.
- Apenas um código ativo por empresa (geração nova invalida o anterior).
- Token bruto exibido apenas no momento da troca; banco guarda só SHA-256.
- Endpoint `/api/public/print-agent/exchange` valida payload com Zod e retorna
  códigos genéricos (`INVALID_CODE`, `PAIRING_FAILED`) para não vazar estado.
- Agente escuta apenas em loopback (`127.0.0.1`).

## Limitações / próximas etapas

- Instalador é `.bat` + `sc.exe` (sem MSI assinado). Empacotamento via Inno
  Setup/Wix com assinatura de código fica para fase futura.
- Tray UI Windows (ícone na bandeja com botão "Parear") ainda não implementada
  — pareamento via CLI por enquanto.
- Suporte macOS/Linux fora de escopo desta fase (decisão do usuário).

## Arquivos

| Arquivo | Função |
| --- | --- |
| `supabase/migrations/*_print_agent_pairing_codes.sql` | Tabela + RLS |
| `src/lib/print/pairing-codes.functions.ts` | Server fns admin |
| `src/routes/api/public/print-agent/exchange.ts` | Endpoint público de troca |
| `src/components/print/pairing-code-card.tsx` | UI do código |
| `src/routes/app.printers.tsx` | Integração no painel |
| `print-agent/package.json` | Projeto do agente |
| `print-agent/src/index.js` | Servidor + CLI |
| `print-agent/installer/install-service.bat` | Instalação como serviço |
| `print-agent/installer/uninstall-service.bat` | Desinstalação |
| `print-agent/README.md` | Guia operacional |
