# Lovable Print Agent (Windows)

Agente local que recebe trabalhos de impressão do painel Lovable e envia para as
impressoras físicas instaladas na estação.

## Build (em qualquer máquina com Node 18+)

```bash
cd print-agent
npm install
npm run build:win    # gera dist/PrintAgent.exe via pkg (Windows x64)
```

## Instalação na estação Windows

1. Copie a pasta `print-agent/dist/` e `print-agent/installer/` para a estação.
2. Execute, como **Administrador**, `installer/install-service.bat`.
   - O instalador copia o executável para `C:\Program Files\LovablePrintAgent\`
     e cria o serviço Windows **LovablePrintAgent** (início automático).
3. No painel Lovable, abra **Impressoras → Pareamento do Print Agent**, gere o
   código de 6 dígitos e rode na estação:
   ```cmd
   "C:\Program Files\LovablePrintAgent\PrintAgent.exe" pair 123456
   ```
4. Reinicie o serviço: `sc stop LovablePrintAgent && sc start LovablePrintAgent`.

Pronto: o painel passa a detectar o agente em `http://127.0.0.1:17777/health`
e pode imprimir direto.

## Comandos manuais

| Comando | Descrição |
| --- | --- |
| `PrintAgent.exe start` | Inicia o servidor HTTP (usado pelo serviço) |
| `PrintAgent.exe pair 123456` | Pareia esta estação usando código do painel |
| `PrintAgent.exe status` | Mostra empresa e label pareados |
| `PrintAgent.exe printers` | Lista impressoras Windows visíveis |
| `PrintAgent.exe unpair` | Remove o token local |

## Caminhos importantes

- Binário: `C:\Program Files\LovablePrintAgent\PrintAgent.exe`
- Perfil/token: `C:\ProgramData\LovablePrintAgent\agent.json` (0600)
- Log: `C:\ProgramData\LovablePrintAgent\agent.log`

## Segurança

- O token só é exibido no momento da troca do código; o servidor guarda
  apenas o hash SHA-256.
- O código tem validade de 10 minutos e é de uso único.
- O agente só escuta em `127.0.0.1` — nenhuma porta exposta na rede.
- `agent.json` é gravado com permissões restritas; remova com `unpair` ao
  desinstalar a estação.

## Desinstalação

Execute `installer/uninstall-service.bat` como Administrador.
